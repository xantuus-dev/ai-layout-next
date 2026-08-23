import { prisma } from './prisma';
import { addMonths, isAfter } from 'date-fns';
import { PLAN_CREDITS, getCreditsForPlan } from './plans';
import { aiRouter } from './ai-providers';
import { ANTHROPIC_MODELS } from './ai-providers/catalog';
import { sendUsageAlertEmail } from './email';

// Model credit costs (per 1000 tokens) - Multi-Provider Support
// Note: This is now dynamically managed by the AI Router
// These are fallback values if the router is unavailable
export const MODEL_CREDITS_PER_1K: Record<string, number> = {
  // Anthropic entries are derived from the shared catalog so this fallback map
  // cannot drift from the prices the router actually bills with. It previously
  // listed a Claude Haiku id that returns 404.
  ...Object.fromEntries(
    ANTHROPIC_MODELS.map(m => [m.id, m.creditsPerThousandTokens])
  ),

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

// Video Generation Credit Costs — per provider, per resolution.
//
// Rates are on the same "1 credit ~= $0.001 of provider cost" scale used
// everywhere else in this file, so 473 credits/sec means ~$0.473/sec of real
// spend. Credits retail at ~$0.005 each (see CREDIT_TIER_PRICES), giving a ~5x
// gross markup at these rates.
//
// Keyed by provider because the same clip costs very different amounts
// depending on who generates it — an 8s 720p clip is ~$3.78 on Seedance and a
// guessed ~$3.20 on Veo. A resolution-only table silently billed both the same,
// which made every margin figure in the app wrong once a second provider
// existed.
type VideoRateTable = Record<string, number>;

/**
 * ByteDance Seedance 2.5 via fal — REAL published rates, checked 2026-08-23.
 * https://fal.ai/models/bytedance/seedance-2.5/text-to-video
 *
 * fal bills by token, and calls that formula authoritative:
 *   tokens = (height * width * duration_seconds * 24) / 1024, at $0.0214/1000
 * The per-second figures below are fal's own approximations for 16:9. Other
 * aspect ratios have different pixel counts and therefore different real costs,
 * so a 1:1 or 21:9 clip is priced approximately here — see the note below.
 */
const SEEDANCE_CREDITS_PER_SECOND: VideoRateTable = {
  '480p': 221, // ~$0.2205/sec (fal, 16:9)
  '720p': 473, // ~$0.4730/sec (fal, 16:9)
  // fal does not publish a 1080p per-second figure. Derived from the token
  // formula at 1920x1080 (48,600 tokens/sec) and deliberately rounded UP to the
  // higher of the two token rates seen quoted ($0.0234/1000), so we over-charge
  // rather than under-charge on an unverified number. Confirm before relying
  // on it.
  '1080p': 1137, // ~$1.137/sec DERIVED, unverified
};

/**
 * Google Veo — still placeholders. These were never reconciled against live
 * billing and are retained only so a Veo deployment does not bill at zero.
 * Confirm at https://ai.google.dev/gemini-api/docs/pricing before selling Veo.
 */
const VEO_CREDITS_PER_SECOND: VideoRateTable = {
  '720p': 400, // ~$0.40/sec PLACEHOLDER
  '1080p': 600, // ~$0.60/sec PLACEHOLDER
  '4k': 1000, // ~$1.00/sec PLACEHOLDER
};

const VIDEO_RATES_BY_PROVIDER: Record<string, VideoRateTable> = {
  seedance: SEEDANCE_CREDITS_PER_SECOND,
  veo: VEO_CREDITS_PER_SECOND,
};

/** Used when a caller does not say which provider — the safer, dearer table. */
const FALLBACK_RATES = SEEDANCE_CREDITS_PER_SECOND;

/**
 * Retained for callers that predate provider-aware pricing. Prefer
 * {@link getVideoGenerationCost} with an explicit providerId.
 * @deprecated Resolution alone cannot price a clip once there are two providers.
 */
export const VIDEO_GENERATION_CREDITS_PER_SECOND = VEO_CREDITS_PER_SECOND;

/**
 * Cost of one generated clip, in credits.
 *
 * Unknown provider or resolution falls back to the most expensive comparable
 * rate rather than the cheapest: mispricing downward loses money silently,
 * whereas mispricing upward surfaces as a complaint.
 */
export function getVideoGenerationCost(
  durationSeconds: number,
  resolution: string = '720p',
  providerId?: string
): number {
  const table = (providerId && VIDEO_RATES_BY_PROVIDER[providerId]) || FALLBACK_RATES;
  const perSecond = table[resolution] ?? Math.max(...Object.values(table));
  return Math.max(1, Math.ceil(durationSeconds * perSecond));
}

// Audio Generation Credit Costs (ElevenLabs text-to-speech, billed per character)
//
// Same caveat as video above: ElevenLabs bills per character at a rate that
// depends on your subscription tier (Starter/Creator/Pro/...). Verify your
// plan's actual rate at https://elevenlabs.io/pricing before charging
// customers — this placeholder assumes ~$0.20 per 1,000 characters.
export const AUDIO_GENERATION_CREDITS_PER_1K_CHARS = 200;

export function getAudioGenerationCost(characterCount: number): number {
  return Math.max(1, Math.ceil((characterCount / 1000) * AUDIO_GENERATION_CREDITS_PER_1K_CHARS));
}

// Music Generation Credit Costs (ElevenLabs Music, billed per second of output)
//
// Priced per minute rather than per character because that is the axis the
// provider bills on for music — a 30-second track costs the same whether the
// prompt was five words or five hundred.
//
// Same caveat as the speech and video rates above: this is a placeholder that
// assumes roughly $1.00 per minute of generated audio. Reconcile it against
// your actual ElevenLabs plan at https://elevenlabs.io/pricing before charging
// customers.
export const MUSIC_GENERATION_CREDITS_PER_MINUTE = 1000;

export function getMusicGenerationCost(lengthMs: number): number {
  return Math.max(1, Math.ceil((lengthMs / 60_000) * MUSIC_GENERATION_CREDITS_PER_MINUTE));
}

// Video Pipeline Credit Costs (concept -> scenes -> stitched final video)
//
// A pipeline run is charged once upfront for the whole project (see
// src/lib/video-pipeline/worker.ts), not per scene: sum of each scene's Veo
// cost + each scene's ElevenLabs cost, plus a flat surcharge covering the
// ffmpeg stitching sandbox's compute time. Same placeholder-rate caveat as
// the two cost functions above — the surcharge has not been reconciled
// against real Vercel Sandbox billing.
export const VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS = 150;

export function getVideoPipelineCost(
  scenes: { durationSeconds: number; resolution?: '720p' | '1080p' | '4k' }[],
  voiceoverCharCounts: number[]
): number {
  const videoCost = scenes.reduce(
    (sum, scene) => sum + getVideoGenerationCost(scene.durationSeconds, scene.resolution ?? '720p'),
    0
  );
  const audioCost = voiceoverCharCounts.reduce((sum, count) => sum + getAudioGenerationCost(count), 0);
  return Math.max(1, videoCost + audioCost + VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS);
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
export async function checkUsageAlerts(billingUserId: string): Promise<void> {
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
 * Tokens assumed for a chat turn when gating before the model has run.
 *
 * The real cost is unknown until the response comes back, so the pre-flight
 * check needs a floor. This is deliberately a floor and not an average: it
 * exists to stop an exhausted account starting another request, not to bill
 * accurately. Actual usage is reconciled by deductCredits afterwards.
 */
export const ESTIMATED_TOKENS_PER_TURN = 2000;

/**
 * Credits a chat turn should be assumed to cost before it runs.
 *
 * Pure, so the gate can be tested without a database or a provider.
 * Exported for testing.
 */
export function estimateTurnCredits(creditsPerThousandTokens: number): number {
  const perThousand = Number.isFinite(creditsPerThousandTokens) && creditsPerThousandTokens > 0
    ? creditsPerThousandTokens
    : 1;

  return Math.max(1, Math.ceil((ESTIMATED_TOKENS_PER_TURN / 1000) * perThousand));
}

/** Extra tokens assumed per tool-calling round-trip in an agentic turn. */
export const ESTIMATED_TOKENS_PER_TOOL_ITERATION = 1500;

/**
 * Flat pad, on top of the token-based estimate, for the tools' own credit
 * cost. Each tool call is separately capped by guards.ts's
 * COST_LIMITS.maxCreditsPerStep — this is only a conservative pre-flight
 * allowance, not a real ceiling.
 */
export const AGENTIC_TOOL_CREDIT_ALLOWANCE = 150;

/**
 * Credits an agentic chat turn should be assumed to cost before it runs.
 *
 * `estimateTurnCredits` alone underestimates here: every extra tool
 * round-trip resends the growing history plus tool schemas plus tool-result
 * payloads. Like `estimateTurnCredits`, this is only the pre-flight gate —
 * the real charge is the metered total computed after the loop finishes.
 */
export function estimateAgenticTurnCredits(
  creditsPerThousandTokens: number,
  maxIterations = 6
): number {
  const perThousand = Number.isFinite(creditsPerThousandTokens) && creditsPerThousandTokens > 0
    ? creditsPerThousandTokens
    : 1;
  const tokens = ESTIMATED_TOKENS_PER_TURN + ESTIMATED_TOKENS_PER_TOOL_ITERATION * maxIterations;

  return Math.max(1, Math.ceil((tokens / 1000) * perThousand)) + AGENTIC_TOOL_CREDIT_ALLOWANCE;
}

/**
 * Whether a balance can absorb a request of `required` credits.
 *
 * Pure counterpart to hasEnoughCredits, so the boundary condition is testable.
 * Note the strictness: a user whose credits are exactly exhausted must be
 * refused. Calling hasEnoughCredits(userId, 0) evaluated `used + 0 <= monthly`,
 * which is true at exactly the limit — so an account with nothing left kept
 * being served, and only a user already overdrawn was ever blocked.
 * Exported for testing.
 */
export function canAfford(
  creditsUsed: number,
  monthlyCredits: number,
  required: number
): boolean {
  return creditsUsed + Math.max(1, required) <= monthlyCredits;
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
