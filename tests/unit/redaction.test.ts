import { describe, it, expect } from 'vitest';
import {
  createRedactionContext,
  redactText,
  rehydrateText,
  redactMessages,
  createStreamRehydrator,
  redactionSummary,
} from '@/lib/ai-security/redaction';
import type { AIMessage } from '@/lib/ai-providers/types';

describe('redactText', () => {
  it('replaces an email with a placeholder and round-trips it back', () => {
    const ctx = createRedactionContext();
    const redacted = redactText('Email me at jane.doe@example.com please', ctx);

    expect(redacted).not.toContain('jane.doe@example.com');
    expect(redacted).toMatch(/\[\[PII_EMAIL_1\]\]/);
    expect(rehydrateText(redacted, ctx)).toBe('Email me at jane.doe@example.com please');
  });

  it('pseudonymizes the same value to the same placeholder within a request', () => {
    const ctx = createRedactionContext();
    const redacted = redactText(
      'a@b.com wrote to a@b.com about c@d.com',
      ctx
    );
    // Two distinct emails -> two placeholders; the repeated one is stable.
    expect(redacted).toBe('[[PII_EMAIL_1]] wrote to [[PII_EMAIL_1]] about [[PII_EMAIL_2]]');
    expect(redactionSummary(ctx)).toEqual({ total: 2, byType: { EMAIL: 2 } });
  });

  it('redacts a Luhn-valid credit card but leaves a random digit run alone', () => {
    const ctx = createRedactionContext();
    const valid = '4242 4242 4242 4242'; // passes Luhn
    const invalid = '1234 5678 9012 3456'; // fails Luhn

    expect(redactText(`card ${valid}`, ctx)).toContain('[[PII_CREDIT_CARD_1]]');

    const ctx2 = createRedactionContext();
    expect(redactText(`num ${invalid}`, ctx2)).toContain(invalid);
    expect(redactionSummary(ctx2).total).toBe(0);
  });

  it('redacts a dash-separated SSN but not a bare 9-digit number', () => {
    const ctx = createRedactionContext();
    expect(redactText('ssn 123-45-6789', ctx)).toContain('[[PII_SSN_1]]');

    const ctx2 = createRedactionContext();
    expect(redactText('order 123456789', ctx2)).toContain('123456789');
  });

  it('only redacts phone numbers in strict mode', () => {
    const input = 'call +1 415-555-0132 today';

    const standard = createRedactionContext();
    expect(redactText(input, standard)).toBe(input); // phone untouched by default

    const strict = createRedactionContext();
    const out = redactText(input, strict, { strict: true });
    expect(out).toContain('[[PII_PHONE_1]]');
    expect(rehydrateText(out, strict)).toBe(input);
  });

  it('leaves text without PII untouched', () => {
    const ctx = createRedactionContext();
    const input = 'The quick brown fox — reference [1] and item [2].';
    expect(redactText(input, ctx)).toBe(input);
    expect(ctx.total).toBe(0);
  });
});

describe('redactMessages', () => {
  it('scrubs text content without mutating the original messages', () => {
    const ctx = createRedactionContext();
    const original: AIMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'reach me at bob@corp.io' },
    ];

    const redacted = redactMessages(original, ctx);

    expect(original[1].content).toBe('reach me at bob@corp.io'); // untouched
    expect(redacted[1].content).toBe('reach me at [[PII_EMAIL_1]]');
  });

  it('passes image blocks through and redacts sibling text blocks', () => {
    const ctx = createRedactionContext();
    const msgs: AIMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'invoice for a@b.com' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
        ],
      },
    ];

    const out = redactMessages(msgs, ctx);
    const blocks = out[0].content as Array<{ type: string; text?: string; source?: unknown }>;
    expect(blocks[0].text).toBe('invoice for [[PII_EMAIL_1]]');
    expect(blocks[1].source).toEqual({ type: 'base64', media_type: 'image/png', data: 'AAAA' });
  });
});

describe('createStreamRehydrator', () => {
  function runStream(deltas: string[], ctx: ReturnType<typeof createRedactionContext>): string {
    const r = createStreamRehydrator(ctx);
    let out = '';
    for (const d of deltas) out += r.push(d);
    out += r.flush();
    return out;
  }

  it('rehydrates a placeholder split across multiple deltas', () => {
    const ctx = createRedactionContext();
    redactText('x@y.com', ctx); // registers [[PII_EMAIL_1]] -> x@y.com

    const out = runStream(['Sending to [[PII', '_EMA', 'IL_1]] now'], ctx);
    expect(out).toBe('Sending to x@y.com now');
  });

  it('holds back a lone trailing bracket that becomes a placeholder', () => {
    const ctx = createRedactionContext();
    redactText('x@y.com', ctx);

    const out = runStream(['done [', '[PII_EMAIL_1]]'], ctx);
    expect(out).toBe('done x@y.com');
  });

  it('emits plain text unchanged and does not swallow ordinary brackets', () => {
    const ctx = createRedactionContext();
    const out = runStream(['see [1] and ', 'note [x]'], ctx);
    expect(out).toBe('see [1] and note [x]');
  });
});
