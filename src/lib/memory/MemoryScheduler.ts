/**
 * MemoryScheduler - Phase 2
 *
 * Schedules and runs periodic memory system maintenance tasks:
 * - Memory consolidation (every 6 hours by default)
 * - Embedding cache cleanup (daily)
 * - Fact importance recalculation (daily)
 * - Expired fact cleanup (daily)
 *
 * Uses cron-like scheduling for reliable task execution.
 *
 * @author Xantuus AI Team
 * @date 2026-02-17
 */

import { Pool } from 'pg';
import { MemoryService } from './MemoryService';
import { MemoryConsolidator } from './MemoryConsolidator';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SchedulerConfig {
  consolidationIntervalMs?: number;      // Default: 6 hours
  cacheCleanupIntervalMs?: number;       // Default: 24 hours
  importanceUpdateIntervalMs?: number;   // Default: 24 hours
  expiredFactsCleanupIntervalMs?: number;  // Default: 24 hours
  enabled?: boolean;
}

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  lastRun?: Date;
  nextRun?: Date;
  running: boolean;
  runCount: number;
  errorCount: number;
}

export interface SchedulerStats {
  uptime: number;
  tasks: ScheduledTask[];
  totalRuns: number;
  totalErrors: number;
}

// ============================================================================
// MemoryScheduler Class
// ============================================================================

export class MemoryScheduler {
  private db: Pool;
  private memoryService: MemoryService;
  private memoryConsolidator: MemoryConsolidator;
  private config: Required<SchedulerConfig>;

  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private startTime: Date;
  private enabled: boolean;

  constructor(
    db: Pool,
    memoryService: MemoryService,
    memoryConsolidator: MemoryConsolidator,
    config: SchedulerConfig = {}
  ) {
    this.db = db;
    this.memoryService = memoryService;
    this.memoryConsolidator = memoryConsolidator;
    this.startTime = new Date();
    this.enabled = config.enabled ?? true;

    this.config = {
      consolidationIntervalMs: config.consolidationIntervalMs ?? 6 * 60 * 60 * 1000,  // 6 hours
      cacheCleanupIntervalMs: config.cacheCleanupIntervalMs ?? 24 * 60 * 60 * 1000,  // 24 hours
      importanceUpdateIntervalMs: config.importanceUpdateIntervalMs ?? 24 * 60 * 60 * 1000,  // 24 hours
      expiredFactsCleanupIntervalMs: config.expiredFactsCleanupIntervalMs ?? 24 * 60 * 60 * 1000,  // 24 hours
      enabled: this.enabled,
    };
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.enabled) {
      console.log('[MemoryScheduler] Scheduler is disabled');
      return;
    }

    if (this.intervals.size > 0) {
      console.log('[MemoryScheduler] Scheduler already running');
      return;
    }

    console.log('[MemoryScheduler] Starting scheduler...');

    // Schedule consolidation
    this.scheduleTask(
      'consolidation',
      this.config.consolidationIntervalMs,
      () => this.runConsolidationForAllUsers()
    );

    // Schedule cache cleanup
    this.scheduleTask(
      'cache_cleanup',
      this.config.cacheCleanupIntervalMs,
      () => this.runCacheCleanup()
    );

    // Schedule importance updates
    this.scheduleTask(
      'importance_update',
      this.config.importanceUpdateIntervalMs,
      () => this.runImportanceUpdates()
    );

    // Schedule expired facts cleanup
    this.scheduleTask(
      'expired_facts_cleanup',
      this.config.expiredFactsCleanupIntervalMs,
      () => this.runExpiredFactsCleanup()
    );

    console.log(`[MemoryScheduler] Scheduler started with ${this.tasks.size} tasks`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    console.log('[MemoryScheduler] Stopping scheduler...');

    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
      console.log(`[MemoryScheduler] Stopped task: ${name}`);
    }

    this.intervals.clear();
    console.log('[MemoryScheduler] Scheduler stopped');
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const tasks = Array.from(this.tasks.values());
    const totalRuns = tasks.reduce((sum, task) => sum + task.runCount, 0);
    const totalErrors = tasks.reduce((sum, task) => sum + task.errorCount, 0);

    return {
      uptime: Date.now() - this.startTime.getTime(),
      tasks,
      totalRuns,
      totalErrors,
    };
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(taskName: string): Promise<void> {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task not found: ${taskName}`);
    }

    if (task.running) {
      throw new Error(`Task already running: ${taskName}`);
    }

    console.log(`[MemoryScheduler] Manually triggering task: ${taskName}`);

    switch (taskName) {
      case 'consolidation':
        await this.runConsolidationForAllUsers();
        break;
      case 'cache_cleanup':
        await this.runCacheCleanup();
        break;
      case 'importance_update':
        await this.runImportanceUpdates();
        break;
      case 'expired_facts_cleanup':
        await this.runExpiredFactsCleanup();
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }

  /**
   * Update task interval
   */
  updateTaskInterval(taskName: string, intervalMs: number): void {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task not found: ${taskName}`);
    }

    // Clear existing interval
    const interval = this.intervals.get(taskName);
    if (interval) {
      clearInterval(interval);
    }

    // Update task
    task.intervalMs = intervalMs;
    task.nextRun = new Date(Date.now() + intervalMs);

    // Reschedule
    const handler = this.getTaskHandler(taskName);
    if (handler) {
      this.scheduleTask(taskName, intervalMs, handler);
    }

    console.log(`[MemoryScheduler] Updated interval for ${taskName}: ${intervalMs}ms`);
  }

  // ==========================================================================
  // Private Task Handlers
  // ==========================================================================

  /**
   * Run consolidation for all users
   */
  private async runConsolidationForAllUsers(): Promise<void> {
    console.log('[MemoryScheduler] Running consolidation for all users...');

    try {
      // Get users that need consolidation
      const result = await this.db.query(`
        SELECT DISTINCT uic.user_id
        FROM user_indexing_config uic
        JOIN indexed_sessions ise ON uic.user_id = ise.user_id
        WHERE uic.consolidate_on_index = true
          AND ise.consolidation_status = 'pending'
          AND (
            uic.last_consolidation_at IS NULL
            OR uic.last_consolidation_at < NOW() - (uic.consolidation_interval_hours || ' hours')::interval
          )
      `);

      const userIds = result.rows.map(row => row.user_id);
      console.log(`[MemoryScheduler] Found ${userIds.length} users for consolidation`);

      for (const userId of userIds) {
        try {
          const result = await this.memoryConsolidator.consolidate({
            userId,
            updateMemoryFile: true,
            minConfidence: 0.6,
            deduplicateFacts: true,
          });

          console.log(
            `[MemoryScheduler] Consolidated user ${userId}: ${result.factsStored} facts stored`
          );
        } catch (error) {
          console.error(`[MemoryScheduler] Error consolidating user ${userId}:`, error);
          // Continue with other users
        }

        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[MemoryScheduler] Consolidation complete for ${userIds.length} users`);
    } catch (error) {
      console.error('[MemoryScheduler] Consolidation task error:', error);
      throw error;
    }
  }

  /**
   * Run cache cleanup
   */
  private async runCacheCleanup(): Promise<void> {
    console.log('[MemoryScheduler] Running cache cleanup...');

    try {
      const deletedCount = await this.memoryService.cleanupCache(50000);
      console.log(`[MemoryScheduler] Cache cleanup: deleted ${deletedCount} old entries`);
    } catch (error) {
      console.error('[MemoryScheduler] Cache cleanup error:', error);
      throw error;
    }
  }

  /**
   * Run importance score updates for all users
   */
  private async runImportanceUpdates(): Promise<void> {
    console.log('[MemoryScheduler] Running importance score updates...');

    try {
      // Get all users with facts
      const result = await this.db.query(`
        SELECT DISTINCT user_id
        FROM memory_facts
      `);

      const userIds = result.rows.map(row => row.user_id);
      let totalUpdated = 0;

      for (const userId of userIds) {
        try {
          const updated = await this.memoryConsolidator.updateImportanceScores(userId);
          totalUpdated += updated;
        } catch (error) {
          console.error(`[MemoryScheduler] Error updating importance for user ${userId}:`, error);
          // Continue with other users
        }
      }

      console.log(
        `[MemoryScheduler] Importance updates complete: ${totalUpdated} facts updated`
      );
    } catch (error) {
      console.error('[MemoryScheduler] Importance update error:', error);
      throw error;
    }
  }

  /**
   * Run expired facts cleanup
   */
  private async runExpiredFactsCleanup(): Promise<void> {
    console.log('[MemoryScheduler] Running expired facts cleanup...');

    try {
      const result = await this.db.query(`SELECT expire_old_facts()`);
      const deletedCount = result.rows[0].expire_old_facts;
      console.log(`[MemoryScheduler] Expired facts cleanup: deleted ${deletedCount} facts`);
    } catch (error) {
      console.error('[MemoryScheduler] Expired facts cleanup error:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Scheduling Methods
  // ==========================================================================

  /**
   * Schedule a task
   */
  private scheduleTask(
    name: string,
    intervalMs: number,
    handler: () => Promise<void>
  ): void {
    // Create task record
    const task: ScheduledTask = {
      name,
      intervalMs,
      nextRun: new Date(Date.now() + intervalMs),
      running: false,
      runCount: 0,
      errorCount: 0,
    };

    this.tasks.set(name, task);

    // Wrap handler with error handling and stats
    const wrappedHandler = async () => {
      if (task.running) {
        console.log(`[MemoryScheduler] Task ${name} already running, skipping`);
        return;
      }

      task.running = true;
      task.lastRun = new Date();

      try {
        await handler();
        task.runCount++;
      } catch (error) {
        task.errorCount++;
        console.error(`[MemoryScheduler] Task ${name} failed:`, error);
      } finally {
        task.running = false;
        task.nextRun = new Date(Date.now() + intervalMs);
      }
    };

    // Schedule interval
    const interval = setInterval(wrappedHandler, intervalMs);
    this.intervals.set(name, interval);

    // Run immediately on startup (optional)
    // wrappedHandler();

    console.log(`[MemoryScheduler] Scheduled task: ${name} (every ${intervalMs}ms)`);
  }

  /**
   * Get task handler function
   */
  private getTaskHandler(taskName: string): (() => Promise<void>) | null {
    switch (taskName) {
      case 'consolidation':
        return () => this.runConsolidationForAllUsers();
      case 'cache_cleanup':
        return () => this.runCacheCleanup();
      case 'importance_update':
        return () => this.runImportanceUpdates();
      case 'expired_facts_cleanup':
        return () => this.runExpiredFactsCleanup();
      default:
        return null;
    }
  }
}
