/**
 * POST /api/transcribe
 * Transcribe a short audio clip for voice dictation.
 *
 * Runs through the billing gate like every other billable path, so dictation
 * lands in UsageRecord and inherits the team-pool and audit rules rather than
 * being a metering blind spot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCanSpend, spendCredits, InsufficientCreditsError } from '@/lib/billing/gate';
import { checkAndResetCredits } from '@/lib/credits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  transcribeAudio,
  getTranscriptionCost,
  estimateSecondsFromBytes,
  MAX_UPLOAD_BYTES,
} from '@/lib/transcription';

// Whisper on a 2-minute clip is a few seconds, but a cold start plus a slow
// upload can outrun the default.
export const maxDuration = 60;

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

    const rateLimit = await checkRateLimit(`transcription:${user.id}`, RATE_LIMITS.TRANSCRIPTION);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Too many dictation requests. Please wait a moment.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    await checkAndResetCredits(user.id);

    // The clip is posted as the raw request body rather than multipart: there
    // is only one part, and it avoids the FormData encode/decode round-trip.
    const contentType = request.headers.get('content-type') || 'audio/webm';
    const bytes = await request.arrayBuffer();

    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: 'No audio supplied' }, { status: 400 });
    }

    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Recording is too long. Keep dictation under two minutes.' },
        { status: 413 }
      );
    }

    const audio = new Blob([bytes], { type: contentType });

    // Pre-flight on a deliberately high estimate, so the real charge below —
    // which uses the provider's reported duration — is not refused after we
    // have already paid for the transcription.
    const estimate = getTranscriptionCost(estimateSecondsFromBytes(audio.size));
    const decision = await assertCanSpend(user.id, estimate);

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error:
            decision.reason === 'viewer_cannot_spend'
              ? 'Viewers cannot spend the team credit pool'
              : 'Insufficient credits',
          creditsNeeded: estimate,
          creditsRemaining: Math.max(0, decision.remaining),
        },
        { status: 402 }
      );
    }

    // Whisper infers the container from the extension, so it has to match what
    // the browser actually recorded (Safari sends mp4, not webm).
    const extension = (request.nextUrl.searchParams.get('ext') || 'webm').replace(
      /[^a-z0-9]/gi,
      ''
    );
    const filename = `dictation.${extension || 'webm'}`;

    let result;
    try {
      result = await transcribeAudio(audio, filename);
    } catch (error) {
      console.error('Transcription failed:', error);
      return NextResponse.json(
        { error: 'Could not transcribe that recording. Please try again.' },
        { status: 502 }
      );
    }

    // Billed on the provider's duration, never the client's claim.
    const credits = getTranscriptionCost(result.duration);

    try {
      await spendCredits(user.id, credits, {
        type: 'transcription',
        model: 'whisper-1',
        description: `Voice dictation (${Math.round(result.duration)}s)`,
        extra: { durationSeconds: result.duration, language: result.language },
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: 'Insufficient credits', creditsNeeded: credits },
          { status: 402 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      text: result.text,
      durationSeconds: result.duration,
      creditsUsed: credits,
    });
  } catch (error) {
    console.error('Transcription route error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
