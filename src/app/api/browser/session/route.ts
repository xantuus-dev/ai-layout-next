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
      select: { id: true, monthlyCredits: true, creditsUsed: true, plan: true },
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
    const availableCredits = user.monthlyCredits - user.creditsUsed;
    if (availableCredits < BROWSER_SESSION_COST) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: BROWSER_SESSION_COST,
          available: availableCredits,
        },
        { status: 402 }
      );
    }

    // Deduct credits
    await deductCredits(user.id, BROWSER_SESSION_COST, {
      type: 'browser_session',
      description: 'Browser automation session created',
    });

    // Get request body for session configuration
    const body = await req.json().catch(() => ({}));
    const { url, chatEnabled, navigationEnabled } = body;

    // Create browser session in memory
    const sessionId = await browserControl.createSession(user.id);

    // Create database record for persistence
    const dbSession = await prisma.browserSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        url: url || 'about:blank',
        chatEnabled: chatEnabled ?? false,
        navigationEnabled: navigationEnabled ?? false,
        status: 'active',
        totalCreditsUsed: BROWSER_SESSION_COST,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId,
      session: {
        id: dbSession.id,
        url: dbSession.url,
        chatEnabled: dbSession.chatEnabled,
        navigationEnabled: dbSession.navigationEnabled,
        status: dbSession.status,
        startedAt: dbSession.startedAt,
      },
      creditsUsed: BROWSER_SESSION_COST,
      creditsRemaining: availableCredits - BROWSER_SESSION_COST,
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

    // Get user's browser sessions
    const sessions = await prisma.browserSession.findMany({
      where: {
        userId: user.id,
        status: { in: ['active', 'paused'] },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        url: s.url,
        title: s.title,
        chatEnabled: s.chatEnabled,
        navigationEnabled: s.navigationEnabled,
        status: s.status,
        startedAt: s.startedAt,
        totalCreditsUsed: s.totalCreditsUsed,
      })),
    });
  } catch (error: any) {
    console.error('Browser session list error:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions', message: error.message },
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

    // Verify session belongs to user
    const dbSession = await prisma.browserSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!dbSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Close session in memory
    await browserControl.closeSession(sessionId);

    // Update database record
    await prisma.browserSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Browser session close error:', error);
    return NextResponse.json(
      { error: 'Failed to close session', message: error.message },
      { status: 500 }
    );
  }
}
