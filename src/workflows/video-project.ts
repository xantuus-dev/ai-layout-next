/**
 * Video project pipeline, as a durable workflow.
 *
 * Replaces the BullMQ worker in src/lib/video-pipeline/worker.ts, which could
 * never run in this deployment: a BullMQ Worker is a long-lived process, and
 * this app is on Vercel serverless. There was no worker start script, no
 * container target, and no Redis configured — so the pipeline existed as code
 * but was unreachable. Workflow runs the orchestration durably on the same
 * serverless deployment, with no Redis and no second service to operate.
 *
 * Shape: the `"use workflow"` function below only sequences steps. Every piece
 * of real work (database, model calls, refunds) is a `"use step"` function,
 * which runs with full Node.js access, is retried on failure, and has its
 * result persisted so a replay does not repeat it.
 *
 * What this buys over the queue version, beyond actually running:
 *  - Per-scene retry. A flaky Veo or ElevenLabs call retries that one scene
 *    instead of failing and refunding the whole project.
 *  - Crash survival. A deploy or timeout mid-generation resumes where it left
 *    off rather than losing the run.
 *
 * Scene state lives in VideoProject.scenes and each step reads and writes it
 * directly, rather than passing the array through workflow state. That keeps
 * the original invariant — one worker owns the scenes JSON at a time, so no
 * read-modify-write race — and keeps step payloads small.
 */

import { FatalError } from 'workflow';
import { prisma } from '@/lib/prisma';
import { breakdownConcept } from '@/lib/video-pipeline/scene-breakdown';
import { veoVideoService } from '@/lib/video-generation';
import type { VeoAspectRatio } from '@/lib/video-generation';
import { elevenLabsAudioService } from '@/lib/audio-generation';
import { refundCredits } from '@/lib/billing/gate';
import type { SceneSpec, VideoProjectStatus } from '@/lib/video-pipeline/types';

/** The subset of a VideoProject the workflow needs, all JSON-serialisable. */
interface ProjectSnapshot {
  concept: string;
  aspectRatio: string;
  targetDurationSeconds: number;
  creditsUsed: number;
  sceneCount: number;
}

function readScenes(value: unknown): SceneSpec[] {
  return Array.isArray(value) ? (value as unknown as SceneSpec[]) : [];
}

/**
 * Load the project and confirm it belongs to the caller.
 *
 * Both failures are FatalError: a missing row or a mismatched owner will never
 * become true on retry, and retrying an ownership failure is pure noise.
 */
async function loadProject(
  projectId: string,
  userId: string
): Promise<ProjectSnapshot> {
  'use step';

  const project = await prisma.videoProject.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new FatalError(`VideoProject not found: ${projectId}`);
  }
  if (project.userId !== userId) {
    throw new FatalError(
      `VideoProject ${projectId} does not belong to user ${userId}`
    );
  }

  console.log(`[video-project ${projectId}] loaded, status=${project.status}`);

  return {
    concept: project.concept,
    aspectRatio: project.aspectRatio,
    targetDurationSeconds: project.targetDurationSeconds,
    creditsUsed: project.creditsUsed,
    sceneCount: readScenes(project.scenes).length,
  };
}

async function setStatus(
  projectId: string,
  status: VideoProjectStatus
): Promise<void> {
  'use step';

  await prisma.videoProject.update({
    where: { id: projectId },
    data: { status },
  });
  console.log(`[video-project ${projectId}] status -> ${status}`);
}

/**
 * Turn the concept into scenes and persist them.
 *
 * Returns only the count: the scenes themselves stay in the database, and the
 * workflow needs nothing more than how many times to loop.
 */
async function planScenes(
  projectId: string,
  project: ProjectSnapshot
): Promise<number> {
  'use step';

  const scenes = await breakdownConcept({
    concept: project.concept,
    targetDurationSeconds: project.targetDurationSeconds,
    aspectRatio: project.aspectRatio as VeoAspectRatio,
  });

  await prisma.videoProject.update({
    where: { id: projectId },
    data: { scenes: scenes as any },
  });

  console.log(`[video-project ${projectId}] planned ${scenes.length} scene(s)`);
  return scenes.length;
}

/**
 * Generate one scene's clip and voiceover.
 *
 * Retried independently by the runtime, so a transient provider failure costs
 * one scene rather than the run. Already-completed scenes return immediately,
 * which is what makes that retry safe: the expensive calls are not repeated.
 */
async function generateScene(
  projectId: string,
  userId: string,
  index: number,
  aspectRatio: string
): Promise<void> {
  'use step';

  const project = await prisma.videoProject.findUnique({
    where: { id: projectId },
    select: { scenes: true },
  });

  const scenes = readScenes(project?.scenes);
  const scene = scenes[index];

  if (!scene) {
    throw new FatalError(`Scene ${index} missing from project ${projectId}`);
  }
  if (scene.status === 'done') {
    console.log(`[video-project ${projectId}] scene ${index + 1} already done`);
    return;
  }

  const save = async (next: SceneSpec) => {
    scenes[index] = next;
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { scenes: scenes as any },
    });
  };

  await save({ ...scene, status: 'generating' });

  const [videoOutcome, audioOutcome] = await Promise.allSettled([
    veoVideoService.generateVideo({
      prompt: scene.veoPrompt,
      aspectRatio: aspectRatio as VeoAspectRatio,
      durationSeconds: scene.durationSeconds,
      userId,
    }),
    elevenLabsAudioService.generateSpeech({
      text: scene.voiceoverText,
      userId,
    }),
  ]);

  // Keep whichever call succeeded even when the other failed: that spend has
  // already happened, so the URL is worth retaining for a retry or for support,
  // rather than being discarded.
  const clipUrl =
    videoOutcome.status === 'fulfilled'
      ? videoOutcome.value.videoUrl
      : scene.clipUrl;
  const audioUrl =
    audioOutcome.status === 'fulfilled'
      ? audioOutcome.value.audioUrl
      : scene.audioUrl;

  if (videoOutcome.status === 'rejected' || audioOutcome.status === 'rejected') {
    await save({ ...scene, status: 'failed', clipUrl, audioUrl });

    const reason: unknown =
      videoOutcome.status === 'rejected'
        ? videoOutcome.reason
        : (audioOutcome as PromiseRejectedResult).reason;

    throw reason instanceof Error
      ? reason
      : new Error(`Scene ${index + 1} generation failed`);
  }

  await save({ ...scene, status: 'done', clipUrl, audioUrl });
  console.log(`[video-project ${projectId}] scene ${index + 1} done`);
}

/**
 * Assemble the finished video.
 *
 * Still the placeholder behaviour from the queue implementation — it returns
 * the first completed clip rather than a real cut. The open question that
 * blocked it ("is ffmpeg available in the Vercel Sandbox runtime") has since
 * been answered: it is not preinstalled and not in the Amazon Linux 2023 dnf
 * repos, but `dnf install xz` plus the BtbN static build yields a working
 * ffmpeg, and concat + audio mux both succeed there. Snapshot
 * snap_3GzTGm3JpSaLX2bfRfqthXwFQPSQ boots with it already installed.
 *
 * Real stitching is deliberately left to its own change: it needs a
 * network-permitted sandbox to fetch the clips, whereas the skill runner is
 * pinned to deny-all.
 */
async function stitchProject(projectId: string): Promise<string> {
  'use step';

  const project = await prisma.videoProject.findUnique({
    where: { id: projectId },
    select: { scenes: true },
  });

  const firstClip = readScenes(project?.scenes).find(
    (scene) => scene.status === 'done' && scene.clipUrl
  )?.clipUrl;

  if (!firstClip) {
    throw new FatalError('No completed scene clips available to stitch');
  }

  console.log(`[video-project ${projectId}] stitched (placeholder)`);
  return firstClip;
}

async function completeProject(
  projectId: string,
  finalVideoUrl: string
): Promise<void> {
  'use step';

  await prisma.videoProject.update({
    where: { id: projectId },
    data: { status: 'completed', finalVideoUrl, completedAt: new Date() },
  });
  console.log(`[video-project ${projectId}] completed`);
}

/**
 * Mark the project failed and refund the unearned portion of the upfront
 * charge, proportional to how many scenes never completed.
 *
 * A refund failure is logged rather than thrown: the run has already failed,
 * and turning a refund problem into a step failure would retry the whole
 * terminal path and could double-refund.
 */
async function failProject(
  projectId: string,
  userId: string,
  message: string
): Promise<void> {
  'use step';

  const project = await prisma.videoProject.update({
    where: { id: projectId },
    data: { status: 'failed', error: message },
    select: { creditsUsed: true, scenes: true },
  });

  const scenes = readScenes(project.scenes);
  const scenesCompleted = scenes.filter((scene) => scene.status === 'done').length;
  const scenesPlanned = scenes.length || 1;
  const refundFraction =
    scenesCompleted === 0 ? 1 : (scenesPlanned - scenesCompleted) / scenesPlanned;
  const refundAmount = Math.floor(project.creditsUsed * refundFraction);

  console.error(`[video-project ${projectId}] failed: ${message}`);

  if (refundAmount > 0) {
    try {
      await refundCredits(userId, refundAmount, 'run_failed', {
        runId: projectId,
        description: message,
      });
      console.log(`[video-project ${projectId}] refunded ${refundAmount} credits`);
    } catch (refundError) {
      console.error(
        `[video-project ${projectId}] refund failed:`,
        refundError
      );
    }
  }
}

/**
 * Concept -> scenes -> per-scene clip and voiceover -> assembled video.
 *
 * Orchestration only: no I/O, no Date.now(), no randomness, so replay is
 * deterministic.
 */
export async function videoProjectWorkflow(projectId: string, userId: string) {
  'use workflow';

  const project = await loadProject(projectId, userId);

  try {
    // Resume-friendly: a run that already produced scenes skips scripting
    // rather than paying for the breakdown twice.
    let sceneCount = project.sceneCount;

    if (sceneCount === 0) {
      await setStatus(projectId, 'scripting');
      sceneCount = await planScenes(projectId, project);
    }

    await setStatus(projectId, 'generating');

    for (let index = 0; index < sceneCount; index++) {
      await generateScene(projectId, userId, index, project.aspectRatio);
    }

    await setStatus(projectId, 'stitching');
    const finalVideoUrl = await stitchProject(projectId);
    await completeProject(projectId, finalVideoUrl);

    return { finalVideoUrl };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Video pipeline failed';
    await failProject(projectId, userId, message);
    throw error;
  }
}
