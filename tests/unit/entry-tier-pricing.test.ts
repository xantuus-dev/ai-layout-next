import { describe, it, expect } from 'vitest';
import {
  CREDIT_TIER_PRICES,
  ENTRY_TIER_CREDITS,
  getPriceTier,
  getCostPer1KCredits,
} from '@/lib/pricing-config';
import {
  PLAN_DEFINITIONS,
  TRIAL_DAILY_CREDITS,
  TRIAL_PERIOD_DAYS,
  getCreditPeriod,
  planMeetsMinTier,
} from '@/lib/plans';

describe('$29.95 entry tier', () => {
  const entry = CREDIT_TIER_PRICES[String(ENTRY_TIER_CREDITS)];

  it('exists at 4,000 credits for $29.95', () => {
    expect(ENTRY_TIER_CREDITS).toBe(4000);
    expect(entry.credits).toBe(4000);
    expect(entry.monthlyPrice).toBe(29.95);
  });

  it('is reachable through the same lookup the Stripe webhook uses', () => {
    expect(getPriceTier(ENTRY_TIER_CREDITS)).toBe(entry);
  });

  it('applies the catalog-wide 20% yearly discount', () => {
    expect(entry.yearlyPrice).toBeCloseTo(entry.monthlyPrice * 12 * 0.8, 2);
  });

  it('is the cheapest entry point but the priciest per credit', () => {
    const tiers = Object.values(CREDIT_TIER_PRICES);
    const cheapestMonthly = Math.min(...tiers.map((t) => t.monthlyPrice));
    expect(entry.monthlyPrice).toBe(cheapestMonthly);

    // Deliberate: the entry tier is the least generous per credit, which is
    // what makes stepping up to a larger tier worth doing.
    const perCredit = (t: { monthlyPrice: number; credits: number }) => t.monthlyPrice / t.credits;
    const dearest = Math.max(...tiers.map(perCredit));
    expect(perCredit(entry)).toBe(dearest);
    expect(getCostPer1KCredits(entry.credits, entry.monthlyPrice)).toBe(7.49);
  });

  it('does not collide with the 8,000 tier it sits below', () => {
    expect(CREDIT_TIER_PRICES['8000'].credits).toBeGreaterThan(entry.credits);
    expect(CREDIT_TIER_PRICES['8000'].monthlyPrice).toBeGreaterThan(entry.monthlyPrice);
  });
});

describe('trial replaces the free tier', () => {
  it('grants nothing on the no-plan state', () => {
    expect(PLAN_DEFINITIONS.free.credits).toBe(0);
    expect(getCreditPeriod('free')).toBe('monthly');
  });

  it('grants the daily trial allowance for 14 days', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(14);
    expect(PLAN_DEFINITIONS.trial.credits).toBe(TRIAL_DAILY_CREDITS);
    expect(getCreditPeriod('trial')).toBe('daily');
  });

  it('caps what one unconverted trial can cost', () => {
    // Worst case is every daily grant fully spent, at the blended provider
    // rate from the cost model. Guards against someone raising the daily
    // grant without re-checking the trial's cost ceiling.
    const BLENDED_COST_PER_CREDIT = 0.0021;
    const worstCase = TRIAL_DAILY_CREDITS * TRIAL_PERIOD_DAYS * BLENDED_COST_PER_CREDIT;
    expect(worstCase).toBeLessThan(10);
  });

  it('treats a trial as equivalent to Pro for feature gating', () => {
    // A card-required trial is an evaluation of the paid product, so
    // Pro-gated features (persistent memory, style profiles) must work
    // during it — otherwise the trial demos a lesser product than the one
    // the customer is about to be charged for.
    expect(planMeetsMinTier('trial', 'pro')).toBe(true);
    expect(planMeetsMinTier('trial', 'enterprise')).toBe(false);
    expect(planMeetsMinTier('free', 'pro')).toBe(false);
  });
});
