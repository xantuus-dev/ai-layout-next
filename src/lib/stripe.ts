import Stripe from 'stripe';

// Re-export plan definitions from centralized source
export { PLANS, PLAN_DEFINITIONS, PLAN_CREDITS, getPlanById, getPlanByPriceId, getCreditsForPlan } from './plans';
export type { PlanType, PlanId } from './plans';

// Gracefully handle missing Stripe key (e.g., when using only RevenueCat)
const stripeKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null;

// Helper to check if Stripe is configured
export const isStripeEnabled = () => !!stripe;
