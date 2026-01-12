import Stripe from 'stripe';

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

// Pricing tiers
export const PLANS = {
  FREE: {
    name: 'Free',
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
  PRO: {
    name: 'Pro',
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
  ENTERPRISE: {
    name: 'Enterprise',
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

export type PlanType = keyof typeof PLANS;
