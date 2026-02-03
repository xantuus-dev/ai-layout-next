/**
 * Workflow Execution API
 *
 * POST /api/browser/workflow/[id]/execute - Execute workflow
 * GET /api/browser/workflow/[id]/execute - Get execution history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executeWorkflow, getWorkflowExecutions } from '@/lib/workflow-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, monthlyCredits: true, creditsUsed: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const workflowId = params.id;
    const body = await req.json();
    const { sessionId, variables } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Verify workflow exists and belongs to user (or is a template)
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.userId !== user.id && !workflow.isTemplate) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check credits (estimate based on step count)
    const estimatedCredits = 50 + workflow.steps.length * 5;
    const availableCredits = user.monthlyCredits - user.creditsUsed;
    if (availableCredits < estimatedCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: estimatedCredits,
          available: availableCredits,
        },
        { status: 402 }
      );
    }

    // Verify browser session exists and belongs to user
    const browserSession = await prisma.browserSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!browserSession) {
      return NextResponse.json({ error: 'Browser session not found' }, { status: 404 });
    }

    // Execute workflow
    const execution = await executeWorkflow(
      workflowId,
      sessionId,
      user.id,
      variables || {}
    );

    return NextResponse.json({
      success: execution.status === 'completed',
      execution: {
        status: execution.status,
        currentStep: execution.currentStep,
        totalSteps: execution.totalSteps,
        executionTrace: execution.executionTrace,
        variables: execution.variables,
        aiRecoveries: execution.aiRecoveries,
        duration: Date.now() - execution.startTime,
      },
    });
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const workflowId = params.id;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const executions = await getWorkflowExecutions(workflowId, user.id, limit);

    return NextResponse.json({
      success: true,
      executions: executions.map((exec) => ({
        id: exec.id,
        status: exec.status,
        currentStep: exec.currentStep,
        totalSteps: exec.totalSteps,
        result: exec.result,
        error: exec.error,
        totalCredits: exec.totalCredits,
        duration: exec.duration,
        createdAt: exec.createdAt,
        completedAt: exec.completedAt,
      })),
    });
  } catch (error: any) {
    console.error('Workflow execution history error:', error);
    return NextResponse.json(
      { error: 'Failed to get execution history', message: error.message },
      { status: 500 }
    );
  }
}
