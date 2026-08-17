import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// This test drives processVideoPipelineJob directly (not through a real
// BullMQ queue/Redis) with Prisma, scene breakdown, Veo, ElevenLabs, and the
// credit refund path all mocked - it validates the pipeline's state machine
// and failure/refund arithmetic without needing live API keys or Redis.
// Real Veo/ElevenLabs/Vercel Sandbox behavior is out of scope here; see the
// video pipeline plan for what still needs live credentials to verify.

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
  elevenLabsAudioService: { generateSpeech: (...args: unknown[]) => generateSpeech(...args) },
}));

const refundCredits = vi.fn();
vi.mock('@/lib/billing/gate', () => ({
  refundCredits: (...args: unknown[]) => refundCredits(...args),
}));

import { processVideoPipelineJob } from '@/lib/video-pipeline/worker';
import type { VideoPipelineJob, SceneSpec } from '@/lib/video-pipeline/types';

function fakeJob(data: VideoPipelineJob): Job<VideoPipelineJob> {
  return { data, updateProgress: vi.fn() } as unknown as Job<VideoPipelineJob>;
}

function baseProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj_1',
    userId: 'user_1',
    concept: 'A coffee ad',
    status: 'queued',
    aspectRatio: '16:9',
    targetDurationSeconds: 12,
    scenes: [],
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

beforeEach(() => {
  vi.clearAllMocks();
  videoProjectUpdate.mockResolvedValue({});
});

describe('processVideoPipelineJob', () => {
  it('runs scripting -> generating -> stitching -> completed on the happy path', async () => {
    videoProjectFindUnique.mockResolvedValue(baseProject());
    breakdownConcept.mockResolvedValue([scene({ order: 0 }), scene({ order: 1 })]);
    generateVideo
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-0.mp4', prompt: 'p', durationSeconds: 4 })
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-1.mp4', prompt: 'p', durationSeconds: 4 });
    generateSpeech
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-0.mp3', characterCount: 10, voiceId: 'v1' })
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-1.mp3', characterCount: 10, voiceId: 'v1' });

    const result = await processVideoPipelineJob(fakeJob({ projectId: 'proj_1', userId: 'user_1' }));

    expect(result.finalVideoUrl).toBe('https://blob/clip-0.mp4');
    expect(generateVideo).toHaveBeenCalledTimes(2);
    expect(generateSpeech).toHaveBeenCalledTimes(2);
    expect(refundCredits).not.toHaveBeenCalled();

    const finalUpdate = videoProjectUpdate.mock.calls.at(-1)?.[0];
    expect(finalUpdate.data.status).toBe('completed');
    expect(finalUpdate.data.finalVideoUrl).toBe('https://blob/clip-0.mp4');
  });

  it('skips scripting when scenes are already populated on the project', async () => {
    videoProjectFindUnique.mockResolvedValue(baseProject({ scenes: [scene({ order: 0 })] }));
    generateVideo.mockResolvedValue({ videoUrl: 'https://blob/clip-0.mp4', prompt: 'p', durationSeconds: 4 });
    generateSpeech.mockResolvedValue({ audioUrl: 'https://blob/audio-0.mp3', characterCount: 10, voiceId: 'v1' });

    await processVideoPipelineJob(fakeJob({ projectId: 'proj_1', userId: 'user_1' }));

    expect(breakdownConcept).not.toHaveBeenCalled();
  });

  it('throws without touching status or refunds when the job user does not own the project', async () => {
    videoProjectFindUnique.mockResolvedValue(baseProject({ userId: 'someone_else' }));

    await expect(processVideoPipelineJob(fakeJob({ projectId: 'proj_1', userId: 'user_1' }))).rejects.toThrow(
      /does not belong to user/
    );

    expect(videoProjectUpdate).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it('refunds the full charge when the job fails before any scene completes', async () => {
    videoProjectFindUnique.mockResolvedValue(baseProject({ creditsUsed: 800 }));
    breakdownConcept.mockRejectedValue(new Error('model refused to return JSON'));

    await expect(processVideoPipelineJob(fakeJob({ projectId: 'proj_1', userId: 'user_1' }))).rejects.toThrow(
      'model refused to return JSON'
    );

    const failUpdate = videoProjectUpdate.mock.calls.find((call) => call[0].data.status === 'failed');
    expect(failUpdate?.[0].data.error).toBe('model refused to return JSON');
    expect(refundCredits).toHaveBeenCalledWith('user_1', 800, 'run_failed', expect.objectContaining({ runId: 'proj_1' }));
  });

  it('refunds proportionally and preserves the successful half of a failed scene', async () => {
    videoProjectFindUnique.mockResolvedValue(baseProject({ creditsUsed: 1000 }));
    breakdownConcept.mockResolvedValue([scene({ order: 0 }), scene({ order: 1 })]);
    generateVideo
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-0.mp4', prompt: 'p', durationSeconds: 4 })
      .mockResolvedValueOnce({ videoUrl: 'https://blob/clip-1.mp4', prompt: 'p', durationSeconds: 4 });
    generateSpeech
      .mockResolvedValueOnce({ audioUrl: 'https://blob/audio-0.mp3', characterCount: 10, voiceId: 'v1' })
      .mockRejectedValueOnce(new Error('ElevenLabs quota exceeded'));

    await expect(processVideoPipelineJob(fakeJob({ projectId: 'proj_1', userId: 'user_1' }))).rejects.toThrow(
      'ElevenLabs quota exceeded'
    );

    // 1 of 2 scenes completed -> refund half of the 1000 upfront charge.
    expect(refundCredits).toHaveBeenCalledWith('user_1', 500, 'run_failed', expect.any(Object));

    const sceneUpdates = videoProjectUpdate.mock.calls
      .map((call) => call[0].data.scenes)
      .filter(Boolean);
    const lastScenesWrite = sceneUpdates.at(-1) as SceneSpec[];
    expect(lastScenesWrite[1].status).toBe('failed');
    // The video call for scene 2 succeeded even though its sibling audio
    // call failed - that spend already happened, so the URL must survive.
    expect(lastScenesWrite[1].clipUrl).toBe('https://blob/clip-1.mp4');
  });
});
