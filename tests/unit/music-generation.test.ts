import { describe, it, expect } from 'vitest';
import {
  clampMusicLength,
  MIN_MUSIC_LENGTH_MS,
  MAX_MUSIC_LENGTH_MS,
  DEFAULT_MUSIC_LENGTH_MS,
} from '@/lib/music-generation';
import { getMusicGenerationCost, MUSIC_GENERATION_CREDITS_PER_MINUTE } from '@/lib/credits';

describe('clampMusicLength', () => {
  it('passes an in-range length through untouched', () => {
    expect(clampMusicLength(45_000)).toBe(45_000);
  });

  it('clamps rather than rejects an over-long request', () => {
    // The agent executor fills this parameter from a model, and failing the
    // whole run because a model asked for 15 minutes is worse for the user
    // than composing the 10 it can actually have.
    expect(clampMusicLength(900_000)).toBe(MAX_MUSIC_LENGTH_MS);
  });

  it('clamps an under-short request up to the provider minimum', () => {
    expect(clampMusicLength(500)).toBe(MIN_MUSIC_LENGTH_MS);
  });

  it('falls back to the default when no length is given', () => {
    expect(clampMusicLength(undefined)).toBe(DEFAULT_MUSIC_LENGTH_MS);
  });

  it('falls back to the default on non-finite input', () => {
    expect(clampMusicLength(NaN)).toBe(DEFAULT_MUSIC_LENGTH_MS);
    expect(clampMusicLength(Infinity)).toBe(DEFAULT_MUSIC_LENGTH_MS);
    expect(clampMusicLength('60000' as unknown as number)).toBe(DEFAULT_MUSIC_LENGTH_MS);
  });

  it('rounds a fractional length to whole milliseconds', () => {
    expect(clampMusicLength(30_000.7)).toBe(30_001);
  });
});

describe('getMusicGenerationCost', () => {
  it('charges the per-minute rate for exactly one minute', () => {
    expect(getMusicGenerationCost(60_000)).toBe(MUSIC_GENERATION_CREDITS_PER_MINUTE);
  });

  it('scales with duration', () => {
    const thirty = getMusicGenerationCost(30_000);
    const sixty = getMusicGenerationCost(60_000);

    expect(sixty).toBeGreaterThan(thirty);
    expect(thirty).toBe(MUSIC_GENERATION_CREDITS_PER_MINUTE / 2);
  });

  it('never charges zero for a real track', () => {
    // A three-second sting still costs the provider money.
    expect(getMusicGenerationCost(MIN_MUSIC_LENGTH_MS)).toBeGreaterThanOrEqual(1);
  });

  it('always returns a whole number of credits', () => {
    for (const ms of [3_000, 7_500, 30_000, 45_123, 600_000]) {
      expect(Number.isInteger(getMusicGenerationCost(ms))).toBe(true);
    }
  });

  it('quotes the same price the run will actually be charged', () => {
    // generateMusicForUser quotes against the clamped length, so an
    // out-of-range request must not produce an estimate that differs from
    // what the user is billed.
    const requested = 900_000;
    expect(getMusicGenerationCost(clampMusicLength(requested))).toBe(
      getMusicGenerationCost(MAX_MUSIC_LENGTH_MS)
    );
  });
});
