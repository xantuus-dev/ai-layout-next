/**
 * Agent Execution Guards
 *
 * Provides timeout, cost limit, and rate limiting guards for agent tool executions.
 */

import { captureMessage } from '@/lib/sentry';
import { prisma } from '@/lib/prisma';

/**
 * Timeout configuration for different tool categories
 */
export const TOOL_TIMEOUTS = {
  // Browser operations can take longer
  browser: 30000, // 30 seconds

  // Email operations are usually quick
  email: 10000, // 10 seconds

  // Drive operations can take longer for uploads
  drive: 60000, // 60 seconds

  // Calendar operations are usually quick
  calendar: 10000, // 10 seconds

  // HTTP requests should be reasonably fast
  http: 15000, // 15 seconds

  // AI operations can vary but should have a limit
  ai: 45000, // 45 seconds

  // Default for unknown categories
  default: 30000, // 30 seconds
};

/**
 * Execute an async operation with a timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`Operation "${operationName}" timed out after ${timeoutMs}ms`);
      captureMessage(
        `Tool execution timeout: ${operationName}`,
        'warning',
        { timeout: String(timeoutMs), operation: operationName }
      );
      reject(error);
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Get timeout for a tool based on its category
 */
export function getToolTimeout(toolName: string): number {
  const category = toolName.split('.')[0]; // e.g., "browser.navigate" → "browser"
  return TOOL_TIMEOUTS[category as keyof typeof TOOL_TIMEOUTS] || TOOL_TIMEOUTS.default;
}

/**
 * Cost limit configuration
 */
export const COST_LIMITS = {
  // Per-step cost limits
  maxCreditsPerStep: 1000, // Maximum credits a single step can use

  // Per-task cost limits
  maxCreditsPerTask: 10000, // Maximum credits a task can use

  // Warning threshold (% of limit)
  warningThreshold: 0.8, // Warn at 80% of limit
};

/**
 * Check if cost is within limits
 */
export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  warningLevel?: 'none' | 'warning' | 'critical';
}

/**
 * Check if a step execution would exceed cost limits
 */
export function checkStepCost(
  estimatedCredits: number,
  currentTaskCredits: number
): CostCheckResult {
  // Check per-step limit
  if (estimatedCredits > COST_LIMITS.maxCreditsPerStep) {
    return {
      allowed: false,
      reason: `Step would use ${estimatedCredits} credits, exceeding per-step limit of ${COST_LIMITS.maxCreditsPerStep}`,
      currentUsage: estimatedCredits,
      limit: COST_LIMITS.maxCreditsPerStep,
      warningLevel: 'critical',
    };
  }

  // Check per-task limit
  const projectedTotal = currentTaskCredits + estimatedCredits;
  if (projectedTotal > COST_LIMITS.maxCreditsPerTask) {
    return {
      allowed: false,
      reason: `Task would use ${projectedTotal} credits total, exceeding per-task limit of ${COST_LIMITS.maxCreditsPerTask}`,
      currentUsage: currentTaskCredits,
      limit: COST_LIMITS.maxCreditsPerTask,
      warningLevel: 'critical',
    };
  }

  // Check warning threshold
  const usagePercent = projectedTotal / COST_LIMITS.maxCreditsPerTask;
  let warningLevel: 'none' | 'warning' | 'critical' = 'none';

  if (usagePercent >= COST_LIMITS.warningThreshold) {
    warningLevel = usagePercent >= 0.95 ? 'critical' : 'warning';

    captureMessage(
      `Task approaching cost limit: ${Math.round(usagePercent * 100)}% of limit`,
      warningLevel === 'critical' ? 'warning' : 'info',
      {
        currentUsage: String(currentTaskCredits),
        projectedUsage: String(projectedTotal),
        limit: String(COST_LIMITS.maxCreditsPerTask),
      }
    );
  }

  return {
    allowed: true,
    currentUsage: currentTaskCredits,
    limit: COST_LIMITS.maxCreditsPerTask,
    warningLevel,
  };
}

/**
 * Check if user has sufficient credits
 */
export async function checkUserCredits(
  userId: string,
  requiredCredits: number
): Promise<{
  allowed: boolean;
  reason?: string;
  available: number;
  required: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      monthlyCredits: true,
      creditsUsed: true,
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason: 'User not found',
      available: 0,
      required: requiredCredits,
    };
  }

  const availableCredits = user.monthlyCredits - user.creditsUsed;

  if (availableCredits < requiredCredits) {
    return {
      allowed: false,
      reason: `Insufficient credits. Required: ${requiredCredits}, Available: ${availableCredits}`,
      available: availableCredits,
      required: requiredCredits,
    };
  }

  return {
    allowed: true,
    available: availableCredits,
    required: requiredCredits,
  };
}

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  // Tool-specific rate limits (calls per minute)
  browser: 30, // 30 browser operations per minute
  email: 10, // 10 emails per minute
  drive: 20, // 20 drive operations per minute
  calendar: 15, // 15 calendar operations per minute
  http: 60, // 60 HTTP requests per minute
  ai: 30, // 30 AI calls per minute

  // Default rate limit
  default: 30,

  // Window duration in milliseconds
  windowMs: 60000, // 1 minute
};

/**
 * In-memory rate limit tracker
 * In production, this should use Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if rate limit is exceeded
 */
export function checkRateLimit(
  userId: string,
  toolName: string
): {
  allowed: boolean;
  reason?: string;
  remaining: number;
  resetAt: number;
} {
  const category = toolName.split('.')[0];
  const limit = RATE_LIMITS[category as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;

  const key = `${userId}:${category}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  // No record or window expired
  if (!record || now >= record.resetAt) {
    const resetAt = now + RATE_LIMITS.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
    };
  }

  // Within window
  if (record.count >= limit) {
    return {
      allowed: false,
      reason: `Rate limit exceeded for ${category}. Limit: ${limit} calls per minute. Try again in ${Math.ceil((record.resetAt - now) / 1000)}s`,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: limit - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Clean up expired rate limit records (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();

  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

/**
 * Apply all guards to a tool execution
 */
export async function applyExecutionGuards(
  userId: string,
  toolName: string,
  estimatedCredits: number,
  currentTaskCredits: number
): Promise<{
  allowed: boolean;
  reason?: string;
  timeout: number;
  costCheck?: CostCheckResult;
}> {
  // Check rate limit
  const rateLimit = checkRateLimit(userId, toolName);
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      reason: rateLimit.reason,
      timeout: getToolTimeout(toolName),
    };
  }

  // Check cost limits
  const costCheck = checkStepCost(estimatedCredits, currentTaskCredits);
  if (!costCheck.allowed) {
    return {
      allowed: false,
      reason: costCheck.reason,
      timeout: getToolTimeout(toolName),
      costCheck,
    };
  }

  // Check user credits
  const userCredits = await checkUserCredits(userId, estimatedCredits);
  if (!userCredits.allowed) {
    return {
      allowed: false,
      reason: userCredits.reason,
      timeout: getToolTimeout(toolName),
    };
  }

  return {
    allowed: true,
    timeout: getToolTimeout(toolName),
    costCheck,
  };
}
