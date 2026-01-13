/**
 * Browser Session Management API
 * POST /api/browser/session - Create new browser session
 * DELETE /api/browser/session - Close browser session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { browserControl } from '@/lib/browser-control';
import { prisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';

const BROWSER_SESSION_COST = 50; // Credits per session

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, credits: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has Pro or Enterprise plan
    if (user.plan === 'free') {
      return NextResponse.json(
        { error: 'Browser control requires Pro or Enterprise plan' },
        { status: 403 }
      );
    }

    // Check rate limit
    const rateLimit = browserControl.checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum browser sessions per hour reached',
        },
        { status: 429 }
      );
    }

    // Check credits
    if (user.credits < BROWSER_SESSION_COST) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: BROWSER_SESSION_COST,
          available: user.credits,
        },
        { status: 402 }
      );
    }

    // Deduct credits
    await deductCredits(user.id, BROWSER_SESSION_COST, 'browser_session');

    // Create browser session
    const sessionId = await browserControl.createSession(user.id);

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        credits: BROWSER_SESSION_COST,
        action: 'browser_session',
        metadata: { sessionId },
      },
    });

    return NextResponse.json({
      success: true,
      sessionId,
      creditsUsed: BROWSER_SESSION_COST,
      creditsRemaining: user.credits - BROWSER_SESSION_COST,
      rateLimitRemaining: rateLimit.remaining,
    });
  } catch (error: any) {
    console.error('Browser session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create browser session', message: error.message },
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

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Close session
    await browserControl.closeSession(sessionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Browser session close error:', error);
    return NextResponse.json(
      { error: 'Failed to close session', message: error.message },
      { status: 500 }
    );
  }
}
