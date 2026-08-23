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
import { getVideoProviderForModel } from '@/lib/video-providers';

// Node runtime: uses fs/promises for the Veo file download round-trip.
export const runtime = 'nodejs';
// Veo generation is polled synchronously and can take minutes.
export const maxDuration = 300;

/* Accepted values are per-provider, not global: Veo does 16:9 and 9:16 at
   4/6/8s, Seedance does six aspect ratios at 4-30s. Validation therefore reads
   the resolved provider's declared capabilities instead of one vendor's enum —
   the hardcoded Veo lists that used to live here rejected valid Seedance
   requests before the provider ever saw them. */

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
    const { prompt, aspectRatio = '16:9', resolution = '720p', durationSeconds = '8', model } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Resolve the provider first so an unsupported option is a 400 naming what
    // IS supported, rather than a 502 surfacing later as a provider error.
    const provider = getVideoProviderForModel(model);
    if (!provider) {
      return NextResponse.json(
        {
          error: model
            ? `No configured video provider serves the model "${model}".`
            : 'Video generation is not configured.',
        },
        { status: 503 }
      );
    }

    const { aspectRatios, resolutions, durationsSeconds } = provider.capabilities;

    if (!aspectRatios.includes(aspectRatio)) {
      return NextResponse.json(
        { error: `${provider.label} supports aspect ratios: ${aspectRatios.join(', ')}` },
        { status: 400 }
      );
    }
    if (!resolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `${provider.label} supports resolutions: ${resolutions.join(', ')}` },
        { status: 400 }
      );
    }
    if (!durationsSeconds.includes(Number(durationSeconds))) {
      return NextResponse.json(
        { error: `${provider.label} supports clip lengths (seconds): ${durationsSeconds.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await generateVideoForUser({
      userId: user.id,
      prompt,
      aspectRatio,
      resolution,
      durationSeconds: Number(durationSeconds),
      model,
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
