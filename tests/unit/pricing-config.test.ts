import { describe, it, expect } from 'vitest';
import {
  CREDIT_TIER_PRICES,
  CREDIT_PACK_PRICES,
  getPriceTier,
  getPriceTierByPriceId,
  getCreditPackByPriceId,
  isPriceIdConfigured,
} from '@/lib/pricing-config';

describe('pricing-config helpers', () => {
  it('getPriceTier finds a tier by credit amount', () => {
    const tier = getPriceTier(12000);
    expect(tier).not.toBeNull();
    expect(tier!.credits).toBe(12000);
  });

  it('getPriceTier returns null for a credit amount with no matching tier', () => {
    expect(getPriceTier(999999999)).toBeNull();
  });

  it('every CREDIT_TIER_PRICES entry is keyed by its own credit amount as a string', () => {
    for (const [key, tier] of Object.entries(CREDIT_TIER_PRICES)) {
      expect(tier.credits).toBe(Number(key));
    }
  });

  it('isPriceIdConfigured rejects null/empty and non price_-prefixed values', () => {
    expect(isPriceIdConfigured(null)).toBe(false);
    expect(isPriceIdConfigured('')).toBe(false);
    expect(isPriceIdConfigured('not-a-real-id')).toBe(false);
    expect(isPriceIdConfigured('price_abc123')).toBe(true);
  });

  it('getPriceTierByPriceId round-trips for a tier that has a configured monthly price ID', () => {
    const configuredTier = Object.values(CREDIT_TIER_PRICES).find(
      (t) => t.priceIds.monthly && isPriceIdConfigured(t.priceIds.monthly)
    );
    // Skip gracefully in environments without real Stripe price IDs configured
    if (!configuredTier) return;

    const found = getPriceTierByPriceId(configuredTier.priceIds.monthly!);
    expect(found?.credits).toBe(configuredTier.credits);
  });

  it('getPriceTierByPriceId returns null for an unrecognized price ID', () => {
    expect(getPriceTierByPriceId('price_does_not_exist')).toBeNull();
  });

  it('getCreditPackByPriceId returns null for an unconfigured/unrecognized price ID', () => {
    expect(getCreditPackByPriceId('price_does_not_exist')).toBeNull();
  });

  it('CREDIT_PACK_PRICES are one-time packs with positive credit amounts and prices', () => {
    expect(CREDIT_PACK_PRICES.length).toBeGreaterThan(0);
    for (const pack of CREDIT_PACK_PRICES) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeGreaterThan(0);
    }
  });
});
