/**
 * Workflow Management API
 *
 * GET /api/browser/workflow - List user's workflows
 * POST /api/browser/workflow - Create new workflow
 * PUT /api/browser/workflow - Update workflow (with ID in body)
 * DELETE /api/browser/workflow?id=xxx - Delete workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const includeTemplates = searchParams.get('templates') === 'true';

    // Get user's workflows
    const where: any = includeTemplates
      ? { OR: [{ userId: user.id }, { isTemplate: true, isActive: true }] }
      : { userId: user.id };

    const workflows = await prisma.workflow.findMany({
      where,
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { executions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        icon: w.icon,
        color: w.color,
        isActive: w.isActive,
        isTemplate: w.isTemplate,
        schedule: w.schedule,
        totalRuns: w.totalRuns,
        successfulRuns: w.successfulRuns,
        failedRuns: w.failedRuns,
        lastRunAt: w.lastRunAt,
        stepCount: w.steps.length,
        executionCount: w._count.executions,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Workflow list error:', error);
    return NextResponse.json(
      { error: 'Failed to list workflows', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      name,
      description,
      icon,
      color,
      steps,
      schedule,
      isAIAssisted,
      timeoutSeconds,
    } = body;

    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Name and steps are required' },
        { status: 400 }
      );
    }

    // Create workflow with steps
    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name,
        description,
        icon,
        color,
        schedule,
        isAIAssisted: isAIAssisted ?? true,
        timeoutSeconds: timeoutSeconds ?? 300,
        steps: {
          create: steps.map((step: any, index: number) => ({
            order: index,
            type: step.type,
            action: step.action,
            onError: step.onError || 'stop',
            maxRetries: step.maxRetries ?? 3,
            retryDelay: step.retryDelay ?? 1000,
            condition: step.condition,
            skipIfFalse: step.skipIfFalse ?? false,
            saveOutput: step.saveOutput ?? false,
            outputName: step.outputName,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        createdAt: workflow.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Workflow creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const { id, name, description, icon, color, steps, schedule, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Update workflow
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (isActive !== undefined) updateData.isActive = isActive;

    // If steps are provided, delete old ones and create new ones
    if (steps && Array.isArray(steps)) {
      await prisma.workflowStep.deleteMany({
        where: { workflowId: id },
      });

      updateData.steps = {
        create: steps.map((step: any, index: number) => ({
          order: index,
          type: step.type,
          action: step.action,
          onError: step.onError || 'stop',
          maxRetries: step.maxRetries ?? 3,
          retryDelay: step.retryDelay ?? 1000,
          condition: step.condition,
          skipIfFalse: step.skipIfFalse ?? false,
          saveOutput: step.saveOutput ?? false,
          outputName: step.outputName,
        })),
      };
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Workflow update error:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    // Verify ownership
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow || workflow.userId !== user.id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Delete workflow (steps will cascade delete)
    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Workflow deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow', message: error.message },
      { status: 500 }
    );
  }
}
