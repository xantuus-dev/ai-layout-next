/**
 * GET /api/audio/voices
 * List ElevenLabs voices available to this account (including cloned voices),
 * so clients/customers can pick a voice before generating audio.
 * Read-only, no credit cost.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { elevenLabsAudioService } from '@/lib/audio-generation';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!elevenLabsAudioService.isConfigured()) {
    return NextResponse.json({ error: 'Audio generation is not configured (ELEVENLABS_API_KEY missing).' }, { status: 503 });
  }

  try {
    const voices = await elevenLabsAudioService.listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error('List voices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list voices' },
      { status: 502 }
    );
  }
}
