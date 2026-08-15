/**
 * Health Check API
 *
 * Provides system health status including Redis and queue availability
 */

import { NextResponse } from 'next/server';
import { getRedisHealth, getRedisState } from '@/lib/queue/redis';
import { getQueueStats, isQueueAvailable } from '@/lib/queue/agent-queue';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Redis and the queue are optional dependencies here (see `isHealthy` below,
 * which keys off the database alone) — but they were awaited without a bound,
 * so an unreachable Redis hung the whole endpoint until the platform killed
 * the request. A health check that hangs is worse than one that reports a
 * problem: uptime monitors read the timeout as a total outage.
 *
 * Anything slower than this is treated as unavailable, which is the same
 * conclusion the caller would eventually draw, just arrived at promptly.
 */
const OPTIONAL_CHECK_TIMEOUT_MS = 2000;

/**
 * Resolves null instead of a fabricated healthy-looking value, so an
 * unreachable dependency is reported as unknown rather than mislabelled.
 */
function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), OPTIONAL_CHECK_TIMEOUT_MS)),
  ]);
}

export async function GET() {
  try {
    const startTime = Date.now();

    // Redis and queue are optional — never allowed to block the response.
    const redisHealth = await withTimeout(getRedisHealth());

    const queueAvailable = isQueueAvailable();
    const queueStats = await withTimeout(getQueueStats());

    // Check database connection
    let databaseHealthy = false;
    let databaseLatency = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      databaseLatency = Date.now() - dbStart;
      databaseHealthy = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    const totalLatency = Date.now() - startTime;

    // Determine overall health status
    const isHealthy = databaseHealthy; // Redis/queue are optional
    // A null redisHealth means the check timed out or threw — unknown, which
    // is a warning, not a healthy state.
    const hasWarnings = !redisHealth?.connected || !queueAvailable;

    return NextResponse.json(
      {
        status: isHealthy ? (hasWarnings ? 'degraded' : 'healthy') : 'unhealthy',
        timestamp: new Date().toISOString(),
        latency: {
          total: totalLatency,
          database: databaseLatency,
        },
        components: {
          database: {
            healthy: databaseHealthy,
            latency: databaseLatency,
          },
          redis: {
            connected: redisHealth?.connected ?? false,
            state: redisHealth?.state ?? 'unknown',
            circuitState: redisHealth?.circuitState ?? 'unknown',
            failureCount: redisHealth?.failureCount ?? 0,
            lastFailure: redisHealth?.lastFailure
              ? new Date(redisHealth.lastFailure).toISOString()
              : null,
            // Distinguishes "checked, and it is down" from "the check itself
            // did not return in time".
            checkTimedOut: redisHealth === null,
          },
          queue: {
            available: queueAvailable,
            stats: queueStats,
          },
        },
        warnings: [
          !databaseHealthy && 'Database connection failed',
          redisHealth === null && 'Redis health check timed out',
          redisHealth !== null &&
            !redisHealth.connected &&
            'Redis unavailable - queue operations degraded',
          !queueAvailable && 'Queue unavailable - tasks will require manual processing',
        ].filter(Boolean),
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 }
    );
  }
}
