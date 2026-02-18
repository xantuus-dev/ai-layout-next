/**
 * Pause Agent Task API
 *
 * Pauses a running agent task and saves its state for later resume.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Authenticate user
  const session = await getServerSession(authOptions);

  try {
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

    // Verify task belongs to user
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: session.user.id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if task is in a pauseable state
    if (!['executing', 'planning'].includes(task.status)) {
      return NextResponse.json(
        { error: `Cannot pause task in ${task.status} status` },
        { status: 400 }
      );
    }

    // Update task status to paused
    // The actual pause logic will be triggered by the agent executor
    // when it checks for the pause signal
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'paused',
        lastRunAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Task pause requested. Task will pause after current step completes.',
    });

  } catch (error: any) {
    console.error('Error pausing task:', error);
    captureAPIError(error, '/api/agent/pause', 'POST', session?.user?.id);

    return NextResponse.json(
      { error: 'Failed to pause task', details: error.message },
      { status: 500 }
    );
  }
}
