/**
 * Agent Task Queue
 *
 * BullMQ queue for processing autonomous agent tasks
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConfig } from './redis';

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
 * Agent task queue
 */
export const agentQueue = new Queue<AgentTaskJob>(QUEUE_NAMES.AGENT_TASKS, {
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

/**
 * Queue events for monitoring
 */
export const agentQueueEvents = new QueueEvents(QUEUE_NAMES.AGENT_TASKS, {
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

/**
 * Add task to queue
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
  const job = await agentQueue.add(
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
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    agentQueue.getWaitingCount(),
    agentQueue.getActiveCount(),
    agentQueue.getCompletedCount(),
    agentQueue.getFailedCount(),
    agentQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clean up old jobs
 */
export async function cleanQueue() {
  await agentQueue.clean(86400000, 1000, 'completed'); // 24 hours
  await agentQueue.clean(604800000, 5000, 'failed'); // 7 days
  console.log('🧹 Queue cleaned');
}

/**
 * Pause queue
 */
export async function pauseQueue() {
  await agentQueue.pause();
  console.log('⏸️  Queue paused');
}

/**
 * Resume queue
 */
export async function resumeQueue() {
  await agentQueue.resume();
  console.log('▶️  Queue resumed');
}

/**
 * Close queue connections
 */
export async function closeQueue() {
  await agentQueue.close();
  await agentQueueEvents.close();
  console.log('👋 Queue closed');
}
