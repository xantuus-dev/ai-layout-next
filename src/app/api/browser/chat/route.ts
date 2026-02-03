/**
 * Browser Chat API
 *
 * GET /api/browser/chat?sessionId=xxx - Get chat history
 * POST /api/browser/chat - Send message and get AI response
 * DELETE /api/browser/chat?sessionId=xxx - Clear chat history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';
import {
  getOrCreateContext,
  processChatMessage,
  getChatHistory,
  clearChatHistory,
  getQuickActions,
} from '@/lib/browser-chat';

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
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
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

    // Get chat history
    const history = await getChatHistory(sessionId);

    return NextResponse.json({
      success: true,
      messages: history,
      sessionInfo: {
        url: browserSession.url,
        title: browserSession.title,
        chatEnabled: browserSession.chatEnabled,
      },
    });
  } catch (error: any) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to get chat history', message: error.message },
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
      select: { id: true, monthlyCredits: true, creditsUsed: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { sessionId, message, html, url, model, thinkingEnabled } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Session ID and message required' },
        { status: 400 }
      );
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

    // Check if chat is enabled for this session
    if (!browserSession.chatEnabled) {
      return NextResponse.json(
        { error: 'Chat not enabled for this session' },
        { status: 403 }
      );
    }

    // Get or create page context
    const context = await getOrCreateContext(
      sessionId,
      html || '<html><body>No content</body></html>',
      url || browserSession.url
    );

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

    // Process chat message
    const result = await processChatMessage(
      sessionId,
      message,
      context,
      model || 'claude-sonnet-4-5-20250929',
      thinkingEnabled || false
    );

    // Deduct credits from user
    await deductCredits(user.id, result.credits, {
      type: 'browser_chat',
      model: model || 'claude-sonnet-4-5-20250929',
      tokens: result.tokens,
      description: `Chat with webpage: ${context.title}`,
    });

    // Get quick actions for new chats
    const chatHistory = await getChatHistory(sessionId);
    const quickActions = chatHistory.length <= 2 ? getQuickActions(context) : undefined;

    return NextResponse.json({
      success: true,
      message: result.assistantMessage,
      thinking: result.thinkingContent,
      context: {
        url: context.url,
        title: context.title,
        wordCount: context.wordCount,
        summary: context.summary,
      },
      usage: {
        tokens: result.tokens,
        credits: result.credits,
        creditsRemaining: availableCredits - result.credits,
      },
      quickActions,
    });
  } catch (error: any) {
    console.error('Chat message error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', message: error.message },
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
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
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

    // Clear chat history
    await clearChatHistory(sessionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Clear chat error:', error);
    return NextResponse.json(
      { error: 'Failed to clear chat history', message: error.message },
      { status: 500 }
    );
  }
}
