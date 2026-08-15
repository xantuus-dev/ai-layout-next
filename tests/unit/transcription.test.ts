import { describe, it, expect } from 'vitest';
import {
  getTranscriptionCost,
  estimateSecondsFromBytes,
  TRANSCRIPTION_CREDITS_PER_MINUTE,
  MAX_CLIP_SECONDS,
} from '@/lib/transcription';

describe('getTranscriptionCost', () => {
  it('charges the per-minute rate for exactly one minute', () => {
    expect(getTranscriptionCost(60)).toBe(TRANSCRIPTION_CREDITS_PER_MINUTE);
  });

  it('prorates below a minute rather than rounding up to one', () => {
    // 30s at 6 credits/min is 3 — a short correction should not cost a full minute.
    expect(getTranscriptionCost(30)).toBe(3);
    expect(getTranscriptionCost(10)).toBe(1);
  });

  it('rounds partial credits up, so no clip is transcribed free', () => {
    // 25s -> 2.5 credits -> 3.
    expect(getTranscriptionCost(25)).toBe(3);
  });

  it('always charges at least one credit', () => {
    expect(getTranscriptionCost(0.5)).toBe(1);
    expect(getTranscriptionCost(0)).toBe(1);
  });

  it('does not return NaN or zero for malformed durations', () => {
    // The provider duration is parsed from JSON; a missing field must not
    // silently produce a free transcription.
    expect(getTranscriptionCost(NaN)).toBe(1);
    expect(getTranscriptionCost(-5)).toBe(1);
    expect(getTranscriptionCost(Infinity)).toBe(1);
  });

  it('scales linearly across the allowed range', () => {
    expect(getTranscriptionCost(120)).toBe(12);
  });
});

describe('estimateSecondsFromBytes', () => {
  it('errs high, so the pre-flight reserve covers the real charge', () => {
    // 32 kbps is 4000 bytes/sec, so 60s of real audio is ~240KB. The estimate
    // assumes 2000 bytes/sec and must therefore report more than the truth —
    // reserving less would let a spend pass pre-flight and then be refused
    // after the provider has already been paid.
    const realSixtySecondClip = 60 * 4000;
    expect(estimateSecondsFromBytes(realSixtySecondClip)).toBeGreaterThan(60);
  });

  it('never estimates beyond the clip cap', () => {
    expect(estimateSecondsFromBytes(50 * 1024 * 1024)).toBe(MAX_CLIP_SECONDS);
  });

  it('keeps the estimated cost at or above the actual cost', () => {
    for (const seconds of [5, 15, 30, 60, 90, 120]) {
      const bytes = seconds * 4000; // 32 kbps
      const estimated = getTranscriptionCost(estimateSecondsFromBytes(bytes));
      const actual = getTranscriptionCost(seconds);
      expect(estimated).toBeGreaterThanOrEqual(actual);
    }
  });
});
