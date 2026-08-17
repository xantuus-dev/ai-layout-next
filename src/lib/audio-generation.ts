/**
 * ElevenLabs Text-to-Speech Service
 *
 * Called directly over REST (ElevenLabs has no first-party Node SDK dependency
 * in this project) — POST /v1/text-to-speech/{voiceId} returns raw audio
 * bytes, which are uploaded to Blob storage the same way generated images are.
 */

import { uploadMedia } from './storage';

export interface GenerateSpeechParams {
  text: string;
  /** ElevenLabs voice id. Falls back to ELEVENLABS_DEFAULT_VOICE_ID when omitted. */
  voiceId?: string;
  modelId?: string;
  /** Scopes the stored object path. Falls back to 'anonymous' when absent. */
  userId?: string;
}

export interface GenerateSpeechResponse {
  audioUrl: string;
  characterCount: number;
  voiceId: string;
}

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
}

const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 5000;

class ElevenLabsAudioService {
  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  async generateSpeech(params: GenerateSpeechParams): Promise<GenerateSpeechResponse> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs is not configured: set ELEVENLABS_API_KEY');
    }

    const { text, userId } = params;
    const voiceId = params.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    const modelId = params.modelId || DEFAULT_MODEL_ID;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text must be under ${MAX_TEXT_LENGTH} characters per request`);
    }
    if (!voiceId) {
      throw new Error(
        'No voice specified: pass voiceId (see list_voices / GET /api/audio/voices), or set ELEVENLABS_DEFAULT_VOICE_ID'
      );
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: modelId }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} ${errorBody}`.trim());
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { url } = await uploadMedia(buffer, {
      kind: 'audio',
      userId: userId || 'anonymous',
      extension: 'mp3',
      contentType: 'audio/mpeg',
    });

    return { audioUrl: url, characterCount: text.length, voiceId };
  }

  /** Lists voices available to this ElevenLabs account, including any cloned voices. */
  async listVoices(): Promise<ElevenLabsVoice[]> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs is not configured: set ELEVENLABS_API_KEY');
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { voices?: Array<{ voice_id: string; name: string }> };
    return (data.voices || []).map((v) => ({ voiceId: v.voice_id, name: v.name }));
  }
}

export const elevenLabsAudioService = new ElevenLabsAudioService();
