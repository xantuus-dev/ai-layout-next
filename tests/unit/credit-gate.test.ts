import { describe, it, expect } from 'vitest';
import { canAfford, estimateTurnCredits, ESTIMATED_TOKENS_PER_TURN } from '@/lib/credits';

describe('canAfford: the exhausted-balance boundary', () => {
  it('refuses a user whose credits are exactly exhausted', () => {
    // The bug: hasEnoughCredits(userId, 0) evaluated 4000 + 0 <= 4000 => true,
    // so a fully spent account kept being served.
    expect(canAfford(4000, 4000, 6)).toBe(false);
  });

  it('refuses a request that would push the user past the limit', () => {
    expect(canAfford(3999, 4000, 6)).toBe(false);
  });

  it('allows a request that fits exactly', () => {
    expect(canAfford(3994, 4000, 6)).toBe(true);
  });

  it('allows a user with plenty left', () => {
    expect(canAfford(100, 4000, 6)).toBe(true);
  });

  it('treats a zero requirement as costing at least one credit', () => {
    // Guards the original defect directly: passing 0 must not wave through an
    // account with nothing remaining.
    expect(canAfford(4000, 4000, 0)).toBe(false);
    expect(canAfford(3999, 4000, 0)).toBe(true);
  });

  it('refuses an already overdrawn account', () => {
    // creditsUsed can exceed monthlyCredits after a large final request.
    expect(canAfford(4500, 4000, 1)).toBe(false);
  });

  it('allows banked credits, which are stored as negative usage', () => {
    // Purchased packs decrement creditsUsed, so it can go below zero.
    expect(canAfford(-500, 4000, 6)).toBe(true);
  });

  it('refuses everything on a zero-credit plan', () => {
    expect(canAfford(0, 0, 1)).toBe(false);
  });
});

describe('estimateTurnCredits', () => {
  it('scales with the model rate, so an expensive model is refused sooner', () => {
    const haiku = estimateTurnCredits(1);
    const sonnet = estimateTurnCredits(3);
    const opus = estimateTurnCredits(15);

    expect(haiku).toBeLessThan(sonnet);
    expect(sonnet).toBeLessThan(opus);
  });

  it('uses the documented per-turn token assumption', () => {
    // 2000 tokens at 3 credits/1k = 6
    expect(estimateTurnCredits(3)).toBe((ESTIMATED_TOKENS_PER_TURN / 1000) * 3);
  });

  it('rounds up rather than down, so a turn is never estimated as free', () => {
    expect(estimateTurnCredits(0.1)).toBe(1);
  });

  it('falls back to the cheapest rate on invalid input, never to free', () => {
    // An unusable rate is treated as 1 credit/1k, so a 2000-token turn costs 2.
    // The guarantee is "never zero", not "exactly one" — charging nothing for
    // an unknown model is the failure mode worth preventing.
    const fallback = (ESTIMATED_TOKENS_PER_TURN / 1000) * 1;
    expect(estimateTurnCredits(0)).toBe(fallback);
    expect(estimateTurnCredits(-5)).toBe(fallback);
    expect(estimateTurnCredits(NaN)).toBe(fallback);
    expect(estimateTurnCredits(0)).toBeGreaterThanOrEqual(1);
  });
});
