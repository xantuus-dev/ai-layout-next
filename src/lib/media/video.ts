import { prisma } from '@/lib/prisma';
import { veoVideoService, type VeoAspectRatio, type VeoResolution, type VeoDurationSeconds } from '@/lib/video-generation';
import { getVideoGenerationCost, checkAndResetCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits, InsufficientCreditsError } from '@/lib/billing/gate';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { MediaGenerationFailure } from './types';

export interface GenerateVideoInput {
  userId: string;
  prompt: string;
  aspectRatio?: VeoAspectRatio;
  resolution?: VeoResolution;
  durationSeconds?: VeoDurationSeconds;
}

export interface GeneratedVideoResult {
  ok: true;
  video: {
    id: string;
    videoUrl: string;
    prompt: string;
    aspectRatio: string;
    resolution: string;
    durationSeconds: number;
    creditsUsed: number;
    createdAt: Date;
  };
}

const MODEL = 'veo-3.1-generate-preview';

export async function generateVideoForUser(
  input: GenerateVideoInput
): Promise<GeneratedVideoResult | MediaGenerationFailure> {
  const { userId, prompt, aspectRatio = '16:9', resolution = '720p', durationSeconds = '8' } = input;

  if (!veoVideoService.isConfigured()) {
    return { ok: false, reason: 'not_configured', message: 'Video generation is not configured (GOOGLE_AI_API_KEY missing).' };
  }

  const rateLimitResult = await checkRateLimit(`video-generation:${userId}`, RATE_LIMITS.VIDEO_GENERATION);
  if (!rateLimitResult.success) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Rate limit exceeded. Maximum 5 videos per hour.',
      retryAfterSeconds: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
    };
  }

  await checkAndResetCredits(userId);

  const creditsNeeded = getVideoGenerationCost(Number(durationSeconds), resolution);
  const decision = await assertCanSpend(userId, creditsNeeded);
  if (!decision.allowed) {
    return {
      ok: false,
      reason: decision.reason === 'viewer_cannot_spend' ? 'viewer_cannot_spend' : 'insufficient_credits',
      message:
        decision.reason === 'viewer_cannot_spend'
          ? 'Viewers cannot spend the team credit pool'
          : 'Insufficient credits',
      creditsNeeded,
      creditsAvailable: Math.max(0, decision.remaining),
    };
  }

  let videoUrl: string;
  try {
    const result = await veoVideoService.generateVideo({
      prompt,
      aspectRatio,
      resolution,
      durationSeconds,
      userId,
    });
    videoUrl = result.videoUrl;
  } catch (error) {
    return {
      ok: false,
      reason: 'provider_error',
      message: error instanceof Error ? error.message : 'Video generation failed',
    };
  }

  const generatedVideo = await prisma.generatedVideo.create({
    data: {
      userId,
      prompt,
      model: MODEL,
      aspectRatio,
      resolution,
      durationSeconds: Number(durationSeconds),
      videoUrl,
      creditsUsed: creditsNeeded,
    },
  });

  try {
    await spendCredits(userId, creditsNeeded, {
      type: 'video-generation',
      model: MODEL,
      description: `Video generation: ${prompt.substring(0, 50)}...`,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { ok: false, reason: 'insufficient_credits', message: 'Insufficient credits', creditsNeeded };
    }
    throw error;
  }

  return {
    ok: true,
    video: {
      id: generatedVideo.id,
      videoUrl: generatedVideo.videoUrl,
      prompt: generatedVideo.prompt,
      aspectRatio: generatedVideo.aspectRatio,
      resolution: generatedVideo.resolution,
      durationSeconds: generatedVideo.durationSeconds,
      creditsUsed: creditsNeeded,
      createdAt: generatedVideo.createdAt,
    },
  };
}
