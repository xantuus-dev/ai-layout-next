/**
 * Agent Orchestrator
 *
 * Manages autonomous agent execution:
 * - Polls for scheduled tasks
 * - Queues tasks for execution
 * - Manages worker lifecycle
 * - Provides status monitoring
 */

import { prisma } from '@/lib/prisma';
import { queueAgentTask, getQueueStats } from '@/lib/queue/agent-queue';
import { getAgentWorker, closeAgentWorker } from '@/lib/queue/agent-worker';
import { CronExpressionParser } from 'cron-parser';
import { AgentOrchestrator, OrchestratorConfig, OrchestratorStatus } from './types';

/**
 * Default orchestrator configuration
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrentAgents: 10,
  pollInterval: 60000, // Check for scheduled tasks every minute
  defaultTimeout: 300000, // 5 minutes
  maxRetries: 3,
};

/**
 * Agent Orchestrator Implementation
 */
export class AgentOrchestratorImpl implements AgentOrchestrator {
  private config: OrchestratorConfig;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private worker: any = null;

  // Statistics
  private stats = {
    completedToday: 0,
    failedToday: 0,
    lastResetDate: new Date().toDateString(),
  };

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('⚠️  Orchestrator already running');
      return;
    }

    console.log('🚀 Starting Agent Orchestrator...');
    console.log(`   Poll interval: ${this.config.pollInterval}ms`);
    console.log(`   Max concurrent: ${this.config.maxConcurrentAgents}`);

    this.running = true;
    this.startTime = new Date();

    // Start worker
    this.worker = getAgentWorker();

    // Initial check for scheduled tasks
    await this.checkScheduledTasks();

    // Start polling loop
    this.pollTimer = setInterval(async () => {
      await this.checkScheduledTasks();
    }, this.config.pollInterval);

    console.log('✅ Agent Orchestrator started');
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.running) {
      console.log('⚠️  Orchestrator not running');
      return;
    }

    console.log('🛑 Stopping Agent Orchestrator...');

    this.running = false;

    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Close worker
    await closeAgentWorker();

    console.log('✅ Agent Orchestrator stopped');
  }

  /**
   * Check for scheduled tasks that need to run
   */
  private async checkScheduledTasks(): Promise<void> {
    try {
      // Reset daily stats if needed
      this.resetDailyStatsIfNeeded();

      // Find tasks that are scheduled and due to run
      const now = new Date();

      const scheduledTasks = await prisma.task.findMany({
        where: {
          scheduleEnabled: true,
          nextRunAt: {
            lte: now,
          },
          status: {
            in: ['pending', 'completed'], // Only run pending or previously completed tasks
          },
        },
        orderBy: {
          priority: 'desc', // Higher priority first
        },
        take: 50, // Process max 50 tasks per check
      });

      if (scheduledTasks.length === 0) {
        return;
      }

      console.log(`📅 Found ${scheduledTasks.length} scheduled tasks to run`);

      // Queue each task
      for (const task of scheduledTasks) {
        try {
          await this.executeTask(task.id);
        } catch (error: any) {
          console.error(`Failed to queue task ${task.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error checking scheduled tasks:', error);
    }
  }

  /**
   * Execute a specific task (queue it for execution)
   */
  async executeTask(taskId: string): Promise<void> {
    try {
      // Fetch task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Add to queue
      await queueAgentTask(task.userId, taskId, {
        priority: this.getPriorityValue(task.priority),
        retryCount: this.config.maxRetries,
      });

      // Calculate next run time if task is scheduled
      if (task.scheduleEnabled && task.schedule) {
        const nextRunAt = this.calculateNextRunTime(task.schedule);

        await prisma.task.update({
          where: { id: taskId },
          data: {
            nextRunAt,
            lastRunAt: new Date(),
            status: 'pending', // Reset status
          },
        });

        console.log(`⏰ Task ${taskId} scheduled for next run: ${nextRunAt.toISOString()}`);
      } else {
        // One-time task, just update last run
        await prisma.task.update({
          where: { id: taskId },
          data: {
            lastRunAt: new Date(),
            status: 'pending',
          },
        });
      }

    } catch (error: any) {
      console.error(`Failed to execute task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get current orchestrator status
   */
  getStatus(): OrchestratorStatus {
    const uptime = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0;

    return {
      running: this.running,
      activeAgents: 0, // Will be updated from queue stats
      queuedTasks: 0, // Will be updated from queue stats
      completedToday: this.stats.completedToday,
      failedToday: this.stats.failedToday,
      uptime,
    };
  }

  /**
   * Get detailed status with queue statistics
   */
  async getDetailedStatus(): Promise<OrchestratorStatus & { queue: any }> {
    const queueStats = await getQueueStats();
    const baseStatus = this.getStatus();

    return {
      ...baseStatus,
      activeAgents: queueStats.active,
      queuedTasks: queueStats.waiting + queueStats.delayed,
      queue: queueStats,
    };
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRunTime(cronExpression: string): Date {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      console.error('Invalid cron expression:', cronExpression, error);
      // Default to 1 day from now if cron parsing fails
      return new Date(Date.now() + 86400000);
    }
  }

  /**
   * Convert priority string to numeric value
   */
  private getPriorityValue(priority: string | null): number {
    switch (priority) {
      case 'urgent':
        return 1;
      case 'high':
        return 2;
      case 'medium':
        return 3;
      case 'low':
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Reset daily statistics if it's a new day
   */
  private resetDailyStatsIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.stats.lastResetDate !== today) {
      this.stats.completedToday = 0;
      this.stats.failedToday = 0;
      this.stats.lastResetDate = today;
      console.log('📊 Daily stats reset');
    }
  }

  /**
   * Update statistics (called by event handlers)
   */
  public recordCompletion(): void {
    this.stats.completedToday++;
  }

  public recordFailure(): void {
    this.stats.failedToday++;
  }
}

// Singleton instance
let orchestratorInstance: AgentOrchestratorImpl | null = null;

/**
 * Get orchestrator instance
 */
export function getOrchestrator(config?: Partial<OrchestratorConfig>): AgentOrchestratorImpl {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestratorImpl(config);
  }
  return orchestratorInstance;
}

/**
 * Start orchestrator (convenience function)
 */
export async function startOrchestrator(config?: Partial<OrchestratorConfig>): Promise<void> {
  const orchestrator = getOrchestrator(config);
  await orchestrator.start();
}

/**
 * Stop orchestrator (convenience function)
 */
export async function stopOrchestrator(): Promise<void> {
  if (orchestratorInstance) {
    await orchestratorInstance.stop();
  }
}
