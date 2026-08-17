/**
 * POST /api/audio/generate
 * Generate speech audio from text via ElevenLabs.
 * Requires authentication and sufficient credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAudioForUser } from '@/lib/media/audio';
import { failureStatus } from '@/lib/media/types';

export const runtime = 'nodejs';

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
    const { text, voiceId, modelId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const result = await generateAudioForUser({ userId: user.id, text, voiceId, modelId });

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

    return NextResponse.json({ success: true, audio: result.audio }, { status: 201 });
  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
