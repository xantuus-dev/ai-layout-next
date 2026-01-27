/**
 * Individual Price Monitor Management
 *
 * GET /api/workflows/price-monitor/[id] - Get monitor details
 * DELETE /api/workflows/price-monitor/[id] - Delete monitor
 * POST /api/workflows/price-monitor/[id]/run - Run monitor now
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';

/**
 * GET - Get price monitor details with history
 */
export async function GET(
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
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 30, // Last 30 runs
        },
      },
    });

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    if (monitor.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const config = (monitor.plan as any)?.metadata?.config;

    // Parse execution history
    const history = monitor.executions.map((exec: any) => ({
      date: exec.createdAt,
      status: exec.status,
      price: exec.output?.extracted?.price,
      duration: exec.duration,
      credits: exec.credits,
    }));

    return NextResponse.json({
      success: true,
      monitor: {
        id: monitor.id,
        title: monitor.title,
        status: monitor.status,
        config: {
          competitorUrl: config?.competitorUrl,
          priceSelector: config?.priceSelector,
          thresholdPrice: config?.thresholdPrice,
          alertEmail: config?.alertEmail,
          checkFrequency: config?.checkFrequency,
          checkTime: config?.checkTime,
        },
        stats: {
          totalRuns: monitor.attempts,
          lastRun: monitor.lastRunAt,
          totalCredits: monitor.totalCredits,
          successRate: history.length > 0
            ? (history.filter((h: any) => h.status === 'completed').length / history.length) * 100
            : 0,
        },
        history,
        createdAt: monitor.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Error fetching monitor:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch monitor',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete price monitor
 */
export async function DELETE(
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

    // Delete the monitor and all its executions
    await prisma.task.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Price monitor deleted successfully',
    });

  } catch (error: any) {
    console.error('Error deleting monitor:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete monitor',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
