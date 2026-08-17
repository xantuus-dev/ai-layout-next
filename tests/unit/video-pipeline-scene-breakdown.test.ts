import { describe, it, expect, vi, beforeEach } from 'vitest';

const chat = vi.fn();
vi.mock('@/lib/ai-providers', () => ({
  aiRouter: { chat: (...args: unknown[]) => chat(...args) },
}));

import { breakdownConcept, MAX_SCENES } from '@/lib/video-pipeline/scene-breakdown';

function chatContent(scenes: unknown[]): string {
  return '```json\n' + JSON.stringify(scenes) + '\n```';
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('breakdownConcept', () => {
  it('parses a fenced JSON scene array into pending SceneSpecs', async () => {
    chat.mockResolvedValue({
      content: chatContent([
        { veoPrompt: 'coffee pour', voiceoverText: 'Great mornings start here.', durationSeconds: '4' },
        { veoPrompt: 'coffee sip', voiceoverText: 'Every single day.', durationSeconds: '6' },
      ]),
    });

    const scenes = await breakdownConcept({
      concept: 'A coffee ad',
      targetDurationSeconds: 10,
      aspectRatio: '16:9',
    });

    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toMatchObject({ order: 0, status: 'pending', durationSeconds: '4' });
    expect(scenes[1]).toMatchObject({ order: 1, status: 'pending', durationSeconds: '6' });
  });

  it('truncates to MAX_SCENES when the model returns too many', async () => {
    const many = Array.from({ length: MAX_SCENES + 3 }, (_, i) => ({
      veoPrompt: `scene ${i}`,
      voiceoverText: `line ${i}`,
      durationSeconds: '4',
    }));
    chat.mockResolvedValue({ content: chatContent(many) });

    const scenes = await breakdownConcept({
      concept: 'A long concept',
      targetDurationSeconds: 60,
      aspectRatio: '16:9',
    });

    expect(scenes).toHaveLength(MAX_SCENES);
  });

  it('rejects a scene with a duration Veo does not support', async () => {
    chat.mockResolvedValue({
      content: chatContent([{ veoPrompt: 'p', voiceoverText: 'v', durationSeconds: '10' }]),
    });

    await expect(
      breakdownConcept({ concept: 'x', targetDurationSeconds: 10, aspectRatio: '16:9' })
    ).rejects.toThrow(/durationSeconds/);
  });

  it('throws a descriptive error when the model response has no parseable JSON', async () => {
    chat.mockResolvedValue({ content: 'Sorry, I cannot help with that.' });

    await expect(
      breakdownConcept({ concept: 'x', targetDurationSeconds: 10, aspectRatio: '16:9' })
    ).rejects.toThrow(/Failed to parse scene breakdown/);
  });

  it('throws on malformed JSON inside the fenced block', async () => {
    chat.mockResolvedValue({ content: '```json\n[{ not valid json ]\n```' });

    await expect(
      breakdownConcept({ concept: 'x', targetDurationSeconds: 10, aspectRatio: '16:9' })
    ).rejects.toThrow(/Failed to parse scene breakdown JSON/);
  });
});
