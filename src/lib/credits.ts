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
