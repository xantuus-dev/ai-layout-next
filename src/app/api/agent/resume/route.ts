/**
 * Resume Agent Task API
 *
 * Resumes a paused agent task from where it left off.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { ToolRegistry } from '@/lib/agent/tools/registry';
import { AgentState } from '@/lib/agent/types';
import { queueAgentTask } from '@/lib/queue/agent-queue';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Verify task belongs to user and is paused
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: session.user.id,
      },
      include: {
        executions: {
          orderBy: { step: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status !== 'paused') {
      return NextResponse.json(
        { error: `Cannot resume task in ${task.status} status. Only paused tasks can be resumed.` },
        { status: 400 }
      );
    }

    // Reconstruct state from database
    const state: AgentState = {
      taskId: task.id,
      status: 'paused',
      currentStep: task.currentStep,
      totalSteps: task.totalSteps,
      progress: Math.round((task.currentStep / task.totalSteps) * 100),
      startedAt: task.startedAt || new Date(),
      lastActivityAt: task.lastRunAt || new Date(),
      creditsUsed: task.totalCredits,
      tokensUsed: task.totalTokens,
      executionTime: task.executionTime || 0,
      context: (task.executionTrace as any)?.context || {},
      trace: (task.executionTrace as any)?.trace || [],
    };

    // Update task status to executing
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'executing',
        attempts: { increment: 1 },
        lastRunAt: new Date(),
      },
    });

    // Queue the task for execution with resume state
    const jobId = await queueAgentTask(taskId, session.user.id, {
      priority: task.priority === 'urgent' ? 10 : task.priority === 'high' ? 5 : 1,
    });

    return NextResponse.json({
      success: true,
      taskId,
      jobId,
      message: 'Task queued for resume',
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      progress: state.progress,
    });

  } catch (error: any) {
    console.error('Error resuming task:', error);
    captureAPIError(error, '/api/agent/resume', 'POST', session?.user?.id);

    return NextResponse.json(
      { error: 'Failed to resume task', details: error.message },
      { status: 500 }
    );
  }
}
