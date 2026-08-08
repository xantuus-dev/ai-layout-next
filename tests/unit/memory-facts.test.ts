import { describe, it, expect } from 'vitest';
import {
  tokenize,
  scoreFact,
  rankFacts,
  formatFactsForPrompt,
  parseExtractedFacts,
  dedupeFacts,
  factFingerprint,
  shouldExtractFacts,
  type RetrievableFact,
} from '@/lib/memory/facts';

const NOW = new Date('2026-08-08T12:00:00Z');

function fact(overrides: Partial<RetrievableFact> = {}): RetrievableFact {
  return {
    id: 'f1',
    factType: 'fact',
    content: 'The user works as a recruiter at Acme',
    importanceScore: 0.5,
    lastAccessed: NOW,
    ...overrides,
  };
}

describe('tokenize', () => {
  it('lowercases, splits on punctuation and drops stop words', () => {
    expect(tokenize('The user WORKS at Acme, Inc.')).toEqual([
      'user',
      'works',
      'acme',
      'inc',
    ]);
  });

  it('drops single characters that carry no signal', () => {
    expect(tokenize('a b cd')).toEqual(['cd']);
  });
});

describe('scoreFact', () => {
  it('returns 0 when nothing overlaps', () => {
    expect(scoreFact(fact(), tokenize('unrelated sailing question'), NOW)).toBe(0);
  });

  it('returns 0 for an empty query rather than ranking everything equally', () => {
    expect(scoreFact(fact(), [], NOW)).toBe(0);
  });

  it('scores higher as more query terms match', () => {
    const weak = scoreFact(fact(), tokenize('recruiter'), NOW);
    const strong = scoreFact(fact(), tokenize('recruiter acme'), NOW);
    expect(strong).toBeGreaterThan(weak);
  });

  it('prefers a more important fact when overlap is equal', () => {
    const query = tokenize('recruiter');
    const low = scoreFact(fact({ importanceScore: 0.1 }), query, NOW);
    const high = scoreFact(fact({ importanceScore: 0.9 }), query, NOW);
    expect(high).toBeGreaterThan(low);
  });

  it('decays with staleness so fresh facts win ties', () => {
    const query = tokenize('recruiter');
    const fresh = scoreFact(fact({ lastAccessed: NOW }), query, NOW);
    const stale = scoreFact(
      fact({ lastAccessed: new Date('2026-01-01T00:00:00Z') }),
      query,
      NOW
    );
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe('rankFacts', () => {
  const facts = [
    fact({ id: 'recruiter', content: 'The user works as a recruiter at Acme' }),
    fact({ id: 'coffee', content: 'The user prefers oat milk in coffee' }),
    fact({ id: 'tz', content: 'The user is based in the Sydney timezone' }),
  ];

  it('returns only facts relevant to the query', () => {
    const ranked = rankFacts(facts, 'what do you know about my coffee order', {
      now: NOW,
    });
    expect(ranked.map((f) => f.id)).toEqual(['coffee']);
  });

  it('returns nothing for an unrelated query rather than filling the prompt with noise', () => {
    expect(rankFacts(facts, 'explain quicksort to me', { now: NOW })).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      fact({ id: `f${i}`, content: `The user likes recruiter topic ${i}` })
    );
    expect(rankFacts(many, 'recruiter', { limit: 3, now: NOW })).toHaveLength(3);
  });

  it('orders by descending score', () => {
    const ranked = rankFacts(facts, 'recruiter acme coffee', { now: NOW });
    const scores = ranked.map((f) => f.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('formatFactsForPrompt', () => {
  it('returns null when there is nothing to inject, so no empty block reaches the model', () => {
    expect(formatFactsForPrompt([])).toBeNull();
  });

  it('lists each fact with its type', () => {
    const prompt = formatFactsForPrompt([
      {
        id: 'a',
        factType: 'preference',
        content: 'The user prefers concise answers',
        importanceScore: 0.5,
        score: 0.9,
      },
    ]);
    expect(prompt).toContain('- (preference) The user prefers concise answers');
    expect(prompt).toContain('Do not mention that you are reading from memory');
  });
});

describe('parseExtractedFacts', () => {
  it('parses a bare JSON array', () => {
    const parsed = parseExtractedFacts(
      '[{"factType":"goal","content":"The user is training for a marathon","confidenceScore":0.9,"importanceScore":0.7}]'
    );
    expect(parsed).toEqual([
      {
        factType: 'goal',
        content: 'The user is training for a marathon',
        confidenceScore: 0.9,
        importanceScore: 0.7,
      },
    ]);
  });

  it('tolerates a ```json code fence', () => {
    const parsed = parseExtractedFacts(
      '```json\n[{"factType":"fact","content":"The user has two cats"}]\n```'
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe('The user has two cats');
  });

  it('tolerates surrounding prose', () => {
    const parsed = parseExtractedFacts(
      'Sure! Here are the facts:\n[{"factType":"fact","content":"The user has two cats"}]\nHope that helps.'
    );
    expect(parsed).toHaveLength(1);
  });

  it('returns [] for an empty array, malformed JSON, or a non-array', () => {
    expect(parseExtractedFacts('[]')).toEqual([]);
    expect(parseExtractedFacts('not json at all')).toEqual([]);
    expect(parseExtractedFacts('[{"content": ')).toEqual([]);
    expect(parseExtractedFacts('{"content":"an object not an array"}')).toEqual([]);
    expect(parseExtractedFacts('')).toEqual([]);
  });

  it('drops entries with no usable content instead of storing blanks', () => {
    expect(
      parseExtractedFacts('[{"factType":"fact","content":"   "},{"factType":"fact"}]')
    ).toEqual([]);
  });

  it('falls back to "fact" for an unrecognised factType', () => {
    const parsed = parseExtractedFacts(
      '[{"factType":"wildly-invented-type","content":"The user likes jazz"}]'
    );
    expect(parsed[0].factType).toBe('fact');
  });

  it('clamps out-of-range scores rather than trusting the model', () => {
    const parsed = parseExtractedFacts(
      '[{"factType":"fact","content":"x y","confidenceScore":9,"importanceScore":-4}]'
    );
    expect(parsed[0].confidenceScore).toBe(1);
    expect(parsed[0].importanceScore).toBe(0);
  });

  it('supplies defaults when scores are missing or non-numeric', () => {
    const parsed = parseExtractedFacts(
      '[{"factType":"fact","content":"x y","confidenceScore":"high"}]'
    );
    expect(parsed[0].confidenceScore).toBe(0.7);
    expect(parsed[0].importanceScore).toBe(0.5);
  });
});

describe('dedupeFacts', () => {
  const incoming = [
    { factType: 'fact' as const, content: 'The user has two cats', confidenceScore: 0.9, importanceScore: 0.5 },
  ];

  it('drops a fact already stored, ignoring word order and punctuation', () => {
    expect(dedupeFacts(incoming, ['The user has two cats.'])).toEqual([]);
    expect(dedupeFacts(incoming, ['two cats has the user'])).toEqual([]);
  });

  it('keeps a genuinely new fact', () => {
    expect(dedupeFacts(incoming, ['The user has a dog'])).toHaveLength(1);
  });

  it('de-duplicates within the incoming batch', () => {
    expect(dedupeFacts([...incoming, ...incoming], [])).toHaveLength(1);
  });

  it('drops content that normalises to nothing', () => {
    const empty = [{ factType: 'fact' as const, content: '!!! ...', confidenceScore: 0.9, importanceScore: 0.5 }];
    expect(dedupeFacts(empty, [])).toEqual([]);
  });
});

describe('factFingerprint', () => {
  it('is order- and punctuation-insensitive', () => {
    expect(factFingerprint('The user has two cats!')).toBe(
      factFingerprint('cats two has user')
    );
  });
});

describe('shouldExtractFacts', () => {
  it('does not extract on a conversation too short to have durable content', () => {
    expect(shouldExtractFacts(0)).toBe(false);
    expect(shouldExtractFacts(1)).toBe(false);
  });

  it('extracts once per cadence rather than on every turn', () => {
    expect(shouldExtractFacts(6)).toBe(true);
    expect(shouldExtractFacts(7)).toBe(false);
    expect(shouldExtractFacts(12)).toBe(true);
  });

  it('honours a custom cadence', () => {
    expect(shouldExtractFacts(4, 2)).toBe(true);
    expect(shouldExtractFacts(5, 2)).toBe(false);
  });
});
