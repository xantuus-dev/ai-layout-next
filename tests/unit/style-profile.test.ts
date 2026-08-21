import { describe, it, expect } from 'vitest';
import {
  parseStyleTraits,
  isEmptyTraits,
  formatStyleForPrompt,
  shouldRebuildStyleProfile,
  collectVoiceSamples,
  STYLE_REBUILD_CADENCE,
  MIN_SAMPLES_TO_BUILD,
  type StyleTraits,
} from '@/lib/style/profile';

function traits(overrides: Partial<StyleTraits> = {}): StyleTraits {
  return {
    tone: 'direct and dry',
    formality: 'informal but precise',
    sentenceStructure: 'short declaratives',
    vocabulary: 'plain, avoids jargon',
    quirks: ['often opens with "So"'],
    avoid: ['never restates the question'],
    ...overrides,
  };
}

/** A message long enough to clear collectVoiceSamples' 40-char floor. */
function longUserMessage(seed: string): { role: string; content: string } {
  return { role: 'user', content: `${seed} ${'x'.repeat(60)}` };
}

describe('parseStyleTraits', () => {
  it('parses a well-formed object', () => {
    const parsed = parseStyleTraits(
      JSON.stringify({
        tone: 'wry',
        formality: 'casual',
        sentenceStructure: 'long and winding',
        vocabulary: 'technical',
        quirks: ['uses em dashes'],
        avoid: ['never uses exclamation marks'],
      })
    );

    expect(parsed.tone).toBe('wry');
    expect(parsed.quirks).toEqual(['uses em dashes']);
    expect(parsed.avoid).toEqual(['never uses exclamation marks']);
  });

  it('tolerates a code fence', () => {
    const parsed = parseStyleTraits('```json\n{"tone":"clipped"}\n```');
    expect(parsed.tone).toBe('clipped');
  });

  it('recovers the object from surrounding prose', () => {
    const parsed = parseStyleTraits('Here you go: {"tone":"warm"} hope that helps');
    expect(parsed.tone).toBe('warm');
  });

  it('returns empty traits on malformed JSON rather than throwing', () => {
    expect(isEmptyTraits(parseStyleTraits('{not json'))).toBe(true);
    expect(isEmptyTraits(parseStyleTraits(''))).toBe(true);
    expect(isEmptyTraits(parseStyleTraits('no braces at all'))).toBe(true);
  });

  it('drops non-string list entries and caps lists at five', () => {
    const parsed = parseStyleTraits(
      JSON.stringify({
        quirks: ['a', 2, null, 'b', 'c', 'd', 'e', 'f'],
        avoid: 'not an array',
      })
    );

    expect(parsed.quirks).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(parsed.avoid).toEqual([]);
  });

  it('coerces non-string scalar fields to empty', () => {
    const parsed = parseStyleTraits(JSON.stringify({ tone: 42, formality: null }));
    expect(parsed.tone).toBe('');
    expect(parsed.formality).toBe('');
  });
});

describe('formatStyleForPrompt', () => {
  it('returns null when there is nothing worth sending', () => {
    expect(
      formatStyleForPrompt({
        tone: '',
        formality: '',
        sentenceStructure: '',
        vocabulary: '',
        quirks: [],
        avoid: [],
      })
    ).toBeNull();
  });

  it('includes every populated trait', () => {
    const prompt = formatStyleForPrompt(traits())!;

    expect(prompt).toContain('direct and dry');
    expect(prompt).toContain('informal but precise');
    expect(prompt).toContain('often opens with "So"');
    expect(prompt).toContain('never restates the question');
  });

  it('scopes itself to style and preserves the assistant\'s latitude', () => {
    const prompt = formatStyleForPrompt(traits())!;

    // The profile must not read as licence to agree with the user or to
    // present their preferences as facts.
    expect(prompt).toContain('style only');
    expect(prompt).toMatch(/disagree/);
  });

  it('omits absent fields rather than emitting empty labels', () => {
    const prompt = formatStyleForPrompt(traits({ vocabulary: '', quirks: [] }))!;

    expect(prompt).not.toContain('Vocabulary:');
    expect(prompt).not.toContain('Habit:');
    expect(prompt).toContain('Tone:');
  });
});

describe('shouldRebuildStyleProfile', () => {
  it('does not build below the minimum sample floor', () => {
    expect(shouldRebuildStyleProfile(MIN_SAMPLES_TO_BUILD - 1, 0)).toBe(false);
  });

  it('builds the first profile once enough messages exist', () => {
    expect(shouldRebuildStyleProfile(STYLE_REBUILD_CADENCE, 0)).toBe(true);
  });

  it('waits a full cadence after the previous build', () => {
    expect(shouldRebuildStyleProfile(30, 25)).toBe(false);
    expect(shouldRebuildStyleProfile(50, 25)).toBe(true);
  });

  it('honours a custom cadence', () => {
    expect(shouldRebuildStyleProfile(20, 10, 10)).toBe(true);
    expect(shouldRebuildStyleProfile(19, 10, 10)).toBe(false);
  });
});

describe('collectVoiceSamples', () => {
  it('excludes assistant messages entirely', () => {
    const samples = collectVoiceSamples([
      longUserMessage('mine'),
      { role: 'assistant', content: `theirs ${'y'.repeat(60)}` },
      longUserMessage('also mine'),
    ]);

    expect(samples).toHaveLength(2);
    expect(samples.every((sample) => !sample.includes('theirs'))).toBe(true);
  });

  it('drops short acknowledgements that carry no voice', () => {
    const samples = collectVoiceSamples([
      { role: 'user', content: 'thanks' },
      { role: 'user', content: 'yes' },
      longUserMessage('a real sentence with substance'),
    ]);

    expect(samples).toHaveLength(1);
  });

  it('truncates a pasted wall of text so it cannot dominate', () => {
    const samples = collectVoiceSamples([{ role: 'user', content: 'z'.repeat(5000) }]);

    expect(samples[0].length).toBeLessThanOrEqual(600);
  });

  it('keeps the most recent messages when over the cap', () => {
    const messages = Array.from({ length: 80 }, (_, i) => longUserMessage(`msg${i}`));
    const samples = collectVoiceSamples(messages);

    expect(samples).toHaveLength(60);
    expect(samples[samples.length - 1]).toContain('msg79');
  });

  it('returns nothing for a conversation with no user prose', () => {
    expect(collectVoiceSamples([{ role: 'assistant', content: 'x'.repeat(100) }])).toEqual([]);
  });
});
