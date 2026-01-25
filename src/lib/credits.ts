import { prisma } from './prisma';
import { addMonths, isAfter } from 'date-fns';
import { PLAN_CREDITS, getCreditsForPlan } from './plans';
import { aiRouter } from './ai-providers';

// Model credit costs (per 1000 tokens) - Multi-Provider Support
// Note: This is now dynamically managed by the AI Router
// These are fallback values if the router is unavailable
export const MODEL_CREDITS_PER_1K: Record<string, number> = {
  // Anthropic (Claude)
  'claude-haiku-4-5-20250529': 1,
  'claude-sonnet-4-5-20250929': 3,
  'claude-opus-4-5-20251101': 15,

  // OpenAI (GPT)
  'gpt-3.5-turbo': 0.5,
  'gpt-4o-mini': 0.15,
  'gpt-4o': 5,
  'gpt-4-turbo': 10,

  // Google (Gemini)
  'gemini-1.5-flash': 0.075,
  'gemini-2.0-flash-exp': 0.075,
  'gemini-1.5-pro': 1.25,
};

/**
 * Check if user's credits need to be reset and reset them if necessary
 */
export async function checkAndResetCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsResetAt: true,
      creditsUsed: true,
      monthlyCredits: true,
      plan: true,
    },
  });

  if (!user) return null;

  const now = new Date();

  // Check if reset is needed
  if (isAfter(now, user.creditsResetAt)) {
    // Calculate next reset date (one month from now)
    const nextResetDate = addMonths(now, 1);

    // Reset credits
    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsed: 0,
        creditsResetAt: nextResetDate,
      },
    });

    return {
      reset: true,
      creditsUsed: 0,
      creditsResetAt: nextResetDate,
    };
  }

  return {
    reset: false,
    creditsUsed: user.creditsUsed,
    creditsResetAt: user.creditsResetAt,
  };
}

/**
 * Calculate credits required for a given model and token count
 * Uses AI Router for accurate pricing across all providers
 */
export function calculateCredits(model: string, tokens: number): number {
  try {
    // Try to use AI Router for accurate multi-provider pricing
    return aiRouter.estimateCredits(model, tokens);
  } catch (error) {
    // Fallback to static pricing if router fails
    const creditsPerThousand = MODEL_CREDITS_PER_1K[model] || 3; // Default to Sonnet pricing
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerThousand));
  }
}

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(userId: string, creditsRequired: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsUsed: true,
      monthlyCredits: true,
    },
  });

  if (!user) return false;

  return (user.creditsUsed + creditsRequired) <= user.monthlyCredits;
}

/**
 * Deduct credits from user and create usage record
 */
export async function deductCredits(
  userId: string,
  credits: number,
  metadata: {
    type: string;
    model?: string;
    tokens?: number;
    description?: string;
  }
) {
  // Check and reset credits if needed
  await checkAndResetCredits(userId);

  // Check if user has enough credits
  const hasCredits = await hasEnoughCredits(userId, credits);
  if (!hasCredits) {
    throw new Error('Insufficient credits');
  }

  // Create usage record and update user credits in a transaction
  await prisma.$transaction([
    prisma.usageRecord.create({
      data: {
        userId,
        type: metadata.type,
        model: metadata.model,
        tokens: metadata.tokens || 0,
        credits,
        metadata: {
          description: metadata.description,
        },
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsed: {
          increment: credits,
        },
      },
    }),
  ]);

  return { success: true, creditsDeducted: credits };
}

/**
 * Get user's current credit status
 */
export async function getCreditStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      monthlyCredits: true,
      creditsUsed: true,
      creditsResetAt: true,
    },
  });

  if (!user) return null;

  return {
    plan: user.plan,
    monthlyCredits: user.monthlyCredits,
    creditsUsed: user.creditsUsed,
    creditsRemaining: user.monthlyCredits - user.creditsUsed,
    creditsResetAt: user.creditsResetAt,
    percentageUsed: (user.creditsUsed / user.monthlyCredits) * 100,
  };
}
