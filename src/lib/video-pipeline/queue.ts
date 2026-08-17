/**
 * Video Pipeline Task Queue
 *
 * BullMQ queue for concept-to-video pipeline jobs. Mirrors
 * src/lib/queue/agent-queue.ts's lazy-init/graceful-degradation shape and
 * shares the same Redis connection config, rather than opening a second
 * connection.
 */

import { Queue } from 'bullmq';
import { redisConfig, isRedisAvailable } from '@/lib/queue/redis';
import type { VideoPipelineJob } from './types';

export const VIDEO_PIPELINE_QUEUE_NAME = 'video-pipeline';

let pipelineQueue: Queue<VideoPipelineJob> | null = null;
let queueInitialized = false;

function initializeQueue(): void {
  if (queueInitialized) {
    return;
  }

  if (process.env.CI || process.env.NEXT_PHASE === 'phase-production-build') {
    queueInitialized = true;
    return;
  }

  try {
    pipelineQueue = new Queue<VideoPipelineJob>(VIDEO_PIPELINE_QUEUE_NAME, {
      connection: redisConfig,
      defaultJobOptions: {
        // Not retried automatically: a failed pipeline run already refunds
        // unspent credits and marks the project 'failed' (see worker.ts) -
        // an automatic retry would re-run paid Veo/ElevenLabs/sandbox work
        // without the user asking for it.
        attempts: 1,
        removeOnComplete: { age: 86400, count: 500 },
        removeOnFail: { age: 604800, count: 1000 },
      },
    });
    queueInitialized = true;
    console.log('✅ Video pipeline queue initialized');
  } catch (error: any) {
    console.warn('⚠️  Failed to initialize video pipeline queue:', error.message);
    queueInitialized = true;
  }
}

function getQueue(): Queue<VideoPipelineJob> | null {
  if (!queueInitialized) {
    initializeQueue();
  }
  return pipelineQueue;
}

export function isVideoPipelineQueueAvailable(): boolean {
  return isRedisAvailable() && getQueue() !== null;
}

/**
 * Enqueue a pipeline run. Caller (the API route) has already created the
 * VideoProject row and charged credits - this just schedules the worker to
 * pick it up. Graceful degradation matches queueAgentTask: if Redis is
 * unavailable, the project stays in the database with status 'queued' and
 * needs manual/direct processing rather than crashing the request.
 */
export async function queueVideoPipelineJob(projectId: string, userId: string): Promise<string> {
  const queue = getQueue();

  if (!queue) {
    console.warn(`⚠️  Video pipeline queue unavailable - project ${projectId} left queued`);
    return `fallback-${projectId}`;
  }

  try {
    const job = await queue.add('process', { projectId, userId });
    return job.id!;
  } catch (error: any) {
    console.error(`❌ Failed to queue video pipeline job for project ${projectId}:`, error.message);
    return `error-${projectId}`;
  }
}

export async function closeVideoPipelineQueue(): Promise<void> {
  if (pipelineQueue) {
    await pipelineQueue.close();
    pipelineQueue = null;
  }
}
