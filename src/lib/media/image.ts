import { prisma } from '@/lib/prisma';
import { geminiImageService } from '@/lib/gemini-image';
import { getImageGenerationCost, checkAndResetCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits, refundCredits, InsufficientCreditsError } from '@/lib/billing/gate';
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

  // Reserve the credits BEFORE calling the provider, and refund if the work
  // does not land. Charging afterwards leaks money: assertCanSpend above is
  // only advisory, so a concurrent request could drain the balance while the
  // provider call is in flight, leaving us having paid Google for an image the
  // customer was never billed for — and, worse, still writing the row, so
  // GeneratedImage.creditsUsed disagreed with the ledger.
  //
  // spendCredits guards the decrement in its WHERE clause, so losing that race
  // fails here instead of overdrawing. This mirrors what the video pipeline
  // already does (see lib/video-pipeline/worker.ts).
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

  /** Give the credits back. Never throws — a failed refund must not mask the
   *  original failure, but it does need to be loud in the logs. */
  const refund = async (description: string) => {
    try {
      await refundCredits(userId, creditsNeeded, 'provider_error', { description });
    } catch (refundError) {
      console.error(
        `[media/image] CREDIT LEAK: failed to refund ${creditsNeeded} credits to ${userId}`,
        refundError
      );
    }
  };

  let imageUrl: string;
  try {
    const result = await geminiImageService.generateImage({ prompt, width, height, userId });
    imageUrl = result.imageUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    await refund(`Image generation failed: ${message.substring(0, 100)}`);
    return { ok: false, reason: 'provider_error', message };
  }

  let generatedImage;
  try {
    generatedImage = await prisma.generatedImage.create({
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
  } catch (error) {
    // The provider succeeded and we paid for it, but the customer has no row
    // and therefore no way to reach the image. Refunding is the right side to
    // err on: we eat one generation rather than bill for an invisible result.
    await refund('Image generated but could not be saved');
    return {
      ok: false,
      reason: 'provider_error',
      message: error instanceof Error ? error.message : 'Could not save the generated image',
    };
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
