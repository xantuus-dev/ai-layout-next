import { describe, it, expect } from 'vitest';
import { javascriptSkillCost, SKILL_EXECUTION_MIN_CREDITS } from '@/lib/skills/skill-executor';

/**
 * A javascript skill boots a Vercel Sandbox microVM on every run. Before this
 * existed, the executor computed a credit figure, logged it, and never charged
 * it — so any authenticated user could run sandboxed compute in a loop for
 * free. The cost must also never be zero just because the skill's publisher
 * said so: estimatedCreditCost is creator-supplied and defaults to 0.
 */
describe('javascriptSkillCost', () => {
  it('charges what the skill declares when that clears the floor', () => {
    expect(javascriptSkillCost(120)).toBe(120);
    expect(javascriptSkillCost(SKILL_EXECUTION_MIN_CREDITS + 1)).toBe(
      SKILL_EXECUTION_MIN_CREDITS + 1
    );
  });

  it('never charges less than the floor, whatever the publisher declared', () => {
    for (const declared of [0, 1, 10, -5, -1000]) {
      expect(javascriptSkillCost(declared), `declared ${declared}`).toBe(
        SKILL_EXECUTION_MIN_CREDITS
      );
    }
  });

  it('falls back to the floor for values that are not usable numbers', () => {
    for (const declared of [undefined, null, NaN, Infinity, 'free', {}, []]) {
      expect(javascriptSkillCost(declared), String(declared)).toBe(
        SKILL_EXECUTION_MIN_CREDITS
      );
    }
  });

  it('always returns a positive whole number of credits', () => {
    for (const declared of [0.1, 25.4, 99.9, 1e6]) {
      const cost = javascriptSkillCost(declared);
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    }
  });

  it('rounds a fractional declared cost up, never down', () => {
    // Rounding down would let 100 runs of a 25.4-credit skill cost 40 credits
    // less than they should; the direction matters more than the amount.
    expect(javascriptSkillCost(25.4)).toBe(26);
    expect(javascriptSkillCost(99.1)).toBe(100);
  });
});
