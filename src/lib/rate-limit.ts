// Simple in-memory rate limiter
// For production, consider using Redis or a service like Upstash

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (user ID, IP, API key, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or expired entry - create new one
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Entry exists and is still valid
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or manual overrides
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
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
} as const;
