/**
 * PII redaction / pseudonymization for outbound model prompts.
 *
 * Goal (OWASP LLM02 "Sensitive Information Disclosure" + GDPR data
 * minimization): strip personal data out of prompts as late as possible in the
 * app but as early as possible before it reaches a third-party model provider,
 * then restore the real values in the model's response so the user experience
 * is unchanged.
 *
 * The scheme is deterministic *within a request*: the same value always maps to
 * the same placeholder, so the model can still reason about "the same email"
 * appearing twice, and we can put the real value back on the way out. Nothing
 * is persisted — a RedactionContext lives for one request only.
 *
 * Placeholders look like `[[PII_EMAIL_1]]`. The double brackets and the
 * PII_<TYPE>_<n> shape make accidental collision with ordinary prose (e.g. a
 * `[1]` citation) vanishingly unlikely, and models reliably echo the token
 * verbatim when they need to refer to the value.
 */

import type { AIMessage } from '@/lib/ai-providers/types';

export type PiiType = 'EMAIL' | 'PHONE' | 'CREDIT_CARD' | 'SSN' | 'IBAN';

export interface RedactionContext {
  /** placeholder token -> original value (used to rehydrate the response). */
  restore: Map<string, string>;
  /** original value -> placeholder (consistent pseudonymization within a request). */
  seen: Map<string, string>;
  /** per-type running counter used to number placeholders. */
  counts: Partial<Record<PiiType, number>>;
  /** total number of distinct values redacted. */
  total: number;
}

export function createRedactionContext(): RedactionContext {
  return { restore: new Map(), seen: new Map(), counts: {}, total: 0 };
}

/** Matches any complete placeholder this module emits. */
const PLACEHOLDER_RE = /\[\[PII_[A-Z]+_\d+\]\]/g;

interface Detector {
  type: PiiType;
  regex: RegExp;
  /** Optional extra check to suppress false positives (e.g. Luhn for cards). */
  validate?: (match: string) => boolean;
  /**
   * 'standard' detectors are low-false-positive and safe to run on first-party
   * chat. 'strict' detectors (phone) over-redact and are reserved for untrusted
   * surfaces (agent tool output, scraped pages) where a false positive is
   * cheaper than a leak.
   */
  tier: 'standard' | 'strict';
}

export interface RedactionOptions {
  /**
   * When true, also run the higher-false-positive 'strict' detectors. Use for
   * agent / browser / retrieved-content surfaces. Defaults to false so
   * first-party chat is not over-redacted.
   */
  strict?: boolean;
}

/**
 * Luhn checksum — filters out random 13–19 digit runs that are not real card
 * numbers, which is the main source of credit-card false positives.
 */
function luhnValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Detectors run in this order. More specific / higher-confidence patterns come
 * first so that, once a span is replaced with a placeholder, a looser pattern
 * (e.g. phone) cannot re-match part of it.
 */
const DETECTORS: Detector[] = [
  {
    type: 'EMAIL',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    tier: 'standard',
  },
  {
    type: 'CREDIT_CARD',
    // 13–19 digits, optionally grouped by spaces or dashes. Confirmed by Luhn.
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    validate: luhnValid,
    tier: 'standard',
  },
  {
    type: 'IBAN',
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    tier: 'standard',
  },
  {
    type: 'SSN',
    // US SSN, dash- or space-separated. The separator requirement keeps this
    // from swallowing arbitrary 9-digit numbers.
    regex: /\b\d{3}[ -]\d{2}[ -]\d{4}\b/g,
    tier: 'standard',
  },
  {
    type: 'PHONE',
    // High false-positive by nature (overlaps with card fragments, IDs, etc.),
    // so this only runs in strict mode. Optional +country code and at least one
    // separator, so bare integers are not treated as phone numbers.
    regex: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?|\d{2,4}[ .-])\d{3,4}[ .-]\d{3,4}\b/g,
    tier: 'strict',
  },
];

function placeholderFor(ctx: RedactionContext, type: PiiType, value: string): string {
  const existing = ctx.seen.get(value);
  if (existing) return existing;

  const n = (ctx.counts[type] ?? 0) + 1;
  ctx.counts[type] = n;
  const token = `[[PII_${type}_${n}]]`;
  ctx.seen.set(value, token);
  ctx.restore.set(token, value);
  ctx.total += 1;
  return token;
}

/**
 * Replace detected PII in a string with placeholders, recording the mapping in
 * `ctx`. Idempotent with respect to already-emitted placeholders (they contain
 * no separators, so no detector re-matches them).
 */
export function redactText(
  text: string,
  ctx: RedactionContext,
  options: RedactionOptions = {}
): string {
  if (!text) return text;
  let out = text;
  for (const detector of DETECTORS) {
    if (detector.tier === 'strict' && !options.strict) continue;
    out = out.replace(detector.regex, (match) => {
      if (detector.validate && !detector.validate(match)) return match;
      return placeholderFor(ctx, detector.type, match);
    });
  }
  return out;
}

/**
 * Redact every text part of a message array, returning a NEW array. The
 * originals are left untouched because the un-redacted messages are what the
 * app persists to its own database; only the copy sent to the provider is
 * scrubbed. Image blocks are passed through unchanged.
 */
export function redactMessages(
  messages: AIMessage[],
  ctx: RedactionContext,
  options: RedactionOptions = {}
): AIMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === 'string'
        ? redactText(msg.content, ctx, options)
        : msg.content.map((block) =>
            block.type === 'text'
              ? { ...block, text: redactText(block.text ?? '', ctx, options) }
              : block
          ),
  }));
}

/**
 * Restore original values in a fully-materialized response string. Safe to call
 * when nothing was redacted (returns the input unchanged).
 */
export function rehydrateText(text: string, ctx: RedactionContext): string {
  if (!text || ctx.restore.size === 0) return text;
  return text.replace(PLACEHOLDER_RE, (token) => ctx.restore.get(token) ?? token);
}

/**
 * True if `s` (which begins with "[[") could still grow into a valid
 * placeholder. Used by the streaming rehydrator to decide whether to hold a
 * trailing fragment back or flush it.
 */
function couldBePlaceholderPrefix(s: string): boolean {
  return /^\[\[[A-Z0-9_]*$/.test(s) && s.length < 48;
}

export interface StreamRehydrator {
  /** Feed a response delta; returns the text safe to emit right now. */
  push(delta: string): string;
  /** Call once the stream ends; returns any held-back remainder. */
  flush(): string;
}

/**
 * Rehydrate placeholders in a token-by-token stream. A placeholder can be split
 * across deltas (`[[PII_EMA` … `IL_1]]`), so we buffer just enough to avoid
 * emitting a fragment that is still turning into a placeholder, and never more.
 */
export function createStreamRehydrator(ctx: RedactionContext): StreamRehydrator {
  let buffer = '';

  const drainComplete = () => {
    buffer = buffer.replace(PLACEHOLDER_RE, (token) => ctx.restore.get(token) ?? token);
  };

  return {
    push(delta: string): string {
      buffer += delta;
      drainComplete();

      const idx = buffer.lastIndexOf('[[');
      if (idx === -1) {
        // Hold a lone trailing '[' — it might be the start of the next '[['.
        if (buffer.endsWith('[')) {
          const out = buffer.slice(0, -1);
          buffer = '[';
          return out;
        }
        const out = buffer;
        buffer = '';
        return out;
      }

      const tail = buffer.slice(idx);
      if (couldBePlaceholderPrefix(tail)) {
        const out = buffer.slice(0, idx);
        buffer = tail;
        return out;
      }

      const out = buffer;
      buffer = '';
      return out;
    },

    flush(): string {
      drainComplete();
      const out = buffer;
      buffer = '';
      return out;
    },
  };
}

/**
 * Per-type counts of what was redacted, for surfacing in the UI
 * (e.g. a "3 items redacted" indicator) and for the audit log. Never includes
 * the original values.
 */
export function redactionSummary(ctx: RedactionContext): {
  total: number;
  byType: Partial<Record<PiiType, number>>;
} {
  return { total: ctx.total, byType: { ...ctx.counts } };
}
