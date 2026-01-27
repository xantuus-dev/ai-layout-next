/**
 * Competitor Price Monitor Workflow API
 *
 * POST /api/workflows/price-monitor - Create new price monitoring task
 * GET /api/workflows/price-monitor - List all price monitors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';
import {
  createPriceMonitorPlan,
  createPriceMonitorTask,
  validatePriceMonitorConfig,
  estimatePriceMonitorCost,
  CompetitorPriceMonitorConfig,
} from '@/lib/agent/workflows/competitor-price-monitor';

/**
 * POST - Create and run price monitoring workflow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const config: CompetitorPriceMonitorConfig = {
      competitorUrl: body.competitorUrl,
      priceSelector: body.priceSelector,
      thresholdPrice: parseFloat(body.thresholdPrice),
      alertEmail: body.alertEmail || user.email || '',
      checkFrequency: body.checkFrequency || 'daily',
      checkTime: body.checkTime || '09:00',
    };

    // Validate configuration
    const validation = validatePriceMonitorConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Estimate cost
    const costEstimate = estimatePriceMonitorCost();
    const creditsNeeded = costEstimate.creditsPerRun;

    // Check if user has enough credits
    if (user.creditsUsed + creditsNeeded > user.monthlyCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          needed: creditsNeeded,
          available: user.monthlyCredits - user.creditsUsed,
          upgrade: true,
        },
        { status: 402 }
      );
    }

    // Create task in database
    const taskTemplate = createPriceMonitorTask(user.id, config);
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: `Price Monitor: ${config.competitorUrl}`,
        description: taskTemplate.goal,
        agentType: taskTemplate.type,
        agentModel: taskTemplate.config.model,
        agentConfig: taskTemplate.config as any,
        status: 'pending',
        priority: 'medium',
        tags: ['price-monitor', 'competitor', 'automation'],
      },
    });

    // Create pre-configured execution plan
    const plan = createPriceMonitorPlan(task.id, config);

    // Save plan to database
    await prisma.task.update({
      where: { id: task.id },
      data: {
        plan: plan as any,
        totalSteps: plan.totalSteps,
        status: 'executing',
        startedAt: new Date(),
      },
    });

    // Execute immediately if requested
    if (body.runNow !== false) {
      // Execute in background
      executeMonitor(task.id, user.id, config, plan);

      return NextResponse.json({
        success: true,
        taskId: task.id,
        status: 'executing',
        message: 'Price monitor started. Check status in a few seconds.',
        estimatedCost: costEstimate,
      });
    }

    // Schedule for later
    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: 'scheduled',
      message: `Price monitor scheduled to run ${config.checkFrequency} at ${config.checkTime}`,
      estimatedCost: costEstimate,
    });

  } catch (error: any) {
    console.error('Error creating price monitor:', error);

    return NextResponse.json(
      {
        error: 'Failed to create price monitor',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - List all price monitors for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all price monitoring tasks
    const monitors = await prisma.task.findMany({
      where: {
        userId: user.id,
        agentType: 'browser_automation',
        tags: {
          has: 'price-monitor',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const monitorsWithStats = monitors.map((monitor) => {
      const config = (monitor.plan as any)?.metadata?.config;

      return {
        id: monitor.id,
        title: monitor.title,
        status: monitor.status,
        competitorUrl: config?.competitorUrl,
        thresholdPrice: config?.thresholdPrice,
        lastRun: monitor.lastRunAt,
        lastResult: monitor.result,
        creditsUsed: monitor.totalCredits,
        createdAt: monitor.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      monitors: monitorsWithStats,
      total: monitorsWithStats.length,
    });

  } catch (error: any) {
    console.error('Error fetching price monitors:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch price monitors',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Execute price monitoring workflow
 */
async function executeMonitor(
  taskId: string,
  userId: string,
  config: CompetitorPriceMonitorConfig,
  plan: any
) {
  try {
    const executor = new AgentExecutor(
      'browser_automation',
      {
        model: 'claude-sonnet-4-5-20250929',
        maxSteps: 10,
        timeout: 60000,
        retryCount: 2,
      },
      toolRegistry
    );

    const agentTask = {
      id: taskId,
      userId,
      type: 'browser_automation' as any,
      goal: `Monitor ${config.competitorUrl} for price changes`,
      config: {
        model: 'claude-sonnet-4-5-20250929',
        maxSteps: 10,
        timeout: 60000,
        retryCount: 2,
      },
      createdAt: new Date(),
      context: config,
    };

    // Execute the plan
    const result = await executor.execute(agentTask, plan);

    console.log('[PriceMonitor] Execution completed:', {
      taskId,
      status: result.status,
      creditsUsed: result.creditsUsed,
    });

  } catch (error) {
    console.error('[PriceMonitor] Execution failed:', error);
  }
}
