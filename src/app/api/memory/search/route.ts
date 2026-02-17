/**
 * Memory Search API Route
 *
 * POST /api/memory/search
 * Search user's memory with semantic + full-text hybrid search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getMemoryService } from '@/lib/memory/client';

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
    const { query, maxResults = 6, minScore = 0.35, sources } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Get user ID from session
    // Note: This assumes userId is stored in session.user.id
    // Adjust based on your NextAuth configuration
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      );
    }

    // Convert string userId to number for memory system
    // TODO: Update memory system to use string IDs
    const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;

    // Search memory
    const memoryService = getMemoryService();
    const results = await memoryService.searchMemory(userIdNum, query, {
      maxResults,
      minScore,
      sources,
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('Memory search error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search memory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
