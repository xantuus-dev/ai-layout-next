/**
 * Manual Price Monitor Execution
 *
 * POST /api/workflows/price-monitor/[id]/run - Run monitor immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const monitor = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    if (monitor.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if already running
    if (monitor.status === 'executing') {
      return NextResponse.json(
        {
          error: 'Monitor is already running',
          message: 'Please wait for the current execution to complete',
        },
        { status: 409 }
      );
    }

    // Check credits
    const estimatedCredits = 200;
    if (user.creditsUsed + estimatedCredits > user.monthlyCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          needed: estimatedCredits,
          available: user.monthlyCredits - user.creditsUsed,
        },
        { status: 402 }
      );
    }

    // Update status
    await prisma.task.update({
      where: { id: params.id },
      data: {
        status: 'executing',
        lastRunAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Execute in background
    const plan = monitor.plan as any;
    const config = plan.metadata?.config;

    setTimeout(async () => {
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
          id: monitor.id,
          userId: user.id,
          type: 'browser_automation' as any,
          goal: monitor.description || monitor.title,
          config: monitor.agentConfig as any,
          createdAt: monitor.createdAt,
          context: config,
        };

        await executor.execute(agentTask, plan);

      } catch (error) {
        console.error('[PriceMonitor] Manual execution failed:', error);
      }
    }, 0);

    return NextResponse.json({
      success: true,
      taskId: params.id,
      status: 'executing',
      message: 'Price check started. Refresh in a few seconds to see results.',
    });

  } catch (error: any) {
    console.error('Error running monitor:', error);

    return NextResponse.json(
      {
        error: 'Failed to run monitor',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
