/**
 * Execute Visual Workflow via AI Agent
 *
 * POST /api/workflows/execute
 * - Converts visual workflow to agent execution plan
 * - Executes via AgentExecutor
 * - Returns execution ID for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';
import {
  convertVisualWorkflowToAgentPlan,
  createAgentTaskFromVisualWorkflow,
} from '@/lib/workflow-builder/visual-to-agent-converter';
import { CanvasNode } from '@/stores/workflow-builder-store';

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
    const {
      nodes,
      workflowName,
      workflowDescription,
      workflowId,
      isTest = false,
    } = body as {
      nodes: CanvasNode[];
      workflowName: string;
      workflowDescription: string;
      workflowId?: string;
      isTest?: boolean;
    };

    // Validate input
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'No workflow steps provided' },
        { status: 400 }
      );
    }

    // Create task in database
    const agentTaskData = createAgentTaskFromVisualWorkflow(
      user.id,
      nodes,
      workflowName || 'Untitled Workflow',
      workflowDescription || ''
    );

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: workflowName || 'Untitled Workflow',
        description: workflowDescription || 'Visual workflow execution',
        agentType: agentTaskData.type,
        agentModel: agentTaskData.config.model,
        agentConfig: agentTaskData.config as any,
        status: 'pending',
        priority: isTest ? 'low' : 'medium',
        tags: ['visual-workflow', workflowId ? 'saved' : 'unsaved'],
      },
    });

    // Convert visual workflow to agent execution plan
    const executionPlan = convertVisualWorkflowToAgentPlan(
      task.id,
      nodes,
      workflowName || 'Untitled Workflow',
      workflowDescription || ''
    );

    // Check credits
    const creditsNeeded = executionPlan.estimatedCredits;
    const creditsAvailable = user.monthlyCredits - user.creditsUsed;

    if (creditsAvailable < creditsNeeded) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          needed: creditsNeeded,
          available: creditsAvailable,
        },
        { status: 402 }
      );
    }

    // Save plan to database
    await prisma.task.update({
      where: { id: task.id },
      data: {
        plan: executionPlan as any,
        totalSteps: executionPlan.totalSteps,
        status: 'executing',
        startedAt: new Date(),
      },
    });

    // Execute in background (don't await)
    executeWorkflowInBackground(task.id, user.id, executionPlan, agentTaskData);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      executionId: task.id,
      status: 'executing',
      estimatedCredits: executionPlan.estimatedCredits,
      estimatedDuration: executionPlan.estimatedDuration,
      message: isTest
        ? 'Test execution started. Monitor progress in real-time.'
        : 'Workflow execution started successfully.',
    });
  } catch (error: any) {
    console.error('[Workflow Execute] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute workflow',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Execute workflow in background
 */
async function executeWorkflowInBackground(
  taskId: string,
  userId: string,
  plan: any,
  taskData: any
) {
  try {
    console.log(`[Workflow Execute] Starting execution for task ${taskId}`);

    // Create agent executor
    const executor = new AgentExecutor(
      taskData.type,
      taskData.config,
      toolRegistry
    );

    // Create agent task
    const agentTask = {
      id: taskId,
      userId,
      type: taskData.type,
      goal: taskData.goal,
      config: taskData.config,
      createdAt: new Date(),
      context: taskData.context,
    };

    // Execute the plan
    const result = await executor.execute(agentTask, plan);

    console.log(`[Workflow Execute] Completed task ${taskId}:`, {
      status: result.status,
      creditsUsed: result.creditsUsed,
    });

    // Update task with results
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: result.status === 'completed' ? 'completed' : 'failed',
        completedAt: new Date(),
        result: result.result as any,
        error: result.error,
        totalCredits: result.creditsUsed,
        totalTokens: result.tokensUsed,
      },
    });

    // Update user credits
    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsed: { increment: result.creditsUsed },
      },
    });

    // Create usage record
    await prisma.usageRecord.create({
      data: {
        userId,
        type: 'visual_workflow_execution',
        credits: result.creditsUsed,
        tokens: result.tokensUsed,
        metadata: {
          taskId,
          workflowName: plan.metadata?.workflowName,
          status: result.status,
          steps: plan.totalSteps,
        },
      },
    });

  } catch (error: any) {
    console.error(`[Workflow Execute] Error executing task ${taskId}:`, error);

    // Mark task as failed
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error.message || 'Unknown error',
      },
    });
  }
}
