/**
 * Granular Stripe price catalog — the actual paid tiers /pricing sells and
 * the Stripe webhook reads to set a user's real `monthlyCredits`.
 * See plans.ts for how this relates to the coarse free/pro/enterprise
 * label also stored on User.plan (a display badge, not the source of truth
 * for credit limits).
 *
 * SETUP INSTRUCTIONS:
 * 1. Create products in Stripe Dashboard (https://dashboard.stripe.com/products)
 * 2. For each credit tier, create TWO prices: monthly and yearly (yearly = monthly * 12 * 0.8)
 * 3. Copy the price IDs and add them to .env.local
 * 4. Update the CREDIT_TIER_PRICES object below with your price IDs
 */

import { TRIAL_PERIOD_DAYS } from './plans';

export interface PriceTier {
  credits: number;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  priceIds: {
    monthly: string | null;
    yearly: string | null;
  };
  popular?: boolean;
}

/**
 * All available credit tiers with pricing
 * Yearly pricing is automatically 20% off (monthly * 12 * 0.8)
 *
 * The 4,000 tier at $29.95 is the entry plan and the tier a finished trial
 * converts into — see TRIAL_PERIOD_DAYS in plans.ts and the checkout route.
 */
export const ENTRY_TIER_CREDITS = 4000;

/**
 * The $9.95 / 14-day introductory offer — the primary acquisition CTA.
 *
 * Deliberately NOT built on Stripe's trial mechanics, for two reasons:
 *
 * 1. Stripe's Trial Offer API (the supported way to do a *paid* trial) is
 *    explicitly unsupported in Checkout and needs the 2026-03-25.preview API
 *    version plus flexible billing mode. This integration is on 2024-06-20
 *    Checkout.
 * 2. The legacy `trial_period_days` route defers the first charge to the end
 *    of the trial, which is the opposite of what a paid intro offer needs —
 *    the customer must be charged $9.95 today.
 *
 * So the offer is modelled as what it actually is: a real subscription on a
 * 14-day price, billed immediately at checkout, with a subscription schedule
 * that transitions it to the monthly entry tier after one cycle. That means
 * subscription.status is 'active' throughout, never 'trialing' — entitlement
 * is keyed off the PRICE, via isIntroTrialPriceId(), not the status.
 *
 * Create the Stripe price as: $9.95, recurring, interval=day, interval_count=14.
 */
export const INTRO_TRIAL = {
  price: 9.95,
  // Single source of truth, shared with the plan definitions — the advertised
  // length and the length the offer actually runs for cannot drift apart.
  days: TRIAL_PERIOD_DAYS,
  /** Tier the offer converts into when the 14 days elapse. */
  convertsToCredits: ENTRY_TIER_CREDITS,
  priceId: process.env.NEXT_PUBLIC_STRIPE_TRIAL_14D_PRICE_ID || null,
} as const;

/** Whether a Stripe price id is the introductory 14-day offer. */
export function isIntroTrialPriceId(priceId: string | null | undefined): boolean {
  return !!priceId && !!INTRO_TRIAL.priceId && priceId === INTRO_TRIAL.priceId;
}

/** The recurring price the intro offer transitions into. */
export function getIntroTrialTargetPriceId(billingCycle: 'monthly' | 'yearly' = 'monthly'): string | null {
  return getPriceId(ENTRY_TIER_CREDITS, billingCycle);
}
export const CREDIT_TIER_PRICES: Record<string, PriceTier> = {
  // Entry tier. Every 14-day trial converts to this one unless the customer
  // picks another at checkout, so it is the default landing point for the
  // whole funnel. Priced above the $0.005/credit rate the larger tiers use
  // ($0.00749 here) — the entry tier is deliberately the least generous
  // per credit, which is what makes stepping up to 8,000 worthwhile.
  '4000': {
    credits: 4000,
    displayName: '4,000 credits / month',
    monthlyPrice: 29.95,
    yearlyPrice: 287.52, // 29.95 * 12 * 0.8
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_4000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_4000_YEARLY_PRICE_ID || null,
    },
  },
  '8000': {
    credits: 8000,
    displayName: '8,000 credits / month',
    monthlyPrice: 40,
    yearlyPrice: 384, // 40 * 12 * 0.8
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_8000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_8000_YEARLY_PRICE_ID || null,
    },
  },
  '12000': {
    credits: 12000,
    displayName: '12,000 credits / month',
    monthlyPrice: 60,
    yearlyPrice: 576, // 60 * 12 * 0.8
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_12000_YEARLY_PRICE_ID || null,
    },
    popular: true, // Default selection
  },
  '16000': {
    credits: 16000,
    displayName: '16,000 credits / month',
    monthlyPrice: 80,
    yearlyPrice: 768,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_16000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_16000_YEARLY_PRICE_ID || null,
    },
  },
  '20000': {
    credits: 20000,
    displayName: '20,000 credits / month',
    monthlyPrice: 100,
    yearlyPrice: 960,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_20000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_20000_YEARLY_PRICE_ID || null,
    },
  },
  '40000': {
    credits: 40000,
    displayName: '40,000 credits / month',
    monthlyPrice: 185,
    yearlyPrice: 1776,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_40000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_40000_YEARLY_PRICE_ID || null,
    },
  },
  '63000': {
    credits: 63000,
    displayName: '63,000 credits / month',
    monthlyPrice: 280,
    yearlyPrice: 2688,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_63000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_63000_YEARLY_PRICE_ID || null,
    },
  },
  '85000': {
    credits: 85000,
    displayName: '85,000 credits / month',
    monthlyPrice: 370,
    yearlyPrice: 3552,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_85000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_85000_YEARLY_PRICE_ID || null,
    },
  },
  '110000': {
    credits: 110000,
    displayName: '110,000 credits / month',
    monthlyPrice: 475,
    yearlyPrice: 4560,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_110000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_110000_YEARLY_PRICE_ID || null,
    },
  },
  '170000': {
    credits: 170000,
    displayName: '170,000 credits / month',
    monthlyPrice: 725,
    yearlyPrice: 6960,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_170000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_170000_YEARLY_PRICE_ID || null,
    },
  },
  '230000': {
    credits: 230000,
    displayName: '230,000 credits / month',
    monthlyPrice: 975,
    yearlyPrice: 9360,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_230000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_230000_YEARLY_PRICE_ID || null,
    },
  },
  '350000': {
    credits: 350000,
    displayName: '350,000 credits / month',
    monthlyPrice: 1470,
    yearlyPrice: 14112,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_350000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_350000_YEARLY_PRICE_ID || null,
    },
  },
  '480000': {
    credits: 480000,
    displayName: '480,000 credits / month',
    monthlyPrice: 2010,
    yearlyPrice: 19296,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_480000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_480000_YEARLY_PRICE_ID || null,
    },
  },
  '1200000': {
    credits: 1200000,
    displayName: '1,200,000 credits / month',
    monthlyPrice: 5000,
    yearlyPrice: 48000,
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_1200000_MONTHLY_PRICE_ID || null,
      yearly: process.env.NEXT_PUBLIC_STRIPE_1200000_YEARLY_PRICE_ID || null,
    },
  },
};

export interface CreditPack {
  credits: number;
  displayName: string;
  price: number;
  priceId: string | null;
}

/**
 * One-time "top up" credit packs, billed as a single Stripe payment
 * (mode: 'payment', not a subscription). These stack on top of whatever
 * plan the user is on and are consumed before the next monthly reset —
 * they are not a substitute for a recurring plan.
 *
 * Create these as one-time (non-recurring) Prices in the Stripe Dashboard
 * and add the resulting price IDs to .env.local.
 */
export const CREDIT_PACK_PRICES: CreditPack[] = [
  {
    credits: 1000,
    displayName: '1,000 credits',
    price: 8,
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_1000_PRICE_ID || null,
  },
  {
    credits: 5000,
    displayName: '5,000 credits',
    price: 35,
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_5000_PRICE_ID || null,
  },
  {
    credits: 20000,
    displayName: '20,000 credits',
    price: 120,
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_20000_PRICE_ID || null,
  },
];

/**
 * Get a credit pack's Stripe price ID by credit amount (for webhook processing)
 */
export function getCreditPackByPriceId(priceId: string): CreditPack | null {
  return CREDIT_PACK_PRICES.find(pack => pack.priceId === priceId) || null;
}

/**
 * Get price tier by credit amount
 */
export function getPriceTier(credits: number): PriceTier | null {
  return CREDIT_TIER_PRICES[credits.toString()] || null;
}

/**
 * Get price ID for a specific tier and billing cycle
 */
export function getPriceId(credits: number, billingCycle: 'monthly' | 'yearly'): string | null {
  const tier = getPriceTier(credits);
  return tier?.priceIds[billingCycle] || null;
}

/**
 * Get credit amount from display name
 */
export function getCreditsFromDisplayName(displayName: string): number | null {
  for (const [key, tier] of Object.entries(CREDIT_TIER_PRICES)) {
    if (tier.displayName === displayName) {
      return tier.credits;
    }
  }
  return null;
}

/**
 * Get price tier by Stripe price ID (for webhook processing)
 */
export function getPriceTierByPriceId(priceId: string): PriceTier | null {
  for (const tier of Object.values(CREDIT_TIER_PRICES)) {
    if (tier.priceIds.monthly === priceId || tier.priceIds.yearly === priceId) {
      return tier;
    }
  }
  return null;
}

/**
 * Get billing cycle from price ID
 */
export function getBillingCycleFromPriceId(priceId: string): 'monthly' | 'yearly' | null {
  for (const tier of Object.values(CREDIT_TIER_PRICES)) {
    if (tier.priceIds.monthly === priceId) return 'monthly';
    if (tier.priceIds.yearly === priceId) return 'yearly';
  }
  return null;
}

/**
 * Get all available credit options (for dropdown)
 */
export function getAvailableCreditOptions(): string[] {
  return Object.values(CREDIT_TIER_PRICES).map(tier => tier.displayName);
}

/**
 * Calculate cost per 1K credits
 */
export function getCostPer1KCredits(credits: number, price: number): number {
  return parseFloat(((price / credits) * 1000).toFixed(2));
}

/**
 * Validate if a price ID is configured
 */
export function isPriceIdConfigured(priceId: string | null): boolean {
  if (!priceId) return false;
  return priceId.startsWith('price_') || priceId.startsWith('price_test_');
}

/**
 * Check if pricing is properly configured
 */
export function isPricingConfigured(): boolean {
  // Check if at least one tier has both monthly and yearly prices configured
  return Object.values(CREDIT_TIER_PRICES).some(
    tier => isPriceIdConfigured(tier.priceIds.monthly) && isPriceIdConfigured(tier.priceIds.yearly)
  );
}

/**
 * Get missing price configurations (for admin debugging)
 */
export function getMissingPriceConfigs(): Array<{ credits: number; missing: string[] }> {
  const missing: Array<{ credits: number; missing: string[] }> = [];

  for (const tier of Object.values(CREDIT_TIER_PRICES)) {
    const missingPrices: string[] = [];
    if (!isPriceIdConfigured(tier.priceIds.monthly)) {
      missingPrices.push('monthly');
    }
    if (!isPriceIdConfigured(tier.priceIds.yearly)) {
      missingPrices.push('yearly');
    }
    if (missingPrices.length > 0) {
      missing.push({ credits: tier.credits, missing: missingPrices });
    }
  }

  return missing;
}
