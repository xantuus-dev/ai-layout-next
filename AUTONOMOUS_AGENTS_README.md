# Autonomous Agent Scheduling System

This document explains how to set up and use the autonomous agent scheduling system with BullMQ job queue and cron-based task execution.

## Overview

The autonomous agent system allows users to create AI-powered tasks that can:
- Execute immediately (synchronous or asynchronous)
- Run on a schedule (using cron expressions)
- Retry automatically on failure
- Track resource usage (credits and tokens)

**Key Components:**
- **BullMQ Queue**: Reliable job queue with Redis backend
- **Agent Worker**: Processes tasks from the queue
- **Orchestrator**: Polls for scheduled tasks and queues them
- **Cron Endpoint**: Vercel Cron or external service triggers scheduled checks

---

## Prerequisites

### 1. Redis Server

Redis is required for the BullMQ job queue.

**Local Development:**
```bash
# macOS (with Homebrew)
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

**Production:**
- Use [Upstash Redis](https://upstash.com/) (free tier available)
- Use [Redis Cloud](https://redis.com/try-free/)
- Self-host on your infrastructure

### 2. Database

Ensure your PostgreSQL database is migrated with the latest schema:

```bash
npx prisma migrate dev
# or
npx prisma db push
```

The following fields were added to the `Task` model:
- `schedule` - Cron expression (e.g., "0 9 * * *")
- `scheduleEnabled` - Boolean flag to enable scheduling
- `nextRunAt` - DateTime for next execution
- `timezone` - User's timezone for cron parsing

### 3. Environment Variables

Add to your `.env.local`:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Optional, leave empty for local development

# Cron Security (for external cron services)
CRON_SECRET=your-random-secret-here   # Generate with: openssl rand -base64 32

# Agent Worker Configuration (optional)
AGENT_WORKER_CONCURRENCY=5            # Number of concurrent tasks (default: 5)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CREATES TASK                        │
│                    (with optional schedule)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API: /api/agent/execute                      │
│  - Creates task in database                                     │
│  - If async=true, queues task via BullMQ                        │
│  - If schedule, sets nextRunAt based on cron expression         │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────┐
│   IMMEDIATE EXEC     │              │   SCHEDULED EXEC     │
│                      │              │                      │
│  • Queued via        │              │  • Vercel Cron runs  │
│    queueAgentTask()  │              │    every minute      │
│  • Worker picks up   │              │  • Endpoint checks   │
│  • Executes          │              │    for due tasks     │
└──────────────────────┘              │  • Queues via        │
                                      │    queueAgentTask()  │
                                      └──────────────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────┐
                             │       BULLMQ QUEUE (Redis)       │
                             │  - Stores pending jobs           │
                             │  - Handles retries               │
                             │  - Rate limiting                 │
                             │  - Priority ordering             │
                             └──────────┬───────────────────────┘
                                        │
                                        ▼
                             ┌──────────────────────────────────┐
                             │        AGENT WORKER              │
                             │  - Fetches tasks from queue      │
                             │  - Creates execution plan        │
                             │  - Executes with AI              │
                             │  - Updates database              │
                             │  - Deducts credits               │
                             └──────────────────────────────────┘
```

---

## Local Development Setup

### 1. Start Redis

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest

# Verify Redis is running
redis-cli ping  # Should return "PONG"
```

### 2. Run the Orchestrator

In one terminal, start the Next.js dev server:
```bash
npm run dev
```

In another terminal, start the orchestrator:
```bash
npm run orchestrator
```

The orchestrator will:
- Connect to Redis
- Start the agent worker (processes 5 tasks concurrently)
- Poll for scheduled tasks every 60 seconds
- Display status updates every 30 seconds

**Console Output:**
```
🚀 Starting Agent Orchestrator...

🔌 Connecting to Redis...
✅ Redis connected

👷 Starting agent worker...
✅ Worker started

🎯 Starting orchestrator...
✅ Orchestrator started

🎉 Orchestrator is running!
Press Ctrl+C to stop

📊 Orchestrator Status:
   Running: true
   Active agents: 2
   Queued tasks: 5
   Completed today: 12
   Failed today: 0
   Uptime: 180s

   Queue Stats:
     - Waiting: 5
     - Active: 2
     - Completed: 12
     - Failed: 0
     - Delayed: 0
```

---

## Production Deployment (Vercel)

### 1. Configure Vercel Cron

The `vercel.json` file is already configured to run the cron endpoint every minute:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-scheduled-tasks",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note:** Vercel Cron is only available on Pro and Enterprise plans. For free tier, use an external cron service (see below).

### 2. Set Environment Variables on Vercel

In your Vercel project settings, add:
- `REDIS_HOST` - Your Redis host (e.g., Upstash endpoint)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (if required)
- `CRON_SECRET` - Random secret for external cron auth

### 3. Deploy

```bash
vercel --prod
```

The cron job will automatically start checking for scheduled tasks every minute.

---

## Using External Cron Services (Free Tier Alternative)

If you're on Vercel's free tier, use an external cron service like:
- [cron-job.org](https://cron-job.org/) (free)
- [EasyCron](https://www.easycron.com/) (free tier available)
- [Render Cron Jobs](https://render.com/docs/cronjobs) (free)

### Setup Example (cron-job.org):

1. Create account at [cron-job.org](https://cron-job.org/)
2. Create new cron job:
   - **URL**: `https://yourdomain.com/api/cron/check-scheduled-tasks`
   - **Schedule**: `* * * * *` (every minute)
   - **Request Method**: POST
   - **Headers**: Add `Authorization: Bearer YOUR_CRON_SECRET`

---

## Creating Scheduled Tasks

### Via API

```bash
curl -X POST https://yourdomain.com/api/agent/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Check competitor pricing and send report",
    "agentType": "research_agent",
    "async": true,
    "schedule": {
      "enabled": true,
      "cron": "0 9 * * *",
      "timezone": "America/New_York"
    }
  }'
```

### Via Database (Prisma)

```typescript
import { prisma } from '@/lib/prisma';

const task = await prisma.task.create({
  data: {
    userId: user.id,
    title: 'Daily Competitor Check',
    description: 'Check competitor pricing and send report',
    agentType: 'research_agent',
    status: 'pending',
    priority: 'high',

    // Scheduling configuration
    schedule: '0 9 * * *',         // Every day at 9 AM
    scheduleEnabled: true,
    nextRunAt: new Date('2025-02-06T09:00:00Z'),
    timezone: 'America/New_York',
  },
});
```

---

## Cron Expression Examples

```
* * * * *     - Every minute
*/5 * * * *   - Every 5 minutes
0 * * * *     - Every hour
0 9 * * *     - Every day at 9 AM
0 9 * * 1     - Every Monday at 9 AM
0 0 1 * *     - First day of every month at midnight
0 */6 * * *   - Every 6 hours
0 9,17 * * *  - 9 AM and 5 PM every day
```

**Format:** `minute hour day month weekday`

Test your cron expressions at [crontab.guru](https://crontab.guru/)

---

## Task Priority System

Tasks are executed in priority order:

| Priority | Numeric Value | Use Case |
|----------|--------------|----------|
| `urgent` | 1 | Critical tasks, immediate attention |
| `high`   | 2 | Important tasks, process soon |
| `medium` | 3 | Normal priority (default) |
| `low`    | 4 | Background tasks, process when idle |

**Queue Behavior:**
- Higher priority tasks (lower number) are processed first
- Within same priority, FIFO (first-in, first-out)

---

## Monitoring & Debugging

### 1. Check Queue Status

**GET Endpoint:**
```bash
curl https://yourdomain.com/api/cron/check-scheduled-tasks \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response:**
```json
{
  "status": "healthy",
  "scheduledTasks": 15,
  "tasksCurrentlyDue": 3,
  "timestamp": "2025-02-05T12:00:00Z"
}
```

### 2. View Logs

**Vercel:**
```bash
vercel logs --follow
```

**Local:**
Check the orchestrator terminal output for real-time status.

### 3. Redis CLI (Advanced)

```bash
# Connect to Redis
redis-cli

# View all BullMQ keys
KEYS bull:agent-tasks:*

# Get queue length
LLEN bull:agent-tasks:waiting

# View active jobs
SMEMBERS bull:agent-tasks:active

# Monitor in real-time
MONITOR
```

---

## Troubleshooting

### Issue: Tasks not being scheduled

**Check:**
1. Cron job is running (check Vercel logs or external service)
2. Task has `scheduleEnabled: true` in database
3. `nextRunAt` is in the past
4. Task status is `pending` or `completed`

**Fix:**
```sql
-- View scheduled tasks
SELECT id, title, schedule, scheduleEnabled, nextRunAt, status
FROM "Task"
WHERE scheduleEnabled = true;

-- Manually trigger a task
UPDATE "Task"
SET nextRunAt = NOW() - INTERVAL '1 minute'
WHERE id = 'YOUR_TASK_ID';
```

### Issue: Worker not processing jobs

**Check:**
1. Redis is running and accessible
2. Worker is started (`npm run orchestrator` locally)
3. No Redis connection errors in logs

**Fix:**
```bash
# Restart Redis
brew services restart redis  # macOS
sudo systemctl restart redis  # Linux

# Clear stuck jobs
redis-cli FLUSHDB  # ⚠️ WARNING: Deletes all Redis data
```

### Issue: Tasks failing with insufficient credits

**Check:**
```sql
SELECT id, email, plan, monthlyCredits, creditsUsed
FROM "User"
WHERE id = 'USER_ID';
```

**Fix:**
```sql
-- Reset credits (admin only)
UPDATE "User"
SET creditsUsed = 0
WHERE id = 'USER_ID';

-- Upgrade plan
UPDATE "User"
SET plan = 'pro', monthlyCredits = 12000
WHERE id = 'USER_ID';
```

### Issue: Cron endpoint returns 401 Unauthorized

**Check:**
- `CRON_SECRET` environment variable is set
- Authorization header matches: `Bearer YOUR_CRON_SECRET`

**Fix:**
```bash
# Generate new secret
openssl rand -base64 32

# Update .env.local and redeploy
```

---

## Advanced Configuration

### Custom Worker Concurrency

Set how many tasks can run simultaneously:

```env
# .env.local
AGENT_WORKER_CONCURRENCY=10  # Default: 5
```

Higher values = more parallelism, but more resource usage.

### Custom Poll Interval

Change how often the orchestrator checks for scheduled tasks:

```typescript
// scripts/start-orchestrator.ts
const orchestrator = getOrchestrator({
  pollInterval: 30000, // Check every 30 seconds (default: 60000)
});
```

### Custom Retry Logic

Configure retries per task:

```typescript
await queueAgentTask(userId, taskId, {
  priority: 1,
  retryCount: 5,  // Retry up to 5 times (default: 3)
});
```

---

## Security Best Practices

1. **Never expose CRON_SECRET** in client-side code
2. **Use HTTPS** for all cron webhook endpoints
3. **Validate user permissions** before queueing tasks
4. **Rate limit** the cron endpoint to prevent abuse
5. **Monitor Redis access** - restrict to your application only
6. **Encrypt Redis connection** in production (TLS)

---

## Performance Optimization

### For High Volume (1000+ tasks/day)

1. **Increase worker concurrency:**
   ```env
   AGENT_WORKER_CONCURRENCY=20
   ```

2. **Use Redis clustering** (Upstash or Redis Enterprise)

3. **Add database indexes** (already configured):
   ```prisma
   @@index([scheduleEnabled, nextRunAt])
   @@index([status, priority])
   ```

4. **Implement task batching** (process 50 tasks per cron run)

5. **Scale horizontally** - run multiple worker instances

---

## Cost Estimation

### Redis Hosting

| Provider | Free Tier | Paid Plans |
|----------|-----------|------------|
| Upstash | 10K commands/day | $0.20/100K commands |
| Redis Cloud | 30MB storage | $5/month for 1GB |
| Self-hosted | Free (+ server costs) | - |

### Vercel Cron

| Plan | Cron Jobs | Cost |
|------|-----------|------|
| Hobby (Free) | ❌ Not available | $0 |
| Pro | ✅ Unlimited | $20/month |
| Enterprise | ✅ Unlimited | Custom |

**Recommendation for Free Tier:** Use external cron service (cron-job.org)

---

## FAQ

**Q: Can I run the orchestrator without Vercel Cron?**
A: Yes! Use an external cron service or run `npm run orchestrator` on a persistent server.

**Q: What happens if a task fails?**
A: BullMQ automatically retries up to 3 times with exponential backoff. After max retries, the task is marked as `failed` in the database.

**Q: Can I pause/resume task scheduling?**
A: Yes, set `scheduleEnabled: false` in the database to pause a task.

**Q: How do I cancel a running task?**
A: Currently not supported. You can mark the task as `cancelled` in the database, but the current execution will complete.

**Q: Can I schedule tasks in different timezones?**
A: Yes! Set the `timezone` field when creating a task. Defaults to `America/New_York`.

**Q: What's the maximum task execution time?**
A: Default is 5 minutes (`300000ms`). Configure via `agentConfig.timeout`.

---

## Next Steps

1. ✅ Set up Redis (local or Upstash)
2. ✅ Run database migration
3. ✅ Test local orchestrator: `npm run orchestrator`
4. ✅ Create a test scheduled task
5. ✅ Deploy to Vercel with environment variables
6. ✅ Configure Vercel Cron or external cron service
7. ✅ Monitor logs and queue status

**Need Help?** Check the [main README](./README.md) or open an issue on GitHub.

---

## Related Documentation

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Cron Expression Guide](https://crontab.guru/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Upstash Redis](https://upstash.com/docs/redis)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
