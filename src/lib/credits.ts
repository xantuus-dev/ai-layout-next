import { prisma } from './prisma';
import { addMonths, isAfter } from 'date-fns';
import { PLAN_CREDITS, getCreditsForPlan } from './plans';
import { aiRouter } from './ai-providers';
import { sendUsageAlertEmail } from './email';

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

// Image Generation Credit Costs
// Based on image dimensions - higher resolution = higher cost
export const IMAGE_GENERATION_COSTS: Record<string, number> = {
  'small': 5, // 512x512
  'medium': 15, // 1024x1024
  'large': 30, // 1536x1536
};

// Helper function to get image generation cost by dimensions
export function getImageGenerationCost(width: number, height: number): number {
  if (width <= 512 && height <= 512) {
    return IMAGE_GENERATION_COSTS.small;
  } else if (width <= 1024 && height <= 1024) {
    return IMAGE_GENERATION_COSTS.medium;
  } else {
    return IMAGE_GENERATION_COSTS.large;
  }
}

// AI Browser Feature Credit Costs
export const BROWSER_FEATURE_CREDITS = {
  // Browser Sessions
  SESSION_CREATE: 50, // Creating a browser session

  // Chat with Webpage
  EXTRACT_CONTEXT: 10, // One-time extraction of page content
  CHAT_MESSAGE_MIN: 5, // Minimum per chat message
  CHAT_MESSAGE_MAX: 50, // Maximum per chat message (token-based)

  // AI Navigation
  PARSE_COMMAND: 5, // Parsing natural language command
  NAVIGATION_BASE: 10, // Base cost for AI-powered navigation
  NAVIGATION_ACTION: 5, // Per action executed (click, type, etc.)

  // Workflow Automation
  WORKFLOW_BASE: 50, // Base cost to execute workflow
  WORKFLOW_STEP: 5, // Per workflow step executed
  WORKFLOW_AI_RECOVERY: 20, // AI-powered error recovery per attempt

  // Page Monitoring
  MONITOR_CHECK_BASIC: 5, // Basic text/element monitoring check
  MONITOR_CHECK_AI: 15, // AI-powered monitoring check (minimum)
  MONITOR_CHECK_AI_MAX: 25, // AI-powered monitoring check (maximum)
  MONITOR_ALERT: 2, // Processing and sending alert

  // Integrations
  INTEGRATION_CONNECT: 0, // Free to connect integrations
  INTEGRATION_API_CALL: 3, // Per API call to integrated service
  CUSTOM_TOOL_CALL: 5, // Per custom tool execution
};

/**
 * Resolve the user whose credit pool should actually be charged.
 * Team members (User.billingOwnerId set) draw from their team owner's
 * pool instead of their own — this is what makes team billing "just work"
 * for every existing call site without each one needing to know about it.
 */
export async function resolveBillingUserId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingOwnerId: true },
  });

  return user?.billingOwnerId || userId;
}

/**
 * Team members with the "viewer" role can access shared workspace content
 * but cannot spend the team's credit pool. Owners and non-pooled users are
 * always allowed.
 */
async function canConsumeCredits(userId: string, billingUserId: string): Promise<boolean> {
  if (billingUserId === userId) return true;

  const ownerDefaultWorkspace = await prisma.workspace.findFirst({
    where: { userId: billingUserId, isDefault: true },
    select: { id: true },
  });
  if (!ownerDefaultWorkspace) return true;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ownerDefaultWorkspace.id, userId } },
  });

  return member?.role !== 'viewer';
}

/**
 * Check if user's credits need to be reset and reset them if necessary
 */
export async function checkAndResetCredits(userId: string) {
  const billingUserId = await resolveBillingUserId(userId);

  const user = await prisma.user.findUnique({
    where: { id: billingUserId },
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

    // Reset credits and let usage alerts fire again next cycle
    await prisma.user.update({
      where: { id: billingUserId },
      data: {
        creditsUsed: 0,
        creditsResetAt: nextResetDate,
        creditAlert80SentAt: null,
        creditAlert100SentAt: null,
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
    // Router itself threw (should not happen in practice — it has its own
    // internal fallbacks). Bill conservatively rather than guessing mid-tier.
    console.warn(`⚠️  AI Router failed to estimate credits for "${model}", using static fallback table`, error);
    const creditsPerThousand = MODEL_CREDITS_PER_1K[model]
      ?? Math.max(...Object.values(MODEL_CREDITS_PER_1K));
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerThousand));
  }
}

/**
 * Check if user has enough credits.
 * Resolves to the team billing owner's pool when userId is a team member.
 */
export async function hasEnoughCredits(userId: string, creditsRequired: number): Promise<boolean> {
  const billingUserId = await resolveBillingUserId(userId);

  if (!(await canConsumeCredits(userId, billingUserId))) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: billingUserId },
    select: {
      creditsUsed: true,
      monthlyCredits: true,
    },
  });

  if (!user) return false;

  return (user.creditsUsed + creditsRequired) <= user.monthlyCredits;
}

/**
 * Deduct credits for an action taken by userId, and create a usage record.
 *
 * The usage record stays attributed to the acting userId (so a team owner
 * can see which member did what), but the actual credit balance charged is
 * the resolved billing owner's — team members draw down their owner's pool.
 */
export async function deductCredits(
  userId: string,
  credits: number,
  metadata: {
    type: string;
    model?: string;
    tokens?: number;
    description?: string;
    extra?: Record<string, unknown>;
  }
) {
  // Check and reset credits if needed
  await checkAndResetCredits(userId);

  // Check if user (or their team) has enough credits
  const hasCredits = await hasEnoughCredits(userId, credits);
  if (!hasCredits) {
    throw new Error('Insufficient credits');
  }

  const billingUserId = await resolveBillingUserId(userId);

  // Create usage record and update the billing owner's credits in a transaction
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
          ...metadata.extra,
          ...(billingUserId !== userId ? { billedTo: billingUserId } : {}),
        },
      },
    }),
    prisma.user.update({
      where: { id: billingUserId },
      data: {
        creditsUsed: {
          increment: credits,
        },
      },
    }),
  ]);

  await checkUsageAlerts(billingUserId);

  return { success: true, creditsDeducted: credits };
}

/**
 * Send an 80%/100% usage alert to the billing owner if they've just crossed
 * a threshold this cycle and haven't already been notified for it. Failures
 * are logged, never thrown — a flaky email send should never break a
 * successful credit deduction.
 */
async function checkUsageAlerts(billingUserId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: billingUserId },
      select: {
        email: true,
        name: true,
        creditsUsed: true,
        monthlyCredits: true,
        creditAlert80SentAt: true,
        creditAlert100SentAt: true,
      },
    });

    if (!user?.email || user.monthlyCredits <= 0) return;

    const percentUsed = (user.creditsUsed / user.monthlyCredits) * 100;
    const billingUrl = `${process.env.NEXTAUTH_URL}/settings/billing`;

    if (percentUsed >= 100 && !user.creditAlert100SentAt) {
      await sendUsageAlertEmail({
        to: user.email,
        name: user.name,
        threshold: 100,
        creditsUsed: user.creditsUsed,
        monthlyCredits: user.monthlyCredits,
        billingUrl,
      });
      await prisma.user.update({
        where: { id: billingUserId },
        data: {
          creditAlert100SentAt: new Date(),
          // Crossing 100% inherently means crossing 80% too — mark both so
          // a later deduction (e.g. after a plan bump raises the cap) can't
          // send the 80% alert again after the user already saw the 100% one.
          creditAlert80SentAt: user.creditAlert80SentAt ?? new Date(),
        },
      });
    } else if (percentUsed >= 80 && !user.creditAlert80SentAt) {
      await sendUsageAlertEmail({
        to: user.email,
        name: user.name,
        threshold: 80,
        creditsUsed: user.creditsUsed,
        monthlyCredits: user.monthlyCredits,
        billingUrl,
      });
      await prisma.user.update({
        where: { id: billingUserId },
        data: { creditAlert80SentAt: new Date() },
      });
    }
  } catch (error) {
    console.error('Error checking/sending usage alert:', error);
  }
}

/**
 * Get user's current credit status
 */
export async function getCreditStatus(userId: string) {
  const billingUserId = await resolveBillingUserId(userId);

  const user = await prisma.user.findUnique({
    where: { id: billingUserId },
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

/**
 * Calculate credits for chat with webpage feature
 */
export function calculateChatCredits(tokens: number, isFirstMessage: boolean): number {
  let credits = 0;

  // Add extraction cost for first message
  if (isFirstMessage) {
    credits += BROWSER_FEATURE_CREDITS.EXTRACT_CONTEXT;
  }

  // Add token-based cost for the message
  const messageCost = Math.ceil((tokens / 1000) * 3); // Using Sonnet pricing as base
  credits += Math.min(
    Math.max(BROWSER_FEATURE_CREDITS.CHAT_MESSAGE_MIN, messageCost),
    BROWSER_FEATURE_CREDITS.CHAT_MESSAGE_MAX
  );

  return credits;
}

/**
 * Calculate credits for AI navigation
 */
export function calculateNavigationCredits(actionCount: number): number {
  return (
    BROWSER_FEATURE_CREDITS.PARSE_COMMAND +
    BROWSER_FEATURE_CREDITS.NAVIGATION_BASE +
    BROWSER_FEATURE_CREDITS.NAVIGATION_ACTION * actionCount
  );
}

/**
 * Calculate credits for workflow execution
 */
export function calculateWorkflowCredits(
  stepCount: number,
  aiRecoveryCount: number = 0
): number {
  return (
    BROWSER_FEATURE_CREDITS.WORKFLOW_BASE +
    BROWSER_FEATURE_CREDITS.WORKFLOW_STEP * stepCount +
    BROWSER_FEATURE_CREDITS.WORKFLOW_AI_RECOVERY * aiRecoveryCount
  );
}

/**
 * Calculate credits for monitor check
 */
export function calculateMonitorCredits(
  checkType: 'basic' | 'ai',
  tokens: number = 0
): number {
  if (checkType === 'basic') {
    return BROWSER_FEATURE_CREDITS.MONITOR_CHECK_BASIC;
  }

  // AI-powered monitoring with token-based pricing
  const aiCost = Math.ceil((tokens / 1000) * 3);
  return Math.min(
    Math.max(BROWSER_FEATURE_CREDITS.MONITOR_CHECK_AI, aiCost),
    BROWSER_FEATURE_CREDITS.MONITOR_CHECK_AI_MAX
  );
}
