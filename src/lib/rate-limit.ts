/**
 * Distributed rate limiter.
 *
 * This previously used a module-level Map, which does not work on serverless:
 * every cold start gets its own process, so a limit of "20 per minute" was
 * really "20 per minute per container" and an attacker got as many buckets as
 * the platform gave them containers. Since these limits sit in front of paid
 * model calls, that was an uncapped cost exposure rather than a cosmetic bug.
 *
 * Counting now happens in Redis (shared across all instances) via the existing
 * connection manager in lib/queue/redis.ts, which already provides health
 * checks and a circuit breaker.
 *
 * When Redis is unavailable this DEGRADES to the old in-memory behaviour
 * rather than failing closed. That is deliberate: a Redis outage should not
 * take down chat for every customer. It is weaker than the Redis path, not
 * stronger, so it must not be relied on as the only defence — per-plan credit
 * limits in lib/credits.ts remain the hard cost ceiling.
 */

import { executeWithRedis } from '@/lib/queue/redis';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Fallback store, used only when Redis is unavailable.
const fallbackStore = new Map<string, RateLimitEntry>();

// Clean up expired fallback entries every 5 minutes. Unref'd so it never holds
// a serverless invocation open. This file is typed against both the DOM and
// Node timer signatures (setInterval returns `number` under DOM lib), so unref
// is reached defensively rather than through the Node-only Timeout type.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fallbackStore.entries()) {
    if (value.resetTime < now) {
      fallbackStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
(cleanupTimer as unknown as { unref?: () => void }).unref?.();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** True when this result came from the in-memory fallback, not Redis. */
  degraded?: boolean;
}

const KEY_PREFIX = 'ratelimit:';

/**
 * In-memory fixed window. Only correct within a single process.
 */
function checkInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = fallbackStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    fallbackStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
      degraded: true,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
      degraded: true,
    };
  }

  entry.count++;
  fallbackStore.set(identifier, entry);
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
    degraded: true,
  };
}

/**
 * Check whether a request should be rate limited.
 *
 * @param identifier - Unique identifier (user ID, IP, API key, etc.)
 * @param config - Rate limit configuration
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${KEY_PREFIX}${identifier}`;

  return executeWithRedis(
    async (redis) => {
      // Fixed window: INCR creates the key at 1, then we attach the TTL.
      // Both commands go in one pipeline so they cost a single round trip.
      const [[incrErr, rawCount], [ttlErr, rawTtl]] = (await redis
        .multi()
        .incr(key)
        .pttl(key)
        .exec()) as [[Error | null, number], [Error | null, number]];

      if (incrErr) throw incrErr;
      if (ttlErr) throw ttlErr;

      const count = Number(rawCount);
      let ttl = Number(rawTtl);

      // ttl === -1 means the key exists with no expiry. That happens on the
      // first INCR (before we set one) and would otherwise strand the key as a
      // permanent block, so always repair it.
      if (ttl < 0) {
        await redis.pexpire(key, config.windowMs);
        ttl = config.windowMs;
      }

      const reset = Date.now() + ttl;

      if (count > config.maxRequests) {
        return {
          success: false,
          limit: config.maxRequests,
          remaining: 0,
          reset,
        };
      }

      return {
        success: true,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - count),
        reset,
      };
    },
    () => checkInMemory(identifier, config),
    `Rate limit check for ${identifier}`
  );
}

/**
 * Reset the rate limit for an identifier. Useful for tests and manual overrides.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `${KEY_PREFIX}${identifier}`;
  await executeWithRedis(
    async (redis) => {
      await redis.del(key);
    },
    () => {
      fallbackStore.delete(identifier);
    },
    `Rate limit reset for ${identifier}`
  );
}

// Preset rate limit configurations
export const RATE_LIMITS = {
  // Chat API: 20 requests per minute per user
  CHAT: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  // API endpoints: 100 requests per hour per API key
  API_KEY: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Authentication: 5 attempts per 15 minutes per IP
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // General API: 60 requests per minute per user
  GENERAL: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  // Image generation: 10 requests per hour per user
  IMAGE_GENERATION: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Voice dictation: 30 clips per 5 minutes per user. Dictating in short bursts
  // is normal, so the ceiling is high enough not to interrupt real use while
  // still bounding a runaway client.
  TRANSCRIPTION: {
    maxRequests: 30,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  // Video generation: 5 requests per hour per user. Veo is the most expensive
  // call in the app (a single clip can be thousands of credits) and each
  // generation already takes minutes, so this bounds cost, not just throughput.
  VIDEO_GENERATION: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Audio generation (TTS): 30 requests per hour per user.
  AUDIO_GENERATION: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Music generation: 10 tracks per hour per user. A track is priced per
  // minute of output rather than per request, so the ceiling here sits between
  // TTS and Veo — high enough to iterate on a prompt, low enough that a stuck
  // client cannot run up ten minutes of billed audio a minute.
  MUSIC_GENERATION: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Video pipeline (concept -> scenes -> stitched video): 3 projects per day
  // per user. A single project can run up to 5 Veo calls + 5 TTS calls + one
  // sandbox stitch, so it can by itself consume most of VIDEO_GENERATION's
  // hourly budget — this bounds cost at the project level, not just per-call.
  VIDEO_PIPELINE: {
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
} as const;
