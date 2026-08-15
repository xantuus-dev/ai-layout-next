import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractSkillCode,
  parseRunnerResult,
  isSandboxConfigured,
  sandboxUnavailableReason,
  SkillCodeError,
} from '@/lib/skills/sandbox-runner';

const SANDBOX_ENV_KEYS = [
  'SKILLS_JS_EXECUTION_ENABLED',
  'VERCEL_TOKEN',
  'VERCEL_TEAM_ID',
  'VERCEL_PROJECT_ID',
  'VERCEL_OIDC_TOKEN',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  // The test runner loads .env.local, which may legitimately contain some of
  // these. Clear them so each case starts from a known environment.
  saved = {};
  for (const key of SANDBOX_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of SANDBOX_ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('isSandboxConfigured', () => {
  // The critical property: no credentials means no isolate, and the caller
  // must refuse rather than fall back to running code in-process.
  it('is false when nothing is configured', () => {
    expect(isSandboxConfigured()).toBe(false);
    expect(sandboxUnavailableReason()).toMatch(/not configured/);
  });

  it('is true on Vercel via the OIDC token alone', () => {
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token';

    expect(isSandboxConfigured()).toBe(true);
    expect(sandboxUnavailableReason()).toBeNull();
  });

  it('is true with the explicit local-development triple', () => {
    process.env.VERCEL_TOKEN = 't';
    process.env.VERCEL_TEAM_ID = 'team';
    process.env.VERCEL_PROJECT_ID = 'proj';

    expect(isSandboxConfigured()).toBe(true);
  });

  it('is false when the triple is incomplete', () => {
    process.env.VERCEL_TOKEN = 't';
    process.env.VERCEL_TEAM_ID = 'team';
    // no VERCEL_PROJECT_ID

    expect(isSandboxConfigured()).toBe(false);
  });

  it('honours the kill switch even when credentials exist', () => {
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token';
    process.env.SKILLS_JS_EXECUTION_ENABLED = 'false';

    expect(isSandboxConfigured()).toBe(false);
    expect(sandboxUnavailableReason()).toMatch(/disabled/);
  });

  it('treats any value other than "false" as not disabling', () => {
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token';
    process.env.SKILLS_JS_EXECUTION_ENABLED = 'true';

    expect(isSandboxConfigured()).toBe(true);
  });
});

describe('extractSkillCode', () => {
  it('reads the code property of a definition object', () => {
    expect(extractSkillCode({ code: 'return 1;' })).toBe('return 1;');
  });

  it('accepts a definition stored as a bare string', () => {
    expect(extractSkillCode('return 1;')).toBe('return 1;');
  });

  it('rejects a definition with no body', () => {
    for (const definition of [null, undefined, {}, { code: '' }, { code: '  ' }, 42]) {
      expect(() => extractSkillCode(definition)).toThrow(SkillCodeError);
    }
  });

  it('rejects a body over the size limit', () => {
    expect(() => extractSkillCode({ code: 'x'.repeat(512 * 1024 + 1) })).toThrow(
      /exceeds the 512KB limit/
    );
  });
});

describe('parseRunnerResult', () => {
  it('returns the output and logs of a successful run', () => {
    const result = parseRunnerResult(
      JSON.stringify({ ok: true, output: { total: 3 }, logs: ['counted'] })
    );

    expect(result.output).toEqual({ total: 3 });
    expect(result.logs).toEqual(['counted']);
  });

  it('maps a null output to null rather than losing it', () => {
    expect(parseRunnerResult(JSON.stringify({ ok: true, output: null, logs: [] })).output).toBeNull();
  });

  // A failure inside the skill is the author's problem, not an outage, so it
  // must be distinguishable from infrastructure failure by type.
  it('raises SkillCodeError with logs when the skill threw', () => {
    let caught: unknown;
    try {
      parseRunnerResult(
        JSON.stringify({ ok: false, message: 'boom', logs: ['before the boom'] })
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SkillCodeError);
    expect((caught as SkillCodeError).message).toBe('boom');
    expect((caught as SkillCodeError).logs).toEqual(['before the boom']);
  });

  it('raises a plain Error when the payload is not valid JSON', () => {
    expect(() => parseRunnerResult('not json')).toThrow(/malformed result/);
    expect(() => parseRunnerResult('not json')).not.toThrow(SkillCodeError);
  });

  it('raises a plain Error when the payload is not an object', () => {
    expect(() => parseRunnerResult('"a string"')).toThrow(/malformed result/);
    expect(() => parseRunnerResult('null')).toThrow(/malformed result/);
  });

  it('tolerates a missing logs array', () => {
    expect(parseRunnerResult(JSON.stringify({ ok: true, output: 1 })).logs).toEqual([]);
  });
});
