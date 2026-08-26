import { prisma } from './prisma';
import { addMonths, isAfter } from 'date-fns';
import { PLAN_CREDITS, getCreditsForPlan, getCreditPeriod, PLAN_DEFINITIONS } from './plans';
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

/**
 * Atlas Cloud, per model — REAL published rates, checked 2026-08-23.
 * https://www.atlascloud.ai/pricing/models
 *
 * Atlas resells the whole Seedance family, and the spread between models is far
 * larger than the spread between resolutions: 2.0 Mini is ~3.4x cheaper than
 * 2.5 for the same clip. Pricing therefore has to know the model, not just the
 * provider — a provider-level rate would either overcharge Mini output or
 * undercharge 2.5.
 *
 * CAVEAT: Atlas publishes a single "start from" price per model rather than a
 * per-resolution table. The 480p figures below are those published floors; the
 * 720p figures are derived from their playground quote ($1.514799 for a 5s 720p
 * Seedance 2.5 run). 1080p is not published at all and is set deliberately high
 * pending a real run. Confirm all three against actual invoices before selling.
 */
const ATLAS_SEEDANCE_25: VideoRateTable = {
  '480p': 134, // ~$0.134/s published "start from"
  '720p': 303, // ~$0.303/s derived from the playground quote
  '1080p': 600, // UNVERIFIED — deliberately high until a real run confirms it
};

const ATLAS_SEEDANCE_20: VideoRateTable = {
  '480p': 112, // ~$0.112/s published
  '720p': 253,
  '1080p': 500, // UNVERIFIED
};

const ATLAS_SEEDANCE_20_FAST: VideoRateTable = {
  '480p': 72, // ~$0.072/s published (20% off)
  '720p': 163,
  '1080p': 322, // UNVERIFIED
};

const ATLAS_SEEDANCE_20_MINI: VideoRateTable = {
  '480p': 39, // ~$0.039/s published (30% off)
  '720p': 88,
  '1080p': 174, // UNVERIFIED
};

/**
 * Rates keyed by model id, checked before the provider table. Only models whose
 * price differs materially from their provider's default need an entry.
 */
const VIDEO_RATES_BY_MODEL: Record<string, VideoRateTable> = {
  'bytedance/seedance-2.5/text-to-video': ATLAS_SEEDANCE_25,
  'bytedance/seedance-2.0/text-to-video': ATLAS_SEEDANCE_20,
  'bytedance/seedance-2.0-fast/text-to-video': ATLAS_SEEDANCE_20_FAST,
  'bytedance/seedance-2.0-mini/text-to-video': ATLAS_SEEDANCE_20_MINI,
};

const VIDEO_RATES_BY_PROVIDER: Record<string, VideoRateTable> = {
  seedance: SEEDANCE_CREDITS_PER_SECOND,
  veo: VEO_CREDITS_PER_SECOND,
  // Atlas has no single provider-level rate — its models differ too much. This
  // is the dearest of them, used only when a caller names no model.
  atlas: ATLAS_SEEDANCE_25,
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
  providerId?: string,
  model?: string
): number {
  // Model first: one provider can serve several models at very different rates.
  const table =
    (model && VIDEO_RATES_BY_MODEL[model]) ||
    (providerId && VIDEO_RATES_BY_PROVIDER[providerId]) ||
    FALLBACK_RATES;
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

/** Midnight UTC following `from`. Deliberately UTC, not server-local: the
 *  pricing page and CreditsCard both advertise "00:00 UTC", and a
 *  timezone-dependent grant would make that copy wrong for most users. */
function nextUtcMidnight(from: Date): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** How stale a usage-alert flag must be before a daily reset re-arms it. */
const DAILY_ALERT_REARM_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check whether the user's credit balance is due to refresh, and refresh it.
 *
 * Two cadences, selected by plan (see getCreditPeriod in plans.ts):
 * - 'daily'   (free) — zeroed at 00:00 UTC. This is the grant behind the
 *   "300 refresh credits every day" copy on the pricing page. Before this
 *   existed the copy advertised a daily refresh that nothing implemented.
 * - 'monthly' (paid) — zeroed one month after the previous reset, unchanged.
 *
 * Two things a reset must NOT do, both learned the hard way:
 *
 * 1. It must not wipe purchased credits. grantPurchasedCredits() banks a
 *    one-time credit-pack purchase as NEGATIVE creditsUsed, so zeroing the
 *    column outright would delete credits the customer paid for — every
 *    midnight, for a free user. Hence the clamp to min(creditsUsed, 0):
 *    spent allowance resets, banked headroom survives.
 *
 * 2. It must not re-arm the 80%/100% usage-alert emails every day. Clearing
 *    those flags is what allows the emails to send again, so on a daily
 *    cadence an account that maxes out every day would receive two upgrade
 *    emails a day. Daily resets therefore only re-arm an alert older than
 *    DAILY_ALERT_REARM_MS; monthly resets clear unconditionally as before.
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
      trialEndsAt: true,
      creditAlert80SentAt: true,
      creditAlert100SentAt: true,
    },
  });

  if (!user) return null;

  const now = new Date();

  // An elapsed trial stops refreshing and drops to the no-plan state.
  //
  // Stripe normally drives this: a card-required trial converts to a paid
  // subscription on day 15 and the webhook moves the account onto a monthly
  // plan, so this branch never fires. It exists for the cases Stripe cannot
  // cover — accounts grandfathered off the old free tier (no subscription at
  // all), a cancelled trial, and any webhook that is delayed or lost. Without
  // it a lapsed trial would keep granting credits every midnight forever.
  if (user.plan === 'trial' && user.trialEndsAt && isAfter(now, user.trialEndsAt)) {
    await prisma.user.update({
      where: { id: billingUserId },
      data: {
        plan: 'free',
        monthlyCredits: PLAN_DEFINITIONS.free.credits,
        // Spent allowance is cleared, but banked credits from a purchased
        // pack are the customer's property and outlive the trial.
        creditsUsed: Math.min(user.creditsUsed, 0),
      },
    });

    return {
      reset: false,
      trialExpired: true,
      creditsUsed: Math.min(user.creditsUsed, 0),
      creditsResetAt: user.creditsResetAt,
    };
  }

  const period = getCreditPeriod(user.plan);

  // A stored reset date further out than tomorrow's midnight means the row
  // is still carrying a MONTHLY schedule — either it predates the daily
  // free tier, or the account was just downgraded from a paid plan. Treat
  // that as due now so the account self-heals onto the daily clock on its
  // next request, instead of waiting out the old monthly date.
  const carryingStaleMonthlySchedule =
    period === 'daily' && isAfter(user.creditsResetAt, nextUtcMidnight(now));

  const isDue = isAfter(now, user.creditsResetAt) || carryingStaleMonthlySchedule;

  if (!isDue) {
    return {
      reset: false,
      creditsUsed: user.creditsUsed,
      creditsResetAt: user.creditsResetAt,
    };
  }

  const nextResetDate = period === 'daily' ? nextUtcMidnight(now) : addMonths(now, 1);

  // Preserve banked (negative) headroom from credit-pack purchases and
  // referral awards; only clear allowance that was actually spent.
  const nextCreditsUsed = Math.min(user.creditsUsed, 0);

  const rearmAlert = (sentAt: Date | null) => {
    if (!sentAt) return null;
    if (period === 'monthly') return null;
    return now.getTime() - sentAt.getTime() >= DAILY_ALERT_REARM_MS ? null : sentAt;
  };

  await prisma.user.update({
    where: { id: billingUserId },
    data: {
      creditsUsed: nextCreditsUsed,
      creditsResetAt: nextResetDate,
      creditAlert80SentAt: rearmAlert(user.creditAlert80SentAt),
      creditAlert100SentAt: rearmAlert(user.creditAlert100SentAt),
    },
  });

  return {
    reset: true,
    creditsUsed: nextCreditsUsed,
    creditsResetAt: nextResetDate,
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
      trialEndsAt: true,
    },
  });

  if (!user) return null;

  const creditPeriod = getCreditPeriod(user.plan);
  const onTrial = user.plan === 'trial';

  return {
    plan: user.plan,
    monthlyCredits: user.monthlyCredits,
    creditsUsed: user.creditsUsed,
    creditsRemaining: user.monthlyCredits - user.creditsUsed,
    creditsResetAt: user.creditsResetAt,
    percentageUsed: user.monthlyCredits > 0 ? (user.creditsUsed / user.monthlyCredits) * 100 : 0,
    // 'daily' | 'monthly' — the allowance column is the same either way,
    // only the refresh cadence differs. Callers should render this rather
    // than assuming "per month".
    creditPeriod,
    // The advertised daily grant, or 0 for plans that refresh monthly.
    // The UI previously hardcoded 500 here with nothing granting it.
    dailyRefreshCredits: creditPeriod === 'daily' ? user.monthlyCredits : 0,
    onTrial,
    trialEndsAt: onTrial ? user.trialEndsAt : null,
    trialDaysRemaining:
      onTrial && user.trialEndsAt
        ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : null,
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

/**
 * What a credit balance actually buys, in units a customer recognises.
 *
 * The pricing page used to advertise "$5.00/1K credits". That number is honest
 * internally and misleading externally: a credit is a private currency, so
 * $/1K only compares across vendors if a credit buys the same thing everywhere,
 * and it does not. Ours is a much smaller unit than Runway's, which makes our
 * rate look cheap while our per-second cost is higher. Publishing the work a
 * balance does instead is both comparable and harder to misread.
 *
 * Derived from the real rate constants above, so it cannot drift from what the
 * meter actually charges.
 */
export function describeCreditValue(credits: number): {
  images: number;
  videoSeconds: number;
  chatTurns: number;
  speechMinutes: number;
} {
  const CHEAPEST_VIDEO_720P = VIDEO_RATES_BY_MODEL['bytedance/seedance-2.0-mini/text-to-video']['720p'];
  const SONNET_CREDITS_PER_TURN = Math.ceil((ESTIMATED_TOKENS_PER_TURN / 1000) * 3);
  // ~150 spoken words a minute, ~6 characters a word including spaces.
  const SPEECH_CHARS_PER_MINUTE = 900;

  return {
    images: Math.floor(credits / IMAGE_GENERATION_COSTS.medium),
    videoSeconds: Math.floor(credits / CHEAPEST_VIDEO_720P),
    chatTurns: Math.floor(credits / SONNET_CREDITS_PER_TURN),
    speechMinutes: Math.floor(credits / ((SPEECH_CHARS_PER_MINUTE / 1000) * AUDIO_GENERATION_CREDITS_PER_1K_CHARS)),
  };
}
