import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Drives videoProjectWorkflow directly. Outside the Workflow compiler the
 * "use workflow" / "use step" directives are inert string literals, so the
 * orchestration and its steps run as ordinary async functions — which is
 * exactly what we want to assert here: the state machine, the refund
 * arithmetic, and the resume behaviour.
 *
 * Durability itself (retries, replay, crash recovery) is the runtime's job and
 * is not exercised here; that needs @workflow/vitest and a running backend.
 *
 * Ported from video-pipeline-worker.test.ts, which covered the BullMQ worker
 * this replaces. The Prisma mock is stateful rather than returning a fixed
 * row, because the steps deliberately re-read scenes from the database instead
 * of passing the array through workflow state.
 */

const videoProjectFindUnique = vi.fn();
const videoProjectUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    videoProject: {
      findUnique: (...args: unknown[]) => videoProjectFindUnique(...args),
      update: (...args: unknown[]) => videoProjectUpdate(...args),
    },
  },
}));

const breakdownConcept = vi.fn();
vi.mock('@/lib/video-pipeline/scene-breakdown', () => ({
  breakdownConcept: (...args: unknown[]) => breakdownConcept(...args),
}));

const generateVideo = vi.fn();
vi.mock('@/lib/video-generation', () => ({
  veoVideoService: { generateVideo: (...args: unknown[]) => generateVideo(...args) },
}));

const generateSpeech = vi.fn();
vi.mock('@/lib/audio-generation', () => ({
  elevenLabsAudioService: {
    generateSpeech: (...args: unknown[]) => generateSpeech(...args),
  },
}));

const refundCredits = vi.fn();
vi.mock('@/lib/billing/gate', () => ({
  refundCredits: (...args: unknown[]) => refundCredits(...args),
}));

import { videoProjectWorkflow } from '@/workflows/video-project';
import type { SceneSpec } from '@/lib/video-pipeline/types';

/** The row the stateful mock reads from and writes to. */
let row: Record<string, unknown> | null;

function baseProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj_1',
    userId: 'user_1',
    concept: 'A coffee ad',
    status: 'queued',
    aspectRatio: '16:9',
    targetDurationSeconds: 12,
    scenes: [] as SceneSpec[],
    finalVideoUrl: null,
    creditsUsed: 1000,
    error: null,
    ...overrides,
  };
}

function scene(overrides: Partial<SceneSpec> = {}): SceneSpec {
  return {
    order: 0,
    veoPrompt: 'a cup of coffee',
    voiceoverText: 'great coffee',
    durationSeconds: '4',
    status: 'pending',
    ...overrides,
  };
}

/** Every scenes array written to the database, in order. */
function sceneWrites(): SceneSpec[][] {
  return videoProjectUpdate.mock.calls
    .map((call) => (call[0] as any)?.data?.scenes)
    .filter(Boolean) as SceneSpec[][];
}

beforeEach(() => {
  vi.clearAllMocks();
  row = baseProject();

  videoProjectFindUnique.mockImplementation(async () =>
    row ? { ...row } : null
  );
  videoProjectUpdate.mockImplementation(async (args: any) => {
    if (row) Object.assign(row, args.data);
    return { ...row };
  });
});

describe('videoProjectWorkflow', () => {
  it('runs scripting -> generating -> stitching -> completed on the happy path', async () => {
    breakdownConcept.mockResolvedValue([scene({ order: 0 }), scene({ order: 1 })]);
    generateVideo
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-0.mp4' })
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-1.mp4' });
    generateSpeech
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-0.mp3' })
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-1.mp3' });

    const result = await videoProjectWorkflow('proj_1', 'user_1');

    expect(result.finalVideoUrl).toBe('https://blob/clip-0.mp4');
    expect(generateVideo).toHaveBeenCalledTimes(2);
    expect(generateSpeech).toHaveBeenCalledTimes(2);
    expect(refundCredits).not.toHaveBeenCalled();

    expect(row).toMatchObject({
      status: 'completed',
      finalVideoUrl: 'https://blob/clip-0.mp4',
    });
  });

  it('passes through every status in order', async () => {
    breakdownConcept.mockResolvedValue([scene({ order: 0 })]);
    generateVideo.mockResolvedValue({ videoUrl: 'https://blob/clip-0.mp4' });
    generateSpeech.mockResolvedValue({ audioUrl: 'https://blob/audio-0.mp3' });

    await videoProjectWorkflow('proj_1', 'user_1');

    const statuses = videoProjectUpdate.mock.calls
      .map((call) => (call[0] as any)?.data?.status)
      .filter(Boolean);

    expect(statuses).toEqual(['scripting', 'generating', 'stitching', 'completed']);
  });

  it('skips scripting when scenes are already populated', async () => {
    row = baseProject({ scenes: [scene({ order: 0 })] });
    generateVideo.mockResolvedValue({ videoUrl: 'https://blob/clip-0.mp4' });
    generateSpeech.mockResolvedValue({ audioUrl: 'https://blob/audio-0.mp3' });

    await videoProjectWorkflow('proj_1', 'user_1');

    expect(breakdownConcept).not.toHaveBeenCalled();
  });

  // This is what makes per-scene retry safe: a retried step must not re-run
  // the expensive provider calls for work that already succeeded.
  it('does not regenerate a scene that is already done', async () => {
    row = baseProject({
      scenes: [
        scene({ order: 0, status: 'done', clipUrl: 'https://blob/clip-0.mp4' }),
        scene({ order: 1 }),
      ],
    });
    generateVideo.mockResolvedValue({ videoUrl: 'https://blob/clip-1.mp4' });
    generateSpeech.mockResolvedValue({ audioUrl: 'https://blob/audio-1.mp3' });

    await videoProjectWorkflow('proj_1', 'user_1');

    // Only the second, unfinished scene hits the providers.
    expect(generateVideo).toHaveBeenCalledTimes(1);
    expect(generateSpeech).toHaveBeenCalledTimes(1);
  });

  it('throws without touching status or refunds when the caller does not own the project', async () => {
    row = baseProject({ userId: 'someone_else' });

    await expect(videoProjectWorkflow('proj_1', 'user_1')).rejects.toThrow(
      /does not belong to user/
    );

    expect(videoProjectUpdate).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it('throws without refunding when the project does not exist', async () => {
    row = null;

    await expect(videoProjectWorkflow('proj_1', 'user_1')).rejects.toThrow(
      /not found/
    );

    expect(refundCredits).not.toHaveBeenCalled();
  });

  it('refunds the full charge when it fails before any scene completes', async () => {
    row = baseProject({ creditsUsed: 800 });
    breakdownConcept.mockRejectedValue(new Error('model refused to return JSON'));

    await expect(videoProjectWorkflow('proj_1', 'user_1')).rejects.toThrow(
      'model refused to return JSON'
    );

    expect(row).toMatchObject({
      status: 'failed',
      error: 'model refused to return JSON',
    });
    expect(refundCredits).toHaveBeenCalledWith(
      'user_1',
      800,
      'run_failed',
      expect.objectContaining({ runId: 'proj_1' })
    );
  });

  it('refunds proportionally and preserves the successful half of a failed scene', async () => {
    row = baseProject({ creditsUsed: 1000 });
    breakdownConcept.mockResolvedValue([scene({ order: 0 }), scene({ order: 1 })]);
    generateVideo
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-0.mp4' })
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-1.mp4' });
    generateSpeech
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-0.mp3' })
      .mockRejectedValueOnce(new Error('ElevenLabs quota exceeded'));

    await expect(videoProjectWorkflow('proj_1', 'user_1')).rejects.toThrow(
      'ElevenLabs quota exceeded'
    );

    // 1 of 2 scenes completed -> refund half of the 1000 upfront charge.
    expect(refundCredits).toHaveBeenCalledWith(
      'user_1',
      500,
      'run_failed',
      expect.any(Object)
    );

    const lastScenes = sceneWrites().at(-1)!;
    expect(lastScenes[1].status).toBe('failed');
    // The video call for scene 2 succeeded even though its sibling audio call
    // failed — that spend already happened, so the URL must survive.
    expect(lastScenes[1].clipUrl).toBe('https://blob/clip-1.mp4');
  });

  it('does not refund when every scene completed but stitching failed', async () => {
    row = baseProject({ creditsUsed: 1000 });
    breakdownConcept.mockResolvedValue([scene({ order: 0 })]);
    generateVideo.mockResolvedValue({ videoUrl: undefined });
    generateSpeech.mockResolvedValue({ audioUrl: 'https://blob/audio-0.mp3' });

    await expect(videoProjectWorkflow('proj_1', 'user_1')).rejects.toThrow(
      /No completed scene clips/
    );

    // All planned scenes finished, so the proportional refund is zero.
    expect(refundCredits).not.toHaveBeenCalled();
  });
});
