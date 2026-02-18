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

export async function GET() {
  try {
    const startTime = Date.now();

    // Check Redis health
    const redisHealth = await getRedisHealth();

    // Check queue availability
    const queueAvailable = isQueueAvailable();
    const queueStats = await getQueueStats();

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
    const hasWarnings = !redisHealth.connected || !queueAvailable;

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
            connected: redisHealth.connected,
            state: redisHealth.state,
            circuitState: redisHealth.circuitState,
            failureCount: redisHealth.failureCount,
            lastFailure: redisHealth.lastFailure
              ? new Date(redisHealth.lastFailure).toISOString()
              : null,
          },
          queue: {
            available: queueAvailable,
            stats: queueStats,
          },
        },
        warnings: [
          !databaseHealthy && 'Database connection failed',
          !redisHealth.connected && 'Redis unavailable - queue operations degraded',
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
