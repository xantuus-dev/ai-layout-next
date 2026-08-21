/**
 * POST /api/agent/autonomy/confirm
 *
 * Phase two of Autonomy Mode: accept a proposal from POST /api/agent/autonomy,
 * grant the irreversible tools the run may use unattended, and queue it.
 *
 * `approvedTools` is intersected with the plan's own sensitive tools, so this
 * endpoint can never grant more than the proposal actually showed the user.
 * Anything left ungranted comes back as `willPauseFor` — the run will stop and
 * wait when it reaches one of those steps rather than proceeding without
 * permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { confirmAutonomousRun, type AutonomyFailureReason } from '@/lib/agent/autonomy';

export const runtime = 'nodejs';

function statusFor(reason: AutonomyFailureReason): number {
  switch (reason) {
    case 'invalid_input':
      return 400;
    case 'not_found':
      return 404;
    case 'insufficient_credits':
    case 'viewer_cannot_spend':
      return 402;
    case 'planning_failed':
      return 409;
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { taskId, approvedTools } = body;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    if (approvedTools !== undefined && !Array.isArray(approvedTools)) {
      return NextResponse.json(
        { error: 'approvedTools must be an array of tool names' },
        { status: 400 }
      );
    }

    const result = await confirmAutonomousRun({
      userId: user.id,
      taskId,
      approvedTools: approvedTools?.filter((tool: unknown) => typeof tool === 'string'),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: statusFor(result.reason) });
    }

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      approvedTools: result.approvedTools,
      willPauseFor: result.willPauseFor,
    });
  } catch (error) {
    console.error('Autonomy confirm error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
