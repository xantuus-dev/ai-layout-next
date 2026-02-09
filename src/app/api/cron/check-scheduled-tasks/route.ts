/**
 * Cron Endpoint for Scheduled Task Checking
 *
 * This endpoint should be called by an external cron service (e.g., cron-job.org, EasyCron)
 * or Vercel Cron to check for scheduled tasks and queue them for execution.
 *
 * Security: Uses CRON_SECRET environment variable for authentication
 *
 * Example setup with Vercel Cron (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-scheduled-tasks",
 *     "schedule": "* * * * *"
 *   }]
 * }
 *
 * Example with external cron service:
 * curl -X POST https://yourdomain.com/api/cron/check-scheduled-tasks \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { queueAgentTask } from '@/lib/queue/agent-queue';
import { CronExpressionParser } from 'cron-parser';

export const runtime = 'nodejs'; // Required for Vercel Cron
export const dynamic = 'force-dynamic'; // Disable caching

/**
 * POST /api/cron/check-scheduled-tasks
 * Check for scheduled tasks and queue them for execution
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow both Vercel Cron (no auth) and external cron (with auth)
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');

    if (!isVercelCron) {
      if (!cronSecret) {
        return NextResponse.json(
          { error: 'CRON_SECRET not configured' },
          { status: 500 }
        );
      }

      const token = authHeader?.replace('Bearer ', '');
      if (token !== cronSecret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('🔍 Checking for scheduled tasks...');

    // Find tasks that are scheduled and due to run
    const now = new Date();
    const scheduledTasks = await prisma.task.findMany({
      where: {
        scheduleEnabled: true,
        nextRunAt: {
          lte: now,
        },
        status: {
          in: ['pending', 'completed'], // Only run pending or previously completed tasks
        },
      },
      orderBy: {
        priority: 'desc', // Higher priority first
      },
      take: 50, // Process max 50 tasks per check
      include: {
        user: {
          select: {
            id: true,
            plan: true,
            creditsUsed: true,
            monthlyCredits: true,
          },
        },
      },
    });

    if (scheduledTasks.length === 0) {
      console.log('✅ No scheduled tasks to run');
      return NextResponse.json({
        success: true,
        tasksQueued: 0,
        message: 'No scheduled tasks due',
      });
    }

    console.log(`📅 Found ${scheduledTasks.length} scheduled tasks to run`);

    const results = {
      queued: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Queue each task
    for (const task of scheduledTasks) {
      try {
        // Check if user has enough credits
        const creditsAvailable = task.user.monthlyCredits - task.user.creditsUsed;
        const estimatedCredits = (task.plan as any)?.estimatedCredits || 100;

        if (creditsAvailable < estimatedCredits) {
          console.log(`⚠️ Skipping task ${task.id} - insufficient credits`);
          results.skipped++;

          // Update task to indicate credit issue
          await prisma.task.update({
            where: { id: task.id },
            data: {
              error: 'Insufficient credits for scheduled execution',
              status: 'failed',
            },
          });

          continue;
        }

        // Queue the task
        const priority = getPriorityValue(task.priority);
        await queueAgentTask(task.user.id, task.id, {
          priority,
          retryCount: 3,
        });

        // Calculate next run time from cron expression
        const nextRunAt = calculateNextRunTime(task.schedule!, task.timezone || 'America/New_York');

        // Update task with next run time
        await prisma.task.update({
          where: { id: task.id },
          data: {
            nextRunAt,
            lastRunAt: now,
            status: 'pending', // Reset status for queue processing
          },
        });

        console.log(`✅ Queued task ${task.id}, next run: ${nextRunAt.toISOString()}`);
        results.queued++;

      } catch (error: any) {
        console.error(`❌ Failed to queue task ${task.id}:`, error);
        results.failed++;
        results.errors.push(`Task ${task.id}: ${error.message}`);
      }
    }

    console.log(`✅ Scheduled task check complete: ${results.queued} queued, ${results.skipped} skipped, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      tasksQueued: results.queued,
      tasksSkipped: results.skipped,
      tasksFailed: results.failed,
      errors: results.errors,
      checkedAt: now.toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Cron job failed:', error);

    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health checks
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');

  if (!isVercelCron) {
    const token = authHeader?.replace('Bearer ', '');
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Get count of scheduled tasks
  const scheduledCount = await prisma.task.count({
    where: {
      scheduleEnabled: true,
      status: {
        in: ['pending', 'completed'],
      },
    },
  });

  const dueCount = await prisma.task.count({
    where: {
      scheduleEnabled: true,
      nextRunAt: {
        lte: new Date(),
      },
      status: {
        in: ['pending', 'completed'],
      },
    },
  });

  return NextResponse.json({
    status: 'healthy',
    scheduledTasks: scheduledCount,
    tasksCurrentlyDue: dueCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Convert priority string to numeric value
 */
function getPriorityValue(priority: string | null): number {
  switch (priority) {
    case 'urgent':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
      return 4;
    default:
      return 3;
  }
}

/**
 * Calculate next run time from cron expression
 */
function calculateNextRunTime(cronExpression: string, timezone: string): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
      tz: timezone,
    });
    return interval.next().toDate();
  } catch (error) {
    console.error('Invalid cron expression:', cronExpression, error);
    // Default to 1 day from now if cron parsing fails
    return new Date(Date.now() + 86400000);
  }
}
