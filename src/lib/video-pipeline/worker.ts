/**
 * Video Pipeline Worker
 *
 * BullMQ worker that runs a VideoProject through scripting -> per-scene
 * generation -> stitching. Mirrors src/lib/queue/agent-worker.ts's shape
 * (load row, verify ownership, update status per stage, refund on failure).
 *
 * `processVideoPipelineJob` is exported standalone (not just wired into the
 * Worker) so it can be driven directly in tests without a live queue/Redis.
 *
 * NOTE ON CREDITS: this worker does not charge credits itself - it expects
 * `project.creditsUsed` to already reflect an upfront charge made by whatever
 * created the row (a future API route; for now, tests set it directly). On
 * failure, the refund is computed as a fraction of that already-charged
 * amount, proportional to how many scenes never completed.
 */

import { Worker, Job } from 'bullmq';
import { redisConfig } from '@/lib/queue/redis';
import { prisma } from '@/lib/prisma';
import { breakdownConcept } from './scene-breakdown';
import { veoVideoService } from '@/lib/video-generation';
import type { VeoAspectRatio } from '@/lib/video-generation';
import { elevenLabsAudioService } from '@/lib/audio-generation';
import { refundCredits } from '@/lib/billing/gate';
import { VIDEO_PIPELINE_QUEUE_NAME } from './queue';
import type { SceneSpec, VideoPipelineJob, VideoProjectStatus } from './types';

/**
 * Stitch stub for this pass: real ffmpeg-in-sandbox stitching is a follow-up
 * (ffmpeg availability in the Vercel Sandbox runtime is unverified in this
 * repo). This validates the state machine and progress reporting without
 * depending on that unresolved piece.
 */
async function stitchScenes(scenes: SceneSpec[]): Promise<{ finalVideoUrl: string }> {
  const firstClip = scenes.find((scene) => scene.status === 'done' && scene.clipUrl)?.clipUrl;
  if (!firstClip) {
    throw new Error('No completed scene clips available to stitch');
  }
  return { finalVideoUrl: firstClip };
}

async function setStatus(projectId: string, status: VideoProjectStatus) {
  await prisma.videoProject.update({ where: { id: projectId }, data: { status } });
}

async function saveScenes(projectId: string, scenes: SceneSpec[]) {
  await prisma.videoProject.update({ where: { id: projectId }, data: { scenes: scenes as any } });
}

export async function processVideoPipelineJob(
  job: Job<VideoPipelineJob>
): Promise<{ finalVideoUrl: string }> {
  const { projectId, userId } = job.data;

  const project = await prisma.videoProject.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error(`VideoProject not found: ${projectId}`);
  }
  if (project.userId !== userId) {
    throw new Error(`VideoProject ${projectId} does not belong to user ${userId}`);
  }

  let scenes: SceneSpec[] = Array.isArray(project.scenes) ? (project.scenes as unknown as SceneSpec[]) : [];

  try {
    if (scenes.length === 0) {
      await setStatus(projectId, 'scripting');
      scenes = await breakdownConcept({
        concept: project.concept,
        targetDurationSeconds: project.targetDurationSeconds,
        aspectRatio: project.aspectRatio as VeoAspectRatio,
      });
      await saveScenes(projectId, scenes);
      await job.updateProgress(20);
    }

    await setStatus(projectId, 'generating');
    for (let i = 0; i < scenes.length; i++) {
      scenes[i] = { ...scenes[i], status: 'generating' };
      await saveScenes(projectId, scenes);

      const [videoOutcome, audioOutcome] = await Promise.allSettled([
        veoVideoService.generateVideo({
          prompt: scenes[i].veoPrompt,
          aspectRatio: project.aspectRatio as VeoAspectRatio,
          durationSeconds: scenes[i].durationSeconds,
          userId,
        }),
        elevenLabsAudioService.generateSpeech({ text: scenes[i].voiceoverText, userId }),
      ]);

      // Record whichever call succeeded even if the scene overall fails -
      // that spend already happened, so the URL is worth keeping for support
      // or a future manual-retry path, rather than discarding it.
      const clipUrl = videoOutcome.status === 'fulfilled' ? videoOutcome.value.videoUrl : scenes[i].clipUrl;
      const audioUrl = audioOutcome.status === 'fulfilled' ? audioOutcome.value.audioUrl : scenes[i].audioUrl;

      if (videoOutcome.status === 'rejected' || audioOutcome.status === 'rejected') {
        scenes[i] = { ...scenes[i], status: 'failed', clipUrl, audioUrl };
        await saveScenes(projectId, scenes);
        const reason: unknown =
          videoOutcome.status === 'rejected' ? videoOutcome.reason : (audioOutcome as PromiseRejectedResult).reason;
        throw reason instanceof Error ? reason : new Error(`Scene ${i + 1} generation failed`);
      }

      scenes[i] = { ...scenes[i], status: 'done', clipUrl, audioUrl };
      await saveScenes(projectId, scenes);
      await job.updateProgress(20 + Math.round(((i + 1) / scenes.length) * 60));
    }

    await setStatus(projectId, 'stitching');
    const { finalVideoUrl } = await stitchScenes(scenes);
    await job.updateProgress(100);

    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'completed', finalVideoUrl, completedAt: new Date() },
    });

    return { finalVideoUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video pipeline failed';
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'failed', error: message },
    });

    const scenesCompleted = scenes.filter((scene) => scene.status === 'done').length;
    const scenesPlanned = scenes.length || 1;
    const refundFraction = scenesCompleted === 0 ? 1 : (scenesPlanned - scenesCompleted) / scenesPlanned;
    const refundAmount = Math.floor(project.creditsUsed * refundFraction);

    if (refundAmount > 0) {
      try {
        await refundCredits(userId, refundAmount, 'run_failed', { runId: projectId, description: message });
      } catch (refundError) {
        console.error(`Failed to refund credits for video project ${projectId}:`, refundError);
      }
    }

    throw error;
  }
}

let workerInstance: Worker<VideoPipelineJob> | null = null;

export function getVideoPipelineWorker(): Worker<VideoPipelineJob> {
  if (!workerInstance) {
    workerInstance = new Worker<VideoPipelineJob>(VIDEO_PIPELINE_QUEUE_NAME, processVideoPipelineJob, {
      connection: redisConfig,
      concurrency: parseInt(process.env.VIDEO_PIPELINE_WORKER_CONCURRENCY || '2'),
    });

    workerInstance.on('completed', (job) => console.log(`✅ Video pipeline job ${job.id} completed`));
    workerInstance.on('failed', (job, error) => console.error(`❌ Video pipeline job ${job?.id} failed:`, error));
    workerInstance.on('error', (error) => console.error('❌ Video pipeline worker error:', error));

    console.log('🎬 Video pipeline worker started');
  }
  return workerInstance;
}

export async function closeVideoPipelineWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log('👋 Video pipeline worker closed');
  }
}
