/**
 * Agent Status API Endpoint
 *
 * GET /api/agent/status/[taskId]
 * Get current status of an executing agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
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

    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: {
        executions: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate progress
    const progress = task.totalSteps > 0
      ? Math.round((task.currentStep / task.totalSteps) * 100)
      : 0;

    // Get execution time
    const executionTime = task.startedAt
      ? (task.completedAt || new Date()).getTime() - task.startedAt.getTime()
      : 0;

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      currentStep: task.currentStep,
      totalSteps: task.totalSteps,
      progress,
      executionTime,
      creditsUsed: task.totalCredits,
      tokensUsed: task.totalTokens,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      executions: task.executions.map((exec: any) => ({
        step: exec.step,
        action: exec.action,
        tool: exec.tool,
        status: exec.status,
        reasoning: exec.reasoning,
        error: exec.error,
        duration: exec.duration,
        credits: exec.credits,
        createdAt: exec.createdAt,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching agent status:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
