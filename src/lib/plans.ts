/**
 * Coarse plan tiers: free / pro / enterprise.
 *
 * There are two pricing systems in this codebase, deliberately:
 * - This file (plans.ts) defines the FREE tier, and provides a coarse
 *   'free' | 'pro' | 'enterprise' label used for UI badges, RevenueCat
 *   (mobile) subscriptions, and plan-tier comparisons. STRIPE_PRO_PRICE_ID /
 *   STRIPE_ENTERPRISE_PRICE_ID are NOT currently configured — the web
 *   checkout flow does not sell these fixed tiers directly.
 * - pricing-config.ts defines the actual granular Stripe price catalog
 *   (CREDIT_TIER_PRICES) that /pricing sells and the Stripe webhook reads.
 *   It is the source of truth for a paid user's real `monthlyCredits`.
 *
 * Do not render PLAN_DEFINITIONS[...].features credit-amount text as if it
 * reflects a paid user's actual plan — use `user.monthlyCredits` instead;
 * a 'pro'-labeled user could be on any of the 12 CREDIT_TIER_PRICES tiers.
 *
 * CREDIT PERIODS — trials and paid plans refresh on different clocks:
 * - trial → `creditPeriod: 'daily'`. User.monthlyCredits holds the DAILY
 *           grant and User.creditsUsed is zeroed at 00:00 UTC. Nothing
 *           rolls over. This is what the "300 credits every day" copy on
 *           the pricing page describes; it is enforced by
 *           checkAndResetCredits() in lib/credits.ts.
 * - free  → no allowance at all (0 credits). Not a tier you can use.
 * - paid  → `creditPeriod: 'monthly'`. User.monthlyCredits is the monthly
 *           allowance and resets one month after the last reset.
 *
 * The field is named `monthlyCredits` on both because it is the single
 * allowance column every call site already reads (`monthlyCredits -
 * creditsUsed`); only the refresh cadence differs. Read the period with
 * getCreditPeriod(plan) rather than testing plan ids inline.
 */

/**
 * Credits granted to a trialling account each day at 00:00 UTC.
 *
 * This number is load-bearing in two directions: it is the figure the
 * pricing page advertises AND the figure checkAndResetCredits() actually
 * grants. Changing it changes both — that is the point. At the blended
 * provider rate it also caps what one trial can cost per day, so do not
 * raise it without re-running the cost model:
 * TRIAL_DAILY_CREDITS x TRIAL_PERIOD_DAYS is the worst case per signup.
 */
export const TRIAL_DAILY_CREDITS = 300;

/**
 * Length of the free trial, in days.
 *
 * Passed to Stripe as `trial_period_days` at checkout, so Stripe owns the
 * clock and converts the subscription automatically when it elapses. The
 * app keeps its own `User.trialEndsAt` copy purely as a backstop for
 * accounts with no Stripe subscription (grandfathered free users) and for
 * the case where a webhook is delayed or missed.
 */
export const TRIAL_PERIOD_DAYS = 14;

export const PLAN_DEFINITIONS = {
  // No active subscription: signed up but never subscribed, trial expired,
  // or subscription cancelled. There is no longer an ongoing free allowance —
  // this state grants zero credits and every metered route paywalls it.
  // The id stays 'free' because it is the User.plan default and the value
  // every downgrade path already writes.
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'No active plan',
    price: 0,
    priceId: null,
    credits: 0,
    creditPeriod: 'monthly',
    features: [
      'Sign up and start a 14-day free trial',
      'Your workspaces, files and history are kept',
      'Subscribe any time to restore access',
    ],
  },

  // The $9.95 / 14-day introductory offer. Entered through Stripe checkout
  // and billed immediately — see INTRO_TRIAL in pricing-config.ts for why
  // this is a real 14-day subscription rather than a Stripe trial. It
  // converts to the monthly entry tier unless the customer cancels first.
  //
  // Grants credits DAILY rather than handing over the full monthly
  // allowance up front: it caps the cost of a trial that never converts,
  // and paces evaluation across the 14 days instead of one afternoon.
  trial: {
    id: 'trial',
    name: 'Trial',
    displayName: 'Free trial',
    price: 0,
    priceId: null,
    credits: TRIAL_DAILY_CREDITS,
    creditPeriod: 'daily',
    features: [
      'Around 250 images, 800+ chat turns, or 11 hours of transcription',
      '300 credits every day for 14 days',
      'Credits reset at 00:00 UTC — they do not roll over',
      'Full access to every paid feature',
      'Cancel any time before it renews',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    credits: 12000,
    creditPeriod: 'monthly',
    features: [
      '12,000 credits per month',
      'In-depth research for everyday tasks',
      'Professional websites for standard output',
      'Insightful slides for regular content',
      'Task scaling with Wide Research',
      'Generate unlimited business images',
      'Early access to beta features',
      '20 concurrent tasks',
      '20 scheduled tasks',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 199,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    credits: 40000,
    creditPeriod: 'monthly',
    // Enterprise is quoted, not listed (/pricing shows "Custom"), so the
    // feature list must not name a credit figure — a fixed "40,000 credits"
    // line anchors the negotiation to one tier before it starts, which is the
    // exact thing quoting is meant to avoid.
    features: [
      'Volume credit allowance, sized to your usage',
      'In-depth research for everyday tasks',
      'Professional websites for standard output',
      'Insightful slides for regular content',
      'Task scaling with Wide Research',
      'Generate unlimited business images',
      'Early access to beta features',
      '20 concurrent tasks',
      '20 scheduled tasks',
    ],
  },
} as const;

export type PlanId = keyof typeof PLAN_DEFINITIONS;

export type CreditPeriod = 'daily' | 'monthly';

/**
 * How often `User.creditsUsed` is zeroed for this plan. Unknown or missing
 * plan ids fall back to 'monthly', which is the conservative answer: it
 * refreshes a user's balance less often, never more.
 */
export function getCreditPeriod(planId: string | null | undefined): CreditPeriod {
  const plan = PLAN_DEFINITIONS[(planId || 'free').toLowerCase() as PlanId];
  return (plan as { creditPeriod?: CreditPeriod })?.creditPeriod ?? 'monthly';
}

// Helper function to get plan by ID
export function getPlanById(planId: string): typeof PLAN_DEFINITIONS[PlanId] | null {
  const normalizedId = planId.toLowerCase() as PlanId;
  return PLAN_DEFINITIONS[normalizedId] || null;
}

// Helper function to get plan by Stripe price ID
export function getPlanByPriceId(priceId: string): typeof PLAN_DEFINITIONS[PlanId] | null {
  for (const [key, plan] of Object.entries(PLAN_DEFINITIONS)) {
    if (plan.priceId === priceId) {
      return plan;
    }
  }
  return null;
}

// Helper to get credits for a plan
export function getCreditsForPlan(planId: string): number {
  const plan = getPlanById(planId);
  return plan?.credits || PLAN_DEFINITIONS.free.credits;
}

// Map for backward compatibility with existing code
export const PLAN_CREDITS: Record<string, number> = {
  free: PLAN_DEFINITIONS.free.credits,
  trial: PLAN_DEFINITIONS.trial.credits,
  pro: PLAN_DEFINITIONS.pro.credits,
  enterprise: PLAN_DEFINITIONS.enterprise.credits,
};

// Export PLANS for backward compatibility with existing code
export const PLANS = {
  FREE: PLAN_DEFINITIONS.free,
  TRIAL: PLAN_DEFINITIONS.trial,
  PRO: PLAN_DEFINITIONS.pro,
  ENTERPRISE: PLAN_DEFINITIONS.enterprise,
} as const;

export type PlanType = keyof typeof PLANS;

// A trial ranks alongside 'pro': the whole point of a card-required trial
// is that the customer is evaluating the paid product, so Pro-gated
// features (persistent memory, style profiles) must be available during it.
const TIER_ORDER: Record<PlanId, number> = { free: 0, trial: 1, pro: 1, enterprise: 2 };

/**
 * Whether a user on `planId` meets at least `minTier`. For gating a *feature*
 * to a plan tier (e.g. persistent cross-conversation memory is Pro+) —
 * unrelated to credit spend, which is metered separately.
 */
export function planMeetsMinTier(planId: string | null | undefined, minTier: PlanId): boolean {
  const tier = (planId || 'free').toLowerCase() as PlanId;
  return (TIER_ORDER[tier] ?? 0) >= TIER_ORDER[minTier];
}
