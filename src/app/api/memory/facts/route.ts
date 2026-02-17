/**
 * Memory Facts API Route
 *
 * GET /api/memory/facts - Get facts by type
 * POST /api/memory/facts - Search facts semantically
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getMemoryConsolidator } from '@/lib/memory/client';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const minImportance = parseFloat(searchParams.get('minImportance') || '0');

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

    // Get facts
    const memoryConsolidator = getMemoryConsolidator();
    const facts = await memoryConsolidator.getFacts(userIdNum, {
      type,
      limit,
      minImportance,
    });

    return NextResponse.json({
      success: true,
      facts,
      count: facts.length,
    });

  } catch (error) {
    console.error('Get facts error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get facts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

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
    const { query, limit = 10, minScore = 0.5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
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

    // Search facts
    const memoryConsolidator = getMemoryConsolidator();
    const facts = await memoryConsolidator.searchFacts(userIdNum, query, {
      limit,
      minScore,
    });

    return NextResponse.json({
      success: true,
      query,
      facts,
      count: facts.length,
    });

  } catch (error) {
    console.error('Search facts error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search facts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
