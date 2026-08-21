import { prisma } from '@/lib/prisma';
import {
  elevenLabsMusicService,
  clampMusicLength,
  type MusicModelId,
} from '@/lib/music-generation';
import { getMusicGenerationCost, checkAndResetCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits, InsufficientCreditsError } from '@/lib/billing/gate';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { MediaGenerationFailure } from './types';

export interface GenerateMusicInput {
  userId: string;
  prompt: string;
  lengthMs?: number;
  modelId?: MusicModelId;
  instrumental?: boolean;
}

export interface GeneratedMusicResult {
  ok: true;
  music: {
    id: string;
    audioUrl: string;
    prompt: string;
    lengthMs: number;
    instrumental: boolean;
    creditsUsed: number;
    createdAt: Date;
  };
}

const DEFAULT_MODEL: MusicModelId = 'music_v2';

export async function generateMusicForUser(
  input: GenerateMusicInput
): Promise<GeneratedMusicResult | MediaGenerationFailure> {
  const { userId, prompt, modelId = DEFAULT_MODEL, instrumental = false } = input;

  if (!elevenLabsMusicService.isConfigured()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'Music generation is not configured (ELEVENLABS_API_KEY missing).',
    };
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      ok: false,
      reason: 'invalid_input',
      message: 'A prompt describing the music is required.',
    };
  }

  const rateLimitResult = await checkRateLimit(
    `music-generation:${userId}`,
    RATE_LIMITS.MUSIC_GENERATION
  );
  if (!rateLimitResult.success) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Rate limit exceeded. Maximum 10 music generations per hour.',
      retryAfterSeconds: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
    };
  }

  await checkAndResetCredits(userId);

  // Quote against the clamped length, not the requested one, so the estimate
  // shown to the user matches what the provider will actually compose (and
  // therefore what we charge for below).
  const lengthMs = clampMusicLength(input.lengthMs);
  const creditsNeeded = getMusicGenerationCost(lengthMs);

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

  let audioUrl: string;
  let composedLengthMs: number;
  try {
    const result = await elevenLabsMusicService.composeMusic({
      prompt,
      lengthMs,
      modelId,
      instrumental,
      userId,
    });
    audioUrl = result.audioUrl;
    composedLengthMs = result.lengthMs;
  } catch (error) {
    return {
      ok: false,
      reason: 'provider_error',
      message: error instanceof Error ? error.message : 'Music generation failed',
    };
  }

  const generatedMusic = await prisma.generatedMusic.create({
    data: {
      userId,
      prompt,
      model: modelId,
      lengthMs: composedLengthMs,
      instrumental,
      audioUrl,
      creditsUsed: creditsNeeded,
    },
  });

  try {
    await spendCredits(userId, creditsNeeded, {
      type: 'music-generation',
      model: modelId,
      description: `Music generation (${Math.round(composedLengthMs / 1000)}s)`,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { ok: false, reason: 'insufficient_credits', message: 'Insufficient credits', creditsNeeded };
    }
    throw error;
  }

  return {
    ok: true,
    music: {
      id: generatedMusic.id,
      audioUrl: generatedMusic.audioUrl,
      prompt: generatedMusic.prompt,
      lengthMs: generatedMusic.lengthMs,
      instrumental: generatedMusic.instrumental,
      creditsUsed: creditsNeeded,
      createdAt: generatedMusic.createdAt,
    },
  };
}
