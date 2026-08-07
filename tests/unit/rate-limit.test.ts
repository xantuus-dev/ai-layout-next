import { describe, it, expect, beforeEach, vi } from 'vitest';

// These limits sit in front of paid model calls, so both branches matter:
// the Redis path is what actually enforces a shared limit across serverless
// instances, and the in-memory path is what a Redis outage degrades to.
// Neither is exercised by a real Redis here — lib/queue/redis is mocked so the
// branch under test is chosen deterministically.

const mockExecuteWithRedis = vi.fn();

vi.mock('@/lib/queue/redis', () => ({
  executeWithRedis: (...args: unknown[]) => mockExecuteWithRedis(...args),
}));

const { checkRateLimit, resetRateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');

/** Route every call down the fallback (simulates Redis being unavailable). */
function useFallback() {
  mockExecuteWithRedis.mockImplementation(
    async (_op: unknown, fallback: () => unknown) => fallback()
  );
}

/** A minimal in-process stand-in for the Redis commands the limiter uses. */
function useFakeRedis() {
  const store = new Map<string, { count: number; expiresAt: number }>();

  const redis = {
    multi() {
      const queued: Array<() => number> = [];
      const chain = {
        incr(key: string) {
          queued.push(() => {
            const now = Date.now();
            const existing = store.get(key);
            if (!existing || existing.expiresAt <= now) {
              store.set(key, { count: 1, expiresAt: -1 });
              return 1;
            }
            existing.count += 1;
            return existing.count;
          });
          return chain;
        },
        pttl(key: string) {
          queued.push(() => {
            const entry = store.get(key);
            if (!entry) return -2;
            if (entry.expiresAt < 0) return -1;
            return entry.expiresAt - Date.now();
          });
          return chain;
        },
        async exec() {
          return queued.map((fn) => [null, fn()]);
        },
      };
      return chain;
    },
    async pexpire(key: string, ms: number) {
      const entry = store.get(key);
      if (entry) entry.expiresAt = Date.now() + ms;
      return 1;
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
  };

  mockExecuteWithRedis.mockImplementation(
    async (op: (r: unknown) => Promise<unknown>) => op(redis)
  );
  return store;
}

describe('checkRateLimit — Redis path', () => {
  beforeEach(() => {
    mockExecuteWithRedis.mockReset();
  });

  it('allows up to the limit and blocks the request after it', async () => {
    useFakeRedis();
    const config = { maxRequests: 3, windowMs: 60_000 };

    const first = await checkRateLimit('user-a', config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(2);

    await checkRateLimit('user-a', config);
    const third = await checkRateLimit('user-a', config);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    // The 4th request in the window is over the limit.
    const fourth = await checkRateLimit('user-a', config);
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('counts identifiers independently', async () => {
    useFakeRedis();
    const config = { maxRequests: 1, windowMs: 60_000 };

    expect((await checkRateLimit('user-a', config)).success).toBe(true);
    expect((await checkRateLimit('user-b', config)).success).toBe(true);
    expect((await checkRateLimit('user-a', config)).success).toBe(false);
  });

  it('always attaches a TTL, so a counter cannot become a permanent block', async () => {
    const store = useFakeRedis();
    await checkRateLimit('user-c', { maxRequests: 5, windowMs: 60_000 });

    const entry = store.get('ratelimit:user-c');
    expect(entry).toBeDefined();
    // -1 would mean "key exists, no expiry" — the bug this guards against.
    expect(entry!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('reports a reset time within the configured window', async () => {
    useFakeRedis();
    const windowMs = 60_000;
    const result = await checkRateLimit('user-d', { maxRequests: 5, windowMs });

    expect(result.reset).toBeGreaterThan(Date.now());
    expect(result.reset).toBeLessThanOrEqual(Date.now() + windowMs + 1000);
  });

  it('resetRateLimit clears the counter', async () => {
    useFakeRedis();
    const config = { maxRequests: 1, windowMs: 60_000 };

    expect((await checkRateLimit('user-e', config)).success).toBe(true);
    expect((await checkRateLimit('user-e', config)).success).toBe(false);

    await resetRateLimit('user-e');
    expect((await checkRateLimit('user-e', config)).success).toBe(true);
  });
});

describe('checkRateLimit — in-memory fallback when Redis is down', () => {
  beforeEach(() => {
    mockExecuteWithRedis.mockReset();
    useFallback();
  });

  it('still enforces the limit and flags itself as degraded', async () => {
    const config = { maxRequests: 2, windowMs: 60_000 };

    const first = await checkRateLimit('fallback-user', config);
    expect(first.success).toBe(true);
    expect(first.degraded).toBe(true);

    await checkRateLimit('fallback-user', config);
    const third = await checkRateLimit('fallback-user', config);
    expect(third.success).toBe(false);
    expect(third.degraded).toBe(true);
  });

  it('expires the window so a blocked caller recovers', async () => {
    vi.useFakeTimers();
    try {
      const config = { maxRequests: 1, windowMs: 1_000 };

      expect((await checkRateLimit('expiry-user', config)).success).toBe(true);
      expect((await checkRateLimit('expiry-user', config)).success).toBe(false);

      vi.advanceTimersByTime(1_500);

      expect((await checkRateLimit('expiry-user', config)).success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RATE_LIMITS presets', () => {
  it('defines a positive request budget and window for every preset', () => {
    for (const [name, config] of Object.entries(RATE_LIMITS)) {
      expect(config.maxRequests, `${name}.maxRequests`).toBeGreaterThan(0);
      expect(config.windowMs, `${name}.windowMs`).toBeGreaterThan(0);
    }
  });
});
