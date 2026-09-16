import { describe, it, expect } from 'vitest';
import {
  getImageGenerationCost,
  IMAGE_GENERATION_CREDITS,
  IMAGE_PROVIDER_COST_USD,
} from '@/lib/credits';
import { CREDIT_TIER_PRICES } from '@/lib/pricing-config';

/**
 * Margin floor for anything we resell at a per-unit provider cost.
 *
 * 3x is deliberately below the ~5x this product targets: it is the line that
 * says "this is still a business", not the line that says "this is priced
 * well". A rate landing between 3x and 5x is a pricing conversation; a rate
 * below 3x is a bug, and a rate below 1x is money on fire.
 */
const MARGIN_FLOOR = 3;

/**
 * Every effective credit price a customer can actually obtain, in USD.
 *
 * Both billing cycles count. Yearly is monthly x 12 x 0.8, so an annual
 * subscriber on the largest tier buys credits ~20% cheaper than the monthly
 * headline rate — that subscriber is the worst case for margin, and is exactly
 * the one a test using only monthly prices would miss.
 */
function effectiveCreditPricesUsd(): Array<{ label: string; usdPerCredit: number }> {
  const prices: Array<{ label: string; usdPerCredit: number }> = [];

  for (const [key, tier] of Object.entries(CREDIT_TIER_PRICES)) {
    prices.push({
      label: `${key} monthly`,
      usdPerCredit: tier.monthlyPrice / tier.credits,
    });
    prices.push({
      label: `${key} yearly`,
      usdPerCredit: tier.yearlyPrice / 12 / tier.credits,
    });
  }

  return prices;
}

const cheapest = () =>
  effectiveCreditPricesUsd().reduce((min, p) => (p.usdPerCredit < min.usdPerCredit ? p : min));

describe('image generation margin', () => {
  it('charges the same for every size we offer', () => {
    // The provider bills a flat 1,290 tokens per image up to 1024x1024, so a
    // size-tiered price models a cost curve that does not exist. This is the
    // regression guard for the original bug: 512x512 used to cost 5 credits,
    // which sold below cost on every plan.
    const offered = [512, 1024, 1536];
    const costs = offered.map((size) => getImageGenerationCost(size, size));

    expect(new Set(costs).size).toBe(1);
    expect(costs[0]).toBe(IMAGE_GENERATION_CREDITS);
  });

  it('never sells an image for less than it costs to make, on any plan', () => {
    for (const { label, usdPerCredit } of effectiveCreditPricesUsd()) {
      const revenue = IMAGE_GENERATION_CREDITS * usdPerCredit;

      expect(
        revenue,
        `${label}: an image sells for $${revenue.toFixed(4)} against $${IMAGE_PROVIDER_COST_USD} of cost`
      ).toBeGreaterThan(IMAGE_PROVIDER_COST_USD);
    }
  });

  it('clears the margin floor even for the cheapest credits sold', () => {
    const worst = cheapest();
    const revenue = IMAGE_GENERATION_CREDITS * worst.usdPerCredit;
    const multiple = revenue / IMAGE_PROVIDER_COST_USD;

    expect(
      multiple,
      `${worst.label} buys credits at $${worst.usdPerCredit.toFixed(5)}, putting images at ${multiple.toFixed(2)}x cost`
    ).toBeGreaterThanOrEqual(MARGIN_FLOOR);
  });

  it('keeps the credit ladder itself able to support a resold unit cost', () => {
    // Rates elsewhere in credits.ts are calibrated on "1 credit ~= $0.001 of
    // provider cost" (see the video tables). Under that convention the margin
    // multiple on any correctly-calibrated rate is just usdPerCredit * 1000,
    // independent of the rate. So if the cheapest credit ever sold drops below
    // $0.003, every such rate breaks at once and no per-rate test would catch
    // it. This is the guard on adding a cheaper mega-tier.
    const worst = cheapest();
    const impliedMultiple = worst.usdPerCredit * 1000;

    expect(
      impliedMultiple,
      `${worst.label} at $${worst.usdPerCredit.toFixed(5)}/credit puts every $0.001-calibrated rate at ${impliedMultiple.toFixed(2)}x`
    ).toBeGreaterThanOrEqual(MARGIN_FLOOR);
  });
});
