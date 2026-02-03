/**
 * AI Navigation API
 *
 * POST /api/browser/navigate - Execute natural language browser command
 * GET /api/browser/navigate/history - Get command history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parseCommand,
  executeNavigationCommand,
  validateCommand,
  getCommandHistory,
} from '@/lib/browser-ai-nav';

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

    const body = await req.json();
    const { sessionId, command, currentUrl, pageContext } = body;

    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'Session ID and command required' },
        { status: 400 }
      );
    }

    // Validate command
    const validation = validateCommand(command);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify session belongs to user
    const browserSession = await prisma.browserSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!browserSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if navigation is enabled for this session
    if (!browserSession.navigationEnabled) {
      return NextResponse.json(
        { error: 'AI navigation not enabled for this session' },
        { status: 403 }
      );
    }

    // Check available credits (estimate 50 credits for safety)
    const availableCredits = user.monthlyCredits - user.creditsUsed;
    if (availableCredits < 50) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: 50,
          available: availableCredits,
        },
        { status: 402 }
      );
    }

    // Parse command into actions
    let parsedCommand;
    try {
      parsedCommand = await parseCommand(command, currentUrl, pageContext);
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to parse command', message: error.message },
        { status: 400 }
      );
    }

    // Execute navigation command
    const result = await executeNavigationCommand(
      sessionId,
      user.id,
      parsedCommand
    );

    // Update browser session
    await prisma.browserSession.update({
      where: { id: sessionId },
      data: {
        totalCreditsUsed: { increment: result.credits },
      },
    });

    return NextResponse.json({
      success: result.success,
      command: {
        original: command,
        parsed: result.command.description,
        reasoning: result.command.reasoning,
        actions: result.command.actions,
      },
      execution: {
        totalActions: result.totalActions,
        successfulActions: result.successfulActions,
        results: result.results,
        executionTime: result.executionTime,
      },
      usage: {
        credits: result.credits,
        creditsRemaining: availableCredits - result.credits,
      },
    });
  } catch (error: any) {
    console.error('Navigation command error:', error);
    return NextResponse.json(
      { error: 'Failed to execute navigation command', message: error.message },
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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get command history
    const history = await getCommandHistory(user.id, Math.min(limit, 50));

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error('Navigation history error:', error);
    return NextResponse.json(
      { error: 'Failed to get navigation history', message: error.message },
      { status: 500 }
    );
  }
}
