/**
 * Agent Task Worker
 *
 * BullMQ worker that processes agent tasks from the queue
 */

import { Worker, Job } from 'bullmq';
import { redisConfig } from './redis';
import { QUEUE_NAMES, AgentTaskJob } from './agent-queue';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';
import { AgentTask, AgentConfig } from '@/lib/agent/types';

/**
 * Process an agent task job
 */
async function processAgentTask(job: Job<AgentTaskJob>) {
  const { taskId, userId } = job.data;

  console.log(`[Worker] Processing task ${taskId} for user ${userId}`);

  // Update job progress
  await job.updateProgress(10);

  try {
    // Fetch task from database
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Verify task belongs to user
    if (task.userId !== userId) {
      throw new Error(`Task ${taskId} does not belong to user ${userId}`);
    }

    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'planning',
        startedAt: new Date(),
      },
    });

    await job.updateProgress(20);

    // Build agent configuration
    const agentConfig: AgentConfig = (task.agentConfig as any) || {
      model: task.agentModel || 'claude-sonnet-4-5-20250929',
      maxSteps: 20,
      timeout: 300000, // 5 minutes
      retryCount: 3,
    };

    // Build agent task
    const agentTask: AgentTask = {
      id: task.id,
      userId: task.userId,
      type: task.agentType as any,
      goal: task.description || task.title,
      config: agentConfig,
      createdAt: task.createdAt,
    };

    // Create executor
    const executor = new AgentExecutor(task.agentType as any, agentConfig, toolRegistry);

    await job.updateProgress(30);

    // Create execution plan
    console.log(`[Worker] Creating plan for task ${taskId}`);
    const plan = await executor.plan(agentTask);

    // Save plan to database
    await prisma.task.update({
      where: { id: taskId },
      data: {
        plan: plan as any,
        totalSteps: plan.totalSteps,
        status: 'executing',
      },
    });

    await job.updateProgress(40);

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const creditsNeeded = plan.estimatedCredits;
    if (user.creditsUsed + creditsNeeded > user.monthlyCredits) {
      throw new Error(
        `Insufficient credits: need ${creditsNeeded}, available ${
          user.monthlyCredits - user.creditsUsed
        }`
      );
    }

    await job.updateProgress(50);

    // Execute plan
    console.log(`[Worker] Executing task ${taskId} with ${plan.totalSteps} steps`);

    // Set up progress updates
    executor.onEvent((event) => {
      if (event.type === 'task.step.completed') {
        const progress = 50 + ((event.stepNumber / plan.totalSteps) * 40);
        job.updateProgress(Math.round(progress));
      }
    });

    const result = await executor.execute(agentTask, plan);

    await job.updateProgress(100);

    // Result is already saved to database by executor
    console.log(`[Worker] Task ${taskId} completed with status: ${result.status}`);

    // Notify user if configured
    await notifyUserOfCompletion(userId, task, result);

    return {
      success: true,
      taskId,
      status: result.status,
      creditsUsed: result.creditsUsed,
      duration: result.duration,
    };

  } catch (error: any) {
    console.error(`[Worker] Task ${taskId} failed:`, error);

    // Update task status in database
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error: error.message,
        failedAt: new Date(),
      },
    });

    // Notify user of failure
    await notifyUserOfFailure(userId, taskId, error.message);

    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Notify user of task completion
 */
async function notifyUserOfCompletion(userId: string, task: any, result: any) {
  try {
    // TODO: Send email notification
    // TODO: Send webhook if configured
    // TODO: Create in-app notification

    console.log(`[Worker] User ${userId} notified of task completion`);
  } catch (error) {
    console.error('[Worker] Failed to notify user:', error);
  }
}

/**
 * Notify user of task failure
 */
async function notifyUserOfFailure(userId: string, taskId: string, errorMessage: string) {
  try {
    // TODO: Send email notification
    // TODO: Send webhook if configured
    // TODO: Create in-app notification

    console.log(`[Worker] User ${userId} notified of task failure`);
  } catch (error) {
    console.error('[Worker] Failed to notify user of failure:', error);
  }
}

/**
 * Create and start the worker
 */
export function createAgentWorker() {
  const worker = new Worker<AgentTaskJob>(
    QUEUE_NAMES.AGENT_TASKS,
    processAgentTask,
    {
      connection: redisConfig,
      concurrency: parseInt(process.env.AGENT_WORKER_CONCURRENCY || '5'), // Process up to 5 tasks concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // per minute
      },
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Worker completed job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Worker failed job ${job?.id}:`, error);
  });

  worker.on('error', (error) => {
    console.error('❌ Worker error:', error);
  });

  console.log('🚀 Agent worker started with concurrency:', worker.opts.concurrency);

  return worker;
}

// Export singleton worker instance
let workerInstance: Worker | null = null;

export function getAgentWorker(): Worker {
  if (!workerInstance) {
    workerInstance = createAgentWorker();
  }
  return workerInstance;
}

export async function closeAgentWorker() {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log('👋 Agent worker closed');
  }
}
