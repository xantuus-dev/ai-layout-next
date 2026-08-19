import { describe, expect, it } from 'vitest';
import { planMeetsMinTier } from '@/lib/plans';

describe('planMeetsMinTier', () => {
  it('allows a plan at exactly the minimum tier', () => {
    expect(planMeetsMinTier('pro', 'pro')).toBe(true);
  });

  it('allows a plan above the minimum tier', () => {
    expect(planMeetsMinTier('enterprise', 'pro')).toBe(true);
  });

  it('denies a plan below the minimum tier', () => {
    expect(planMeetsMinTier('free', 'pro')).toBe(false);
  });

  it('treats a missing plan as free', () => {
    expect(planMeetsMinTier(null, 'pro')).toBe(false);
    expect(planMeetsMinTier(undefined, 'pro')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(planMeetsMinTier('PRO', 'pro')).toBe(true);
    expect(planMeetsMinTier('Enterprise', 'pro')).toBe(true);
  });

  it('treats an unrecognized plan as free', () => {
    expect(planMeetsMinTier('nonsense-plan', 'free')).toBe(true);
    expect(planMeetsMinTier('nonsense-plan', 'pro')).toBe(false);
  });
});
