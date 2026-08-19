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
 */

export const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    price: 0,
    priceId: null,
    credits: 4000,
    features: [
      '500 refresh credits everyday',
      '4,000 credits per month',
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
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    credits: 12000,
    features: [
      '500 refresh credits everyday',
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
    features: [
      '500 refresh credits everyday',
      '40,000 credits per month',
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
  pro: PLAN_DEFINITIONS.pro.credits,
  enterprise: PLAN_DEFINITIONS.enterprise.credits,
};

// Export PLANS for backward compatibility with existing code
export const PLANS = {
  FREE: PLAN_DEFINITIONS.free,
  PRO: PLAN_DEFINITIONS.pro,
  ENTERPRISE: PLAN_DEFINITIONS.enterprise,
} as const;

export type PlanType = keyof typeof PLANS;

const TIER_ORDER: Record<PlanId, number> = { free: 0, pro: 1, enterprise: 2 };

/**
 * Whether a user on `planId` meets at least `minTier`. For gating a *feature*
 * to a plan tier (e.g. persistent cross-conversation memory is Pro+) —
 * unrelated to credit spend, which is metered separately.
 */
export function planMeetsMinTier(planId: string | null | undefined, minTier: PlanId): boolean {
  const tier = (planId || 'free').toLowerCase() as PlanId;
  return (TIER_ORDER[tier] ?? 0) >= TIER_ORDER[minTier];
}
