import { describe, it, expect, vi } from 'vitest';

/**
 * Checkout takes a Stripe price id from the request body. isSellablePriceId is
 * what stops that being "any price in the account", which mattered twice:
 *
 *  - PLANS.pro bills $29 for the same 12,000 credits CREDIT_TIER_PRICES sells
 *    at $60, so anyone who learned STRIPE_PRO_PRICE_ID could self-serve the
 *    same product at half price.
 *  - updateUserSubscription falls back to the free plan and zero credits for a
 *    price it cannot resolve, so an unvalidated checkout could take money and
 *    grant nothing.
 */

vi.hoisted(() => {
  // pricing-config reads these at module load; vi.hoisted runs before imports.
  process.env.NEXT_PUBLIC_STRIPE_4000_MONTHLY_PRICE_ID = 'price_entry_monthly';
  process.env.NEXT_PUBLIC_STRIPE_4000_YEARLY_PRICE_ID = 'price_entry_yearly';
  process.env.NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID = 'price_12k_monthly';
  process.env.NEXT_PUBLIC_STRIPE_TRIAL_14D_PRICE_ID = 'price_intro_14d';
  process.env.STRIPE_PRO_PRICE_ID = 'price_legacy_pro';
  process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_legacy_enterprise';
});

import { isSellablePriceId } from '@/lib/pricing-config';

describe('isSellablePriceId', () => {
  it('accepts catalog tiers in both billing cycles', () => {
    expect(isSellablePriceId('price_entry_monthly')).toBe(true);
    expect(isSellablePriceId('price_entry_yearly')).toBe(true);
    expect(isSellablePriceId('price_12k_monthly')).toBe(true);
  });

  it('accepts the intro offer, which is not a CREDIT_TIER_PRICES entry', () => {
    expect(isSellablePriceId('price_intro_14d')).toBe(true);
  });

  it('rejects the legacy fixed-tier prices the web checkout does not sell', () => {
    // These are configured in every environment but are not catalog tiers.
    // Accepting them would sell 12,000 credits for $29 instead of $60.
    expect(isSellablePriceId('price_legacy_pro')).toBe(false);
    expect(isSellablePriceId('price_legacy_enterprise')).toBe(false);
  });

  it('rejects anything not in the catalog', () => {
    expect(isSellablePriceId('price_someone_elses_deal')).toBe(false);
    expect(isSellablePriceId('price_test_leftover')).toBe(false);
  });

  it('rejects empty and missing input rather than throwing', () => {
    expect(isSellablePriceId(null)).toBe(false);
    expect(isSellablePriceId(undefined)).toBe(false);
    expect(isSellablePriceId('')).toBe(false);
  });
});
