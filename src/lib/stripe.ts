import Stripe from 'stripe';

// Re-export plan definitions from centralized source
export { PLANS, PLAN_DEFINITIONS, PLAN_CREDITS, getPlanById, getPlanByPriceId, getCreditsForPlan } from './plans';
export type { PlanType, PlanId } from './plans';

// Gracefully handle missing Stripe key (e.g., when using only RevenueCat)
const stripeKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeKey
  ? new Stripe(stripeKey, {
      // @ts-ignore - Using stable API version instead of beta version
      apiVersion: '2024-06-20',
      typescript: true,
    })
  : null;

// Helper to check if Stripe is configured
export const isStripeEnabled = () => !!stripe;
