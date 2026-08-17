import { prisma } from '@/lib/prisma';
import { elevenLabsAudioService } from '@/lib/audio-generation';
import { getAudioGenerationCost, checkAndResetCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits, InsufficientCreditsError } from '@/lib/billing/gate';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { MediaGenerationFailure } from './types';

export interface GenerateAudioInput {
  userId: string;
  text: string;
  voiceId?: string;
  modelId?: string;
}

export interface GeneratedAudioResult {
  ok: true;
  audio: {
    id: string;
    audioUrl: string;
    text: string;
    voiceId: string;
    characterCount: number;
    creditsUsed: number;
    createdAt: Date;
  };
}

const DEFAULT_MODEL = 'eleven_multilingual_v2';

export async function generateAudioForUser(
  input: GenerateAudioInput
): Promise<GeneratedAudioResult | MediaGenerationFailure> {
  const { userId, text, voiceId, modelId = DEFAULT_MODEL } = input;

  if (!elevenLabsAudioService.isConfigured()) {
    return { ok: false, reason: 'not_configured', message: 'Audio generation is not configured (ELEVENLABS_API_KEY missing).' };
  }

  if (!voiceId && !process.env.ELEVENLABS_DEFAULT_VOICE_ID) {
    return {
      ok: false,
      reason: 'invalid_input',
      message: 'No voice specified: pass voiceId (see list_voices), or set ELEVENLABS_DEFAULT_VOICE_ID.',
    };
  }

  const rateLimitResult = await checkRateLimit(`audio-generation:${userId}`, RATE_LIMITS.AUDIO_GENERATION);
  if (!rateLimitResult.success) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Rate limit exceeded. Maximum 30 audio generations per hour.',
      retryAfterSeconds: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
    };
  }

  await checkAndResetCredits(userId);

  const creditsNeeded = getAudioGenerationCost(text.length);
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
  let resolvedVoiceId: string;
  try {
    const result = await elevenLabsAudioService.generateSpeech({ text, voiceId, modelId, userId });
    audioUrl = result.audioUrl;
    resolvedVoiceId = result.voiceId;
  } catch (error) {
    return {
      ok: false,
      reason: 'provider_error',
      message: error instanceof Error ? error.message : 'Audio generation failed',
    };
  }

  const generatedAudio = await prisma.generatedAudio.create({
    data: {
      userId,
      text,
      model: modelId,
      voiceId: resolvedVoiceId,
      characterCount: text.length,
      audioUrl,
      creditsUsed: creditsNeeded,
    },
  });

  try {
    await spendCredits(userId, creditsNeeded, {
      type: 'audio-generation',
      model: modelId,
      description: `Audio generation (${text.length} chars)`,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { ok: false, reason: 'insufficient_credits', message: 'Insufficient credits', creditsNeeded };
    }
    throw error;
  }

  return {
    ok: true,
    audio: {
      id: generatedAudio.id,
      audioUrl: generatedAudio.audioUrl,
      text: generatedAudio.text,
      voiceId: generatedAudio.voiceId,
      characterCount: generatedAudio.characterCount,
      creditsUsed: creditsNeeded,
      createdAt: generatedAudio.createdAt,
    },
  };
}
