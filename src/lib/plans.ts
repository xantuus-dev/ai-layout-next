/**
 * Centralized plan definitions
 * This is the SINGLE SOURCE OF TRUTH for all plan configurations
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
