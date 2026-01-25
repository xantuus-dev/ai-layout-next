/**
 * Centralized Pricing Configuration
 * This is the SINGLE SOURCE OF TRUTH for all pricing tiers and Stripe price IDs
 *
 * SETUP INSTRUCTIONS:
 * 1. Create products in Stripe Dashboard (https://dashboard.stripe.com/products)
 * 2. For each credit tier, create TWO prices: monthly and yearly (yearly = monthly * 12 * 0.8)
 * 3. Copy the price IDs and add them to .env.local
 * 4. Update the CREDIT_TIER_PRICES object below with your price IDs
 */

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
 */
export const CREDIT_TIER_PRICES: Record<string, PriceTier> = {
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
