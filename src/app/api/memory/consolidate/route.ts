/**
 * Memory Consolidation API Route
 *
 * POST /api/memory/consolidate
 * Trigger memory consolidation to extract facts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getMemoryConsolidator } from '@/lib/memory/client';

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
    const {
      updateMemoryFile = true,
      minConfidence = 0.6,
      deduplicateFacts = true,
    } = body;

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

    // Run consolidation
    const memoryConsolidator = getMemoryConsolidator();
    const result = await memoryConsolidator.consolidate({
      userId: userIdNum,
      updateMemoryFile,
      minConfidence,
      deduplicateFacts,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      factsExtracted: result.factsExtracted,
      factsStored: result.factsStored,
      factsMerged: result.factsMerged,
      chunksProcessed: result.chunksProcessed,
      totalChunks: result.totalChunks,
      duration: result.duration,
      memoryFileUpdated: result.memoryFileUpdated,
    });

  } catch (error) {
    console.error('Memory consolidation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to consolidate memory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
