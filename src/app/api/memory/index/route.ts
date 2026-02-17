/**
 * Memory Index API Route
 *
 * POST /api/memory/index
 * Index a conversation into memory system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getConversationIndexer } from '@/lib/memory/client';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sessionId, messages, metadata } = body;

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'sessionId and messages array are required' },
        { status: 400 }
      );
    }

    // Get user ID from session
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      );
    }

    // Convert string userId to number for memory system
    const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;

    // Index conversation
    const conversationIndexer = getConversationIndexer();
    const result = await conversationIndexer.indexConversation({
      sessionId,
      userId: userIdNum,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })),
      endedAt: new Date(),
      metadata,
    });

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      filePath: result.filePath,
      messageCount: result.messageCount,
      chunksCreated: result.chunksCreated,
      consolidationTriggered: result.consolidationTriggered,
      alreadyIndexed: result.alreadyIndexed,
    });

  } catch (error) {
    console.error('Memory indexing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to index conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
