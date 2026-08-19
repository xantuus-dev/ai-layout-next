import { prisma } from '@/lib/prisma';
import { geminiImageService } from '@/lib/gemini-image';
import { getImageGenerationCost, checkAndResetCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits, InsufficientCreditsError } from '@/lib/billing/gate';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { MediaGenerationFailure } from './types';

export interface GenerateImageInput {
  userId: string;
  prompt: string;
  width?: number;
  height?: number;
}

export interface GeneratedImageResult {
  ok: true;
  image: {
    id: string;
    imageUrl: string;
    prompt: string;
    width: number;
    height: number;
    creditsUsed: number;
    createdAt: Date;
  };
}

const MODEL = geminiImageService.modelId;

export async function generateImageForUser(
  input: GenerateImageInput
): Promise<GeneratedImageResult | MediaGenerationFailure> {
  const { userId, prompt, width = 1024, height = 1024 } = input;

  if (!geminiImageService.isConfigured()) {
    return { ok: false, reason: 'not_configured', message: 'Image generation is not configured (GOOGLE_AI_API_KEY missing).' };
  }

  const rateLimitResult = await checkRateLimit(`image-generation:${userId}`, RATE_LIMITS.IMAGE_GENERATION);
  if (!rateLimitResult.success) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Rate limit exceeded. Maximum 10 images per hour.',
      retryAfterSeconds: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
    };
  }

  await checkAndResetCredits(userId);

  const creditsNeeded = getImageGenerationCost(width, height);
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

  let imageUrl: string;
  try {
    const result = await geminiImageService.generateImage({ prompt, width, height, userId });
    imageUrl = result.imageUrl;
  } catch (error) {
    return {
      ok: false,
      reason: 'provider_error',
      message: error instanceof Error ? error.message : 'Image generation failed',
    };
  }

  const generatedImage = await prisma.generatedImage.create({
    data: {
      userId,
      prompt,
      width,
      height,
      imageUrl,
      creditsUsed: creditsNeeded,
      model: MODEL,
    },
  });

  try {
    await spendCredits(userId, creditsNeeded, {
      type: 'image-generation',
      model: MODEL,
      description: `Image generation: ${prompt.substring(0, 50)}...`,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { ok: false, reason: 'insufficient_credits', message: 'Insufficient credits', creditsNeeded };
    }
    throw error;
  }

  return {
    ok: true,
    image: {
      id: generatedImage.id,
      imageUrl: generatedImage.imageUrl,
      prompt: generatedImage.prompt,
      width: generatedImage.width,
      height: generatedImage.height,
      creditsUsed: creditsNeeded,
      createdAt: generatedImage.createdAt,
    },
  };
}
