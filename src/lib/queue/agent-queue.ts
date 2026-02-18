/**
 * Agent Task Queue with Graceful Degradation
 *
 * BullMQ queue for processing autonomous agent tasks.
 * Falls back to direct execution when Redis is unavailable.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConfig, isRedisAvailable } from './redis';
import { captureMessage } from '@/lib/sentry';

// Queue names
export const QUEUE_NAMES = {
  AGENT_TASKS: 'agent-tasks',
  SCHEDULED_TASKS: 'scheduled-tasks',
} as const;

/**
 * Job data for agent task execution
 */
export interface AgentTaskJob {
  taskId: string;
  userId: string;
  priority?: number;
  retryCount?: number;
}

/**
 * Agent task queue (lazy initialization)
 */
let agentQueue: Queue<AgentTaskJob> | null = null;
let agentQueueEvents: QueueEvents | null = null;
let queueInitialized = false;
let queueInitError: Error | null = null;

/**
 * Initialize queue (only if Redis is available)
 */
function initializeQueue(): void {
  if (queueInitialized || queueInitError) {
    return;
  }

  // Skip in build environment
  if (process.env.CI || process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('⏭️  Queue: Skipping initialization in build environment');
    queueInitialized = true;
    return;
  }

  try {
    agentQueue = new Queue<AgentTaskJob>(QUEUE_NAMES.AGENT_TASKS, {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 5000, // Keep max 5000 failed jobs
        },
      },
    });

    agentQueueEvents = new QueueEvents(QUEUE_NAMES.AGENT_TASKS, {
      connection: redisConfig,
    });

    // Event listeners
    agentQueueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`✅ Job ${jobId} completed successfully`);
    });

    agentQueueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ Job ${jobId} failed:`, failedReason);
    });

    agentQueueEvents.on('progress', ({ jobId, data }) => {
      console.log(`📊 Job ${jobId} progress:`, data);
    });

    queueInitialized = true;
    console.log('✅ Agent queue initialized');
  } catch (error: any) {
    console.warn('⚠️  Failed to initialize queue:', error.message);
    queueInitError = error;
    queueInitialized = true; // Mark as initialized to prevent retries

    // Track in Sentry (only in production)
    if (process.env.NODE_ENV === 'production') {
      captureMessage(`Failed to initialize agent queue: ${error.message}`, 'warning');
    }
  }
}

/**
 * Get queue instance (lazy init)
 */
function getQueue(): Queue<AgentTaskJob> | null {
  if (!queueInitialized) {
    initializeQueue();
  }
  return agentQueue;
}

/**
 * Check if queue is available
 */
export function isQueueAvailable(): boolean {
  return isRedisAvailable() && getQueue() !== null;
}

/**
 * Add task to queue (with graceful degradation)
 */
export async function queueAgentTask(
  taskId: string,
  userId: string,
  options?: {
    priority?: number;
    delay?: number;
    retryCount?: number;
  }
): Promise<string> {
  const queue = getQueue();

  // Graceful degradation: If queue unavailable, return task ID as fallback
  if (!queue) {
    console.warn(
      `⚠️  Queue unavailable - task ${taskId} will need manual execution or direct processing`
    );

    // In production, track this
    if (process.env.NODE_ENV === 'production') {
      captureMessage(
        `Agent task queued without Redis: ${taskId}`,
        'warning',
        { taskId, userId }
      );
    }

    // Return a pseudo job ID
    return `fallback-${taskId}`;
  }

  try {
    const job = await queue.add(
      'execute',
      {
        taskId,
        userId,
        priority: options?.priority,
        retryCount: options?.retryCount,
      },
      {
        priority: options?.priority || 1,
        delay: options?.delay,
        attempts: options?.retryCount || 3,
      }
    );

    console.log(`🎯 Queued agent task: ${taskId} (Job ID: ${job.id})`);

    return job.id!;
  } catch (error: any) {
    console.error(`❌ Failed to queue task ${taskId}:`, error.message);

    // Track in Sentry (only in production)
    if (process.env.NODE_ENV === 'production') {
      captureMessage(
        `Failed to queue agent task: ${error.message}`,
        'error',
        { taskId, userId, error: error.message }
      );
    }

    // Return fallback
    return `error-${taskId}`;
  }
}

/**
 * Get queue statistics (with graceful degradation)
 */
export async function getQueueStats() {
  const queue = getQueue();

  if (!queue) {
    console.warn('⚠️  Queue unavailable - returning zero stats');
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
      available: false,
    };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      available: true,
    };
  } catch (error: any) {
    console.error('❌ Failed to get queue stats:', error.message);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
      available: false,
      error: error.message,
    };
  }
}

/**
 * Clean up old jobs (with graceful degradation)
 */
export async function cleanQueue() {
  const queue = getQueue();

  if (!queue) {
    console.warn('⚠️  Queue unavailable - cannot clean');
    return;
  }

  try {
    await queue.clean(86400000, 1000, 'completed'); // 24 hours
    await queue.clean(604800000, 5000, 'failed'); // 7 days
    console.log('🧹 Queue cleaned');
  } catch (error: any) {
    console.error('❌ Failed to clean queue:', error.message);
  }
}

/**
 * Pause queue (with graceful degradation)
 */
export async function pauseQueue() {
  const queue = getQueue();

  if (!queue) {
    console.warn('⚠️  Queue unavailable - cannot pause');
    return;
  }

  try {
    await queue.pause();
    console.log('⏸️  Queue paused');
  } catch (error: any) {
    console.error('❌ Failed to pause queue:', error.message);
  }
}

/**
 * Resume queue (with graceful degradation)
 */
export async function resumeQueue() {
  const queue = getQueue();

  if (!queue) {
    console.warn('⚠️  Queue unavailable - cannot resume');
    return;
  }

  try {
    await queue.resume();
    console.log('▶️  Queue resumed');
  } catch (error: any) {
    console.error('❌ Failed to resume queue:', error.message);
  }
}

/**
 * Close queue connections (with graceful degradation)
 */
export async function closeQueue() {
  if (agentQueue) {
    try {
      await agentQueue.close();
    } catch (error: any) {
      console.error('❌ Failed to close queue:', error.message);
    }
  }

  if (agentQueueEvents) {
    try {
      await agentQueueEvents.close();
    } catch (error: any) {
      console.error('❌ Failed to close queue events:', error.message);
    }
  }

  console.log('👋 Queue closed');
}
