import { describe, it, expect } from 'vitest';
import {
  getVideoPipelineCost,
  getVideoGenerationCost,
  getAudioGenerationCost,
  VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS,
} from '@/lib/credits';

describe('getVideoPipelineCost', () => {
  it('sums per-scene video + audio cost plus the flat stitching surcharge', () => {
    const scenes = [{ durationSeconds: 4 }, { durationSeconds: 6 }];
    const voiceoverCharCounts = [40, 60];

    const expected =
      getVideoGenerationCost(4) +
      getVideoGenerationCost(6) +
      getAudioGenerationCost(40) +
      getAudioGenerationCost(60) +
      VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS;

    expect(getVideoPipelineCost(scenes, voiceoverCharCounts)).toBe(expected);
  });

  it('respects per-scene resolution overrides', () => {
    const scenes = [{ durationSeconds: 8, resolution: '4k' as const }];
    const cost = getVideoPipelineCost(scenes, [0]);
    expect(cost).toBe(
      getVideoGenerationCost(8, '4k') + getAudioGenerationCost(0) + VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS
    );
  });

  it('never returns less than 1', () => {
    expect(getVideoPipelineCost([], [])).toBeGreaterThanOrEqual(1);
  });
});
