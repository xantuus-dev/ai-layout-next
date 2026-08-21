/**
 * POST /api/agent/autonomy
 *
 * Phase one of Autonomy Mode: take a free-text goal, classify it, plan it, and
 * return a proposal the user can accept. Nothing executes here and no
 * irreversible tool runs — the response is a quote, not a receipt.
 *
 * Accept the proposal at POST /api/agent/autonomy/confirm.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prepareAutonomousRun, type AutonomyFailureReason } from '@/lib/agent/autonomy';

export const runtime = 'nodejs';

// Planning is a single model call over the full tool catalog; the default
// function timeout is tight for it.
export const maxDuration = 120;

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
      return 502;
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
    const { goal, config } = body;

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json({ error: 'goal is required' }, { status: 400 });
    }

    const result = await prepareAutonomousRun({ userId: user.id, goal, config });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: statusFor(result.reason) });
    }

    return NextResponse.json({ success: true, proposal: result.proposal }, { status: 201 });
  } catch (error) {
    console.error('Autonomy prepare error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
