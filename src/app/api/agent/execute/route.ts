/**
 * Agent Execution API Endpoint
 *
 * POST /api/agent/execute
 * Execute a task using the autonomous agent system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '@/lib/agent/executor';
import { toolRegistry } from '@/lib/agent/tools';
import { AgentTask, AgentConfig } from '@/lib/agent/types';

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
    const { taskId, goal, agentType, config } = body;

    // If taskId provided, execute existing task
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      if (task.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Execute the task
      return executeExistingTask(task, user.id);
    }

    // Create new task and execute
    if (!goal || !agentType) {
      return NextResponse.json(
        { error: 'goal and agentType required' },
        { status: 400 }
      );
    }

    const agentConfig: AgentConfig = config || {
      model: 'claude-sonnet-4-5-20250929',
      maxSteps: 20,
      timeout: 300000, // 5 minutes
      retryCount: 3,
    };

    // Create task
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: goal.substring(0, 100),
        description: goal,
        agentType,
        agentModel: agentConfig.model,
        agentConfig: agentConfig as any,
        status: 'planning',
        priority: 'medium',
      },
    });

    // Build agent task
    const agentTask: AgentTask = {
      id: task.id,
      userId: user.id,
      type: agentType,
      goal,
      config: agentConfig,
      createdAt: task.createdAt,
    };

    // Execute asynchronously if requested
    if (body.async) {
      // In production, this would use a job queue
      executeTaskAsync(agentTask, agentConfig);

      return NextResponse.json({
        success: true,
        taskId: task.id,
        status: 'planning',
        message: 'Task execution started in background',
      });
    }

    // Execute synchronously
    const executor = new AgentExecutor(agentType, agentConfig, toolRegistry);

    // Create plan
    const plan = await executor.plan(agentTask);

    // Check if user has enough credits
    const creditsNeeded = plan.estimatedCredits;
    if (user.creditsUsed + creditsNeeded > user.monthlyCredits) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: 'Insufficient credits',
        },
      });

      return NextResponse.json(
        {
          error: 'Insufficient credits',
          needed: creditsNeeded,
          available: user.monthlyCredits - user.creditsUsed,
        },
        { status: 402 }
      );
    }

    // Save plan
    await prisma.task.update({
      where: { id: task.id },
      data: {
        plan: plan as any,
        totalSteps: plan.totalSteps,
        status: 'executing',
      },
    });

    // Execute plan
    const result = await executor.execute(agentTask, plan);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: result.status,
      result: result.result,
      metrics: {
        steps: result.steps,
        duration: result.duration,
        creditsUsed: result.creditsUsed,
        tokensUsed: result.tokensUsed,
      },
      trace: result.trace,
    });

  } catch (error: any) {
    console.error('Error executing agent:', error);

    return NextResponse.json(
      {
        error: 'Agent execution failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Execute existing task
 */
async function executeExistingTask(task: any, userId: string) {
  const agentConfig: AgentConfig = task.agentConfig || {
    model: task.agentModel || 'claude-sonnet-4-5-20250929',
    maxSteps: 20,
    timeout: 300000,
    retryCount: 3,
  };

  const agentTask: AgentTask = {
    id: task.id,
    userId,
    type: task.agentType,
    goal: task.description || task.title,
    config: agentConfig,
    createdAt: task.createdAt,
  };

  const executor = new AgentExecutor(task.agentType, agentConfig, toolRegistry);

  // If plan exists, use it; otherwise create new plan
  let plan = task.plan;
  if (!plan) {
    plan = await executor.plan(agentTask);
    await prisma.task.update({
      where: { id: task.id },
      data: {
        plan: plan as any,
        totalSteps: plan.totalSteps,
        status: 'executing',
      },
    });
  }

  // Execute
  const result = await executor.execute(agentTask, plan);

  return NextResponse.json({
    success: true,
    taskId: task.id,
    status: result.status,
    result: result.result,
    metrics: {
      steps: result.steps,
      duration: result.duration,
      creditsUsed: result.creditsUsed,
      tokensUsed: result.tokensUsed,
    },
    trace: result.trace,
  });
}

/**
 * Execute task asynchronously (placeholder for job queue)
 */
async function executeTaskAsync(task: AgentTask, config: AgentConfig) {
  // In production, this would push to a job queue (BullMQ)
  // For now, we just execute in background
  setTimeout(async () => {
    try {
      const executor = new AgentExecutor(task.type, config, toolRegistry);
      const plan = await executor.plan(task);

      await prisma.task.update({
        where: { id: task.id },
        data: {
          plan: plan as any,
          totalSteps: plan.totalSteps,
          status: 'executing',
        },
      });

      await executor.execute(task, plan);
    } catch (error) {
      console.error('Async execution failed:', error);
    }
  }, 0);
}
