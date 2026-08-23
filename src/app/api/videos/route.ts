/**
 * List the signed-in user's generated videos.
 *
 * Mirrors the pagination contract of /api/images so the two media galleries
 * behave identically: { videos, pagination: { limit, offset, total, hasMore } }.
 *
 * Scoped to the caller's own rows — GeneratedVideo has no sharing model, so
 * userId is a hard filter rather than a default.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/* Per-user data behind a session — must never be statically rendered or cached.
   Without this Next tries to prerender the route at build time, the session
   lookup touches `headers()`, and the catch below reports it as a fetch error. */
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!Number.isFinite(limit) || !Number.isFinite(offset) || limit < 1 || offset < 0) {
      return NextResponse.json(
        { error: 'limit must be >= 1 and offset must be >= 0' },
        { status: 400 }
      );
    }

    const where = { userId: user.id };

    const [total, videos] = await Promise.all([
      prisma.generatedVideo.count({ where }),
      prisma.generatedVideo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          videoUrl: true,
          prompt: true,
          aspectRatio: true,
          resolution: true,
          durationSeconds: true,
          creditsUsed: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      videos,
      pagination: { limit, offset, total, hasMore: offset + videos.length < total },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
