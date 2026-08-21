/**
 * POST /api/audio/music
 * Compose a music track from a text prompt via ElevenLabs Music.
 * Requires authentication and sufficient credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateMusicForUser } from '@/lib/media/music';
import { failureStatus } from '@/lib/media/types';

export const runtime = 'nodejs';

// Composition runs to the length of the requested track and then some; the
// default function timeout will cut off anything past a short clip.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { prompt, lengthMs, modelId, instrumental } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const result = await generateMusicForUser({
      userId: user.id,
      prompt,
      lengthMs,
      modelId,
      instrumental,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          creditsNeeded: result.creditsNeeded,
          creditsAvailable: result.creditsAvailable,
          retryAfter: result.retryAfterSeconds,
        },
        { status: failureStatus(result.reason) }
      );
    }

    return NextResponse.json({ success: true, music: result.music }, { status: 201 });
  } catch (error) {
    console.error('Music generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
