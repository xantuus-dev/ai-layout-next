/**
 * Get Workflow Execution Status
 *
 * GET /api/workflows/execution/[id]
 * - Returns current execution status
 * - Includes step-by-step execution trace
 * - Used for real-time monitoring in the visual builder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const executionId = params.id;

    // Get task/execution from database
    const task = await prisma.task.findUnique({
      where: { id: executionId },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (task.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get execution trace from latest execution
    const latestExecution = task.executions[0];
    const executionTrace: any[] = [];

    // Parse plan metadata to get visual node mapping
    const plan = task.plan as any;
    const visualLayout = plan?.metadata?.visualLayout || [];

    // Map execution trace to visual nodes
    const nodeStates = visualLayout.map((node: any, index: number) => {
      const stepTrace = executionTrace.find((trace: any) =>
        trace.stepNumber === index + 1 || trace.metadata?.nodeId === node.id
      );

      return {
        stepId: node.id,
        stepNumber: index + 1,
        status: stepTrace?.status || 'pending',
        output: stepTrace?.output,
        error: stepTrace?.error,
        startTime: stepTrace?.startTime,
        endTime: stepTrace?.endTime,
        duration: stepTrace?.duration,
      };
    });

    return NextResponse.json({
      success: true,
      execution: {
        id: task.id,
        status: task.status,
        currentStep: task.currentStep || 0,
        totalSteps: task.totalSteps || 0,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        error: task.error,
        result: task.result,
        creditsUsed: task.totalCredits || 0,
        tokensUsed: task.totalTokens || 0,

        // Execution trace for visual nodes
        executionTrace: nodeStates,

        // Raw execution data
        rawTrace: executionTrace,
      },
    });
  } catch (error: any) {
    console.error('[Execution Status] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get execution status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
