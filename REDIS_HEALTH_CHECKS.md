# Redis Health Checks and Graceful Degradation

This document explains the Redis health check system and graceful degradation features implemented in the ai-layout-next application.

## Overview

The application now includes comprehensive Redis health monitoring and graceful degradation capabilities to ensure the system remains operational even when Redis is unavailable.

## Key Features

### 1. Connection State Tracking

The Redis connection manager tracks five states:

- **DISCONNECTED**: Not connected to Redis
- **CONNECTING**: Attempting initial connection
- **CONNECTED**: Successfully connected and ready
- **RECONNECTING**: Attempting to reconnect after failure
- **ERROR**: Connection failed

### 2. Circuit Breaker Pattern

Prevents overwhelming Redis with connection attempts:

- **CLOSED** (Normal): All operations proceed normally
- **OPEN** (Failing): Stop trying after 5 failures, wait 60 seconds
- **HALF-OPEN** (Testing): Try reconnecting after circuit open timeout

**Configuration**:
- Failure threshold: 5 failed attempts
- Circuit open time: 60 seconds
- Half-open retry time: 30 seconds

### 3. Health Check Monitoring

Automatic health checks every 10 seconds (production only):

- Ping Redis to verify connectivity
- Track failure count
- Reset counters on successful connection
- Open circuit breaker if failures exceed threshold

### 4. Graceful Degradation

When Redis is unavailable:

**Queue Operations**:
- Tasks return fallback job IDs
- Queue stats return zero counts
- Queue management operations log warnings
- No crashes or errors thrown

**Agent Execution**:
- Tasks can still be executed directly
- Credit tracking continues in database
- Results saved to database as normal

## Architecture

### RedisConnectionManager

Central manager for all Redis connections:

```typescript
class RedisConnectionManager {
  - connection: Redis | null
  - state: RedisState
  - circuitState: CircuitState
  - failureCount: number
  - healthCheckInterval: NodeJS.Timeout

  + isAvailable(): boolean
  + getConnection(): Redis | null
  + getHealthStatus(): HealthStatus
  + close(): Promise<void>
}
```

### Lazy Initialization

Redis connection is not created until first use:

- Skips connection in CI/build environments
- Prevents errors during static generation
- Reduces unnecessary connections in development

### Error Filtering

Automatically filters non-actionable errors:

- ❌ Redis connection errors in development (silent)
- ❌ Next.js `DYNAMIC_SERVER_USAGE` errors
- ❌ Build-time connection errors

**Only tracks in Sentry** when in production and actionable.

## Usage

### Check Redis Availability

```typescript
import { isRedisAvailable } from '@/lib/queue/redis';

if (isRedisAvailable()) {
  // Redis is available, use queue
  await queueAgentTask(taskId, userId);
} else {
  // Redis unavailable, use fallback
  await executeTaskDirectly(taskId, userId);
}
```

### Get Health Status

```typescript
import { getRedisHealth } from '@/lib/queue/redis';

const health = await getRedisHealth();
console.log(health);
// {
//   connected: true,
//   state: 'connected',
//   circuitState: 'closed',
//   failureCount: 0,
//   lastFailure: null
// }
```

### Execute with Fallback

```typescript
import { executeWithRedis } from '@/lib/queue/redis';

const result = await executeWithRedis(
  async (redis) => {
    // Operation using Redis
    return await redis.get('mykey');
  },
  () => {
    // Fallback when Redis unavailable
    return 'default-value';
  },
  'Get mykey operation'
);
```

### Queue Operations

All queue operations now handle Redis unavailability:

```typescript
import { queueAgentTask, getQueueStats } from '@/lib/queue/agent-queue';

// Queue task (returns fallback job ID if Redis unavailable)
const jobId = await queueAgentTask(taskId, userId);

// Get stats (returns zero counts if Redis unavailable)
const stats = await getQueueStats();
console.log(stats);
// {
//   waiting: 0,
//   active: 0,
//   completed: 0,
//   failed: 0,
//   delayed: 0,
//   total: 0,
//   available: false
// }
```

## Health Check API

Access system health at `/api/health`:

```bash
curl https://ai.xantuus.com/api/health
```

**Response**:
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-02-18T12:00:00.000Z",
  "latency": {
    "total": 45,
    "database": 12
  },
  "components": {
    "database": {
      "healthy": true,
      "latency": 12
    },
    "redis": {
      "connected": true,
      "state": "connected",
      "circuitState": "closed",
      "failureCount": 0,
      "lastFailure": null
    },
    "queue": {
      "available": true,
      "stats": {
        "waiting": 5,
        "active": 2,
        "completed": 128,
        "failed": 3,
        "delayed": 0,
        "total": 138,
        "available": true
      }
    }
  },
  "warnings": []
}
```

**Status Levels**:
- `healthy` (200): All systems operational
- `degraded` (200): Core systems working, Redis unavailable
- `unhealthy` (503): Database or critical systems failing

## Environment Configuration

### Redis Configuration

```bash
# Redis Connection (optional - system degrades gracefully if not available)
REDIS_HOST="localhost"              # Redis hostname
REDIS_PORT="6379"                   # Redis port
REDIS_PASSWORD="your-password"      # Redis password (optional)
```

### Production Recommendations

**Option 1: Use Managed Redis** (Recommended)

Use a managed Redis service with high availability:

- **Upstash**: Serverless Redis with automatic scaling
- **Redis Cloud**: Enterprise-grade Redis hosting
- **AWS ElastiCache**: AWS managed Redis clusters
- **Vercel KV**: Integrated Redis for Vercel (powered by Upstash)

**Option 2: Self-Hosted Redis Cluster**

If self-hosting, use Redis Cluster for high availability:

```bash
# Redis Cluster with Sentinel
REDIS_HOST="redis-cluster.example.com"
REDIS_PORT="6379"
REDIS_PASSWORD="strong-password"
REDIS_SENTINELS="sentinel1:26379,sentinel2:26379,sentinel3:26379"
REDIS_MASTER_NAME="mymaster"
```

**Option 3: No Redis (Graceful Degradation)**

The system works without Redis:

- Agent tasks execute directly (no queue)
- No job management or retry logic
- Higher resource usage (no async processing)
- Suitable for low-traffic deployments

## Monitoring

### Vercel Integration

Add health check monitoring in Vercel:

1. Go to **Monitoring** → **Health Checks**
2. Add new health check:
   - **URL**: `https://ai.xantuus.com/api/health`
   - **Method**: GET
   - **Interval**: 60 seconds
   - **Timeout**: 10 seconds
3. Configure alerts:
   - **Status code**: Not 200
   - **Notification**: Email/Slack

### Datadog/New Relic Integration

Monitor Redis health with APM tools:

```typescript
// Custom metric export
import { getRedisHealth } from '@/lib/queue/redis';

setInterval(async () => {
  const health = await getRedisHealth();

  // Send to Datadog
  statsd.gauge('redis.connected', health.connected ? 1 : 0);
  statsd.gauge('redis.failures', health.failureCount);
}, 60000);
```

### Sentry Integration

Redis errors are automatically tracked in Sentry (production only):

- Connection failures
- Circuit breaker state changes
- Queue operation failures

Filter by tags:
- `circuit_state`: closed/open/half_open
- `failure_count`: Number of consecutive failures

## Troubleshooting

### Issue: Redis connection errors during build

**Symptom**:
```
❌ Redis connection error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: This is expected behavior. Redis is skipped during build phase.

**Verification**:
```typescript
// Check if in build phase
if (process.env.NEXT_PHASE === 'phase-production-build') {
  // Redis will be skipped
}
```

### Issue: Queue operations not working

**Symptom**: Tasks queued but never processed

**Solutions**:

1. Check Redis connection:
   ```bash
   curl https://ai.xantuus.com/api/health
   ```

2. Verify Redis credentials:
   ```bash
   # Test connection
   redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping
   ```

3. Check worker is running:
   ```bash
   # Start worker
   npm run orchestrator
   ```

### Issue: Circuit breaker stuck in OPEN state

**Symptom**: `circuitState: "open"` in health check

**Solution**: Wait 60 seconds for automatic retry, or restart Redis

**Manual Reset** (if needed):
```typescript
import redisManager, { closeRedisConnection } from '@/lib/queue/redis';

// Close and restart connection
await closeRedisConnection();
// Restart application or wait for next health check
```

### Issue: Too many Sentry errors

**Symptom**: Spamming Sentry with Redis connection errors

**Solution**: Adjust error filtering in `sentry.server.config.ts`:

```typescript
ignoreErrors: [
  'ECONNREFUSED',
  'connect ECONNREFUSED 127.0.0.1:6379',
  'Redis connection failed',
],
```

## Performance Impact

### With Redis (Optimal)

- ✅ Async task processing
- ✅ Job queuing with retries
- ✅ Rate limiting and prioritization
- ✅ Distributed worker support
- ✅ Low API response times

**Resource Usage**: Low (async processing)

### Without Redis (Degraded)

- ⚠️  Synchronous task processing
- ⚠️  No job management
- ⚠️  Higher API response times
- ⚠️  No distributed processing
- ⚠️  No automatic retries

**Resource Usage**: High (blocking operations)

**Recommendation**: Use Redis in production for optimal performance.

## Testing

### Test Redis Connection

```bash
# Development
curl http://localhost:3010/api/health

# Production
curl https://ai.xantuus.com/api/health
```

### Test Graceful Degradation

1. Stop Redis:
   ```bash
   # If using Docker
   docker stop redis

   # If using Redis service
   sudo systemctl stop redis
   ```

2. Check health endpoint:
   ```bash
   curl http://localhost:3010/api/health
   ```

3. Expected response:
   ```json
   {
     "status": "degraded",
     "components": {
       "redis": {
         "connected": false,
         "state": "error"
       }
     },
     "warnings": [
       "Redis unavailable - queue operations degraded"
     ]
   }
   ```

4. Queue a task:
   ```typescript
   const jobId = await queueAgentTask('task-123', 'user-456');
   // Returns: "fallback-task-123"
   ```

5. Restart Redis and verify recovery:
   ```bash
   docker start redis
   # Wait 30 seconds for reconnection
   curl http://localhost:3010/api/health
   ```

## Best Practices

1. **Always use managed Redis in production**
   - Upstash, Redis Cloud, or AWS ElastiCache
   - Automatic failover and high availability

2. **Monitor health check endpoint**
   - Set up alerts for degraded status
   - Track circuit breaker state changes

3. **Don't rely on queue for critical operations**
   - Use direct execution for time-sensitive tasks
   - Queue is for async/background processing

4. **Handle fallback job IDs**
   - Check if job ID starts with "fallback-" or "error-"
   - Implement alternative processing for failed queue operations

5. **Test graceful degradation regularly**
   - Verify system works without Redis
   - Confirm no crashes or errors

6. **Configure appropriate timeouts**
   - Health check interval: 10 seconds
   - Circuit breaker timeout: 60 seconds
   - Adjust based on your traffic patterns

## Next Steps

- ✅ Redis health checks implemented
- ✅ Graceful degradation for queue operations
- ✅ Circuit breaker pattern for retries
- ✅ Health check API endpoint
- ⏳ Set up Redis in production (Upstash/Redis Cloud)
- ⏳ Configure monitoring and alerts
- ⏳ Test failover scenarios

## Support

- [Redis Documentation](https://redis.io/documentation)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Upstash Documentation](https://docs.upstash.com/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

---

**Last Updated**: February 18, 2026
