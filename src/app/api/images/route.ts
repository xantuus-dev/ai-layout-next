/**
 * GET /api/images
 * List user's generated images with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'recent'; // 'recent' or 'oldest'
    const search = searchParams.get('search')?.trim(); // Search prompt
    const minWidth = searchParams.get('minWidth');
    const minHeight = searchParams.get('minHeight');

    // 4. Validate pagination params
    if (limit < 1 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // 5. Build sort order
    const orderBy =
      sortBy === 'oldest'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

    // 6. Build where clause with filters
    let where: any = { userId: user.id };

    if (search) {
      where.prompt = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (minWidth) {
      where.width = {
        gte: parseInt(minWidth),
      };
    }

    if (minHeight) {
      where.height = {
        gte: parseInt(minHeight),
      };
    }

    // 7. Fetch total count
    const total = await prisma.generatedImage.count({
      where,
    });

    // 8. Fetch paginated results
    const images = await prisma.generatedImage.findMany({
      where,
      select: {
        id: true,
        prompt: true,
        imageUrl: true,
        width: true,
        height: true,
        creditsUsed: true,
        model: true,
        createdAt: true,
      },
      orderBy,
      take: limit,
      skip: offset,
    });

    // 9. Return response
    return NextResponse.json(
      {
        success: true,
        images,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
