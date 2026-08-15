/**
 * Voice dictation — cost model and transcription call.
 *
 * Audio is billed by duration, not tokens, so it does not fit
 * `creditsPerThousandTokens` in the model catalog. The rate below is derived to
 * sit on the same credit scale as every other model rather than inventing one:
 *
 *   catalog: Haiku  1 credit / 1K tokens @ $1/1M   -> 1000 tokens = $0.001
 *            Sonnet 3 credits / 1K tokens @ $3/1M  -> 1000 tokens = $0.003
 *            Opus  15 credits / 1K tokens @ $15/1M -> 1000 tokens = $0.015
 *
 * so 1 credit ~= $0.001 of provider cost across the catalog. whisper-1 is
 * $0.006/minute, which puts a minute of dictation at 6 credits. Margin comes
 * from the price of a credit (see pricing-config), not from marking up the rate
 * here — same as every other model.
 */

import OpenAI from 'openai';
import { toFile } from 'openai';

/** whisper-1 at $0.006/min against a credit worth ~$0.001 of provider cost. */
export const TRANSCRIPTION_CREDITS_PER_MINUTE = 6;

/**
 * Longest clip accepted. Dictation is speak-a-paragraph, not record-a-meeting,
 * and a cap keeps every upload well inside the request body limit on Vercel
 * Functions without needing a Blob round-trip.
 */
export const MAX_CLIP_SECONDS = 120;

/**
 * Hard ceiling on the upload. 2 minutes of Opus at the 32 kbps the recorder
 * requests is ~480 KB; 4 MB leaves generous room for browsers that ignore the
 * bitrate hint (Safari records AAC) while staying under the platform limit.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Credits for a clip of `seconds`, always at least 1.
 *
 * Charged on the real duration reported by the provider rather than rounded up
 * to a whole minute — a 10-second correction should not cost the same as a
 * full minute of dictation.
 */
export function getTranscriptionCost(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil((seconds / 60) * TRANSCRIPTION_CREDITS_PER_MINUTE));
}

/**
 * Duration guess from upload size, for the pre-flight gate only.
 *
 * Deliberately assumes a low bitrate (~16 kbps) so the estimate errs high: the
 * gate reserves at least what the real charge will be, so a spend that passes
 * pre-flight is not then rejected after we have already paid the provider.
 * Never used for billing — that uses the duration the provider reports.
 */
export function estimateSecondsFromBytes(bytes: number): number {
  const BYTES_PER_SECOND_CONSERVATIVE = 2000;
  return Math.min(MAX_CLIP_SECONDS, bytes / BYTES_PER_SECOND_CONSERVATIVE);
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface TranscriptionResult {
  text: string;
  /** Seconds of audio, as reported by the provider. Authoritative for billing. */
  duration: number;
  language: string;
}

/**
 * Transcribe an audio clip.
 *
 * Uses whisper-1 with verbose_json specifically because that combination
 * returns `duration`. The gpt-4o-transcribe models only support `json`, which
 * omits it, leaving nothing trustworthy to bill against — the client's claimed
 * duration is not acceptable for that.
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string
): Promise<TranscriptionResult> {
  const file = await toFile(audio, filename, { type: audio.type || 'audio/webm' });

  const result = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
  });

  return {
    text: result.text.trim(),
    duration: result.duration,
    language: result.language,
  };
}
