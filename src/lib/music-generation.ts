/**
 * ElevenLabs Music Service
 *
 * Sibling of audio-generation.ts, deliberately kept separate rather than folded
 * into ElevenLabsAudioService: text-to-speech and music composition share a
 * vendor and an API key but nothing else. Speech is billed per character and
 * keyed on a voice; music is billed per second of output and has no voice at
 * all. Merging them would mean a params type where half the fields are wrong
 * for whichever call you are making.
 *
 * POST /v1/music returns raw audio bytes (not JSON), same as the speech
 * endpoint, so the response is uploaded to Blob exactly the way generated
 * speech and images are.
 */

import { uploadMedia } from './storage';

/** The API accepts 3s–600s; anything outside is rejected by the provider. */
export const MIN_MUSIC_LENGTH_MS = 3_000;
export const MAX_MUSIC_LENGTH_MS = 600_000;

/**
 * Used when the caller does not specify a length.
 *
 * The provider will happily choose a duration itself when `music_length_ms` is
 * omitted, but we always send one: the credit cost is a function of duration,
 * so letting the model pick would mean quoting the user a price before knowing
 * what they will be charged. A fixed default keeps the pre-flight estimate and
 * the actual charge the same number.
 */
export const DEFAULT_MUSIC_LENGTH_MS = 30_000;

export type MusicModelId = 'music_v1' | 'music_v2';

const DEFAULT_MODEL_ID: MusicModelId = 'music_v2';
const MAX_PROMPT_LENGTH = 2000;

export interface ComposeMusicParams {
  /** Free-text description of the track: genre, mood, instrumentation, tempo. */
  prompt: string;
  /** Clamped to [MIN_MUSIC_LENGTH_MS, MAX_MUSIC_LENGTH_MS]. */
  lengthMs?: number;
  modelId?: MusicModelId;
  /** True to compose without vocals. */
  instrumental?: boolean;
  /** Scopes the stored object path. Falls back to 'anonymous' when absent. */
  userId?: string;
}

export interface ComposeMusicResponse {
  audioUrl: string;
  lengthMs: number;
  modelId: MusicModelId;
  instrumental: boolean;
}

/**
 * Clamp rather than reject an out-of-range duration.
 *
 * Callers include the agent executor, where the duration is chosen by a model
 * filling in tool parameters. Failing the whole run because a model asked for
 * 900 seconds is worse for the user than composing the 600 it can actually
 * have — and the returned lengthMs tells the caller what was really produced.
 * Exported for testing.
 */
export function clampMusicLength(lengthMs: number | undefined): number {
  if (typeof lengthMs !== 'number' || !Number.isFinite(lengthMs)) {
    return DEFAULT_MUSIC_LENGTH_MS;
  }
  return Math.min(MAX_MUSIC_LENGTH_MS, Math.max(MIN_MUSIC_LENGTH_MS, Math.round(lengthMs)));
}

class ElevenLabsMusicService {
  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  async composeMusic(params: ComposeMusicParams): Promise<ComposeMusicResponse> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('Music generation is not configured: set ELEVENLABS_API_KEY');
    }

    const { prompt, userId } = params;
    const modelId = params.modelId || DEFAULT_MODEL_ID;
    const instrumental = params.instrumental ?? false;
    const lengthMs = clampMusicLength(params.lengthMs);

    if (!prompt || prompt.trim().length === 0) {
      throw new Error('A prompt describing the music is required');
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`Prompt must be under ${MAX_PROMPT_LENGTH} characters`);
    }

    const response = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: lengthMs,
        model_id: modelId,
        force_instrumental: instrumental,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `ElevenLabs Music API error: ${response.status} ${response.statusText} ${errorBody}`.trim()
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { url } = await uploadMedia(buffer, {
      kind: 'audio',
      userId: userId || 'anonymous',
      extension: 'mp3',
      contentType: 'audio/mpeg',
    });

    return { audioUrl: url, lengthMs, modelId, instrumental };
  }
}

export const elevenLabsMusicService = new ElevenLabsMusicService();
