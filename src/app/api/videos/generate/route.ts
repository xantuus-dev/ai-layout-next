/**
 * POST /api/videos/generate
 * Generate a video from a text prompt via Google Veo.
 * Requires authentication and sufficient credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVideoForUser } from '@/lib/media/video';
import { failureStatus } from '@/lib/media/types';
import type { VeoAspectRatio, VeoResolution, VeoDurationSeconds } from '@/lib/video-generation';

// Node runtime: uses fs/promises for the Veo file download round-trip.
export const runtime = 'nodejs';
// Veo generation is polled synchronously and can take minutes.
export const maxDuration = 300;

const VALID_ASPECT_RATIOS: VeoAspectRatio[] = ['16:9', '9:16'];
const VALID_RESOLUTIONS: VeoResolution[] = ['720p', '1080p', '4k'];
const VALID_DURATIONS: VeoDurationSeconds[] = ['4', '6', '8'];

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
    const { prompt, aspectRatio = '16:9', resolution = '720p', durationSeconds = '8' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
      return NextResponse.json(
        { error: `aspectRatio must be one of: ${VALID_ASPECT_RATIOS.join(', ')}` },
        { status: 400 }
      );
    }
    if (!VALID_RESOLUTIONS.includes(resolution)) {
      return NextResponse.json(
        { error: `resolution must be one of: ${VALID_RESOLUTIONS.join(', ')}` },
        { status: 400 }
      );
    }
    if (!VALID_DURATIONS.includes(String(durationSeconds) as VeoDurationSeconds)) {
      return NextResponse.json(
        { error: `durationSeconds must be one of: ${VALID_DURATIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await generateVideoForUser({
      userId: user.id,
      prompt,
      aspectRatio,
      resolution,
      durationSeconds: String(durationSeconds) as VeoDurationSeconds,
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

    return NextResponse.json({ success: true, video: result.video }, { status: 201 });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
