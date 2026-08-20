/**
 * Google Veo video provider.
 *
 * Uses the @google/genai SDK (not @google/generative-ai, which does not
 * expose Veo). Generation is a long-running operation: the SDK returns an
 * operation handle immediately and the caller polls it until `done`.
 */

import { GoogleGenAI } from '@google/genai';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { uploadMedia } from '@/lib/storage';
import {
  assertSupported,
  type VideoGenerationRequest,
  type VideoGenerationResult,
  type VideoProvider,
  type VideoProviderCapabilities,
} from './types';

export type VeoAspectRatio = '16:9' | '9:16';
export type VeoResolution = '720p' | '1080p' | '4k';
export type VeoDurationSeconds = '4' | '6' | '8';

export const VEO_MODELS = [
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.1-lite-generate-preview',
] as const;

const DEFAULT_MODEL = 'veo-3.1-generate-preview';
const POLL_INTERVAL_MS = 10_000;
// Kept under the route's maxDuration so a timeout error is thrown from here
// (with an actionable message) rather than the platform killing the function
// mid-poll with a generic 504.
const MAX_POLL_MS = 280_000;

const CAPABILITIES: VideoProviderCapabilities = {
  aspectRatios: ['16:9', '9:16'],
  resolutions: ['720p', '1080p', '4k'],
  durationsSeconds: [4, 6, 8],
  typicalRuntimeMs: MAX_POLL_MS,
};

class VeoVideoService implements VideoProvider {
  readonly id = 'veo';
  readonly label = 'Google Veo';
  readonly models = VEO_MODELS;
  readonly defaultModel = DEFAULT_MODEL;
  readonly capabilities = CAPABILITIES;

  private client: GoogleGenAI | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    }
  }

  isConfigured(): boolean {
    return !!process.env.GOOGLE_AI_API_KEY;
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.client) {
      throw new Error('Veo is not configured: set GOOGLE_AI_API_KEY');
    }

    const {
      prompt,
      aspectRatio = '16:9',
      resolution = '720p',
      durationSeconds = 8,
      model = DEFAULT_MODEL,
      userId,
    } = request;

    if (!prompt || prompt.trim().length < 10) {
      throw new Error('Prompt must be at least 10 characters long');
    }
    if (prompt.trim().length > 2000) {
      throw new Error('Prompt must be less than 2000 characters');
    }
    assertSupported(this, { prompt, aspectRatio, resolution, durationSeconds });

    let operation = await this.client.models.generateVideos({
      model,
      prompt,
      // The SDK's config type wants a number here even though the REST API
      // (and Google's own sample code) documents it as a string enum.
      config: {
        aspectRatio: aspectRatio as VeoAspectRatio,
        resolution: resolution as VeoResolution,
        durationSeconds,
      },
    });

    const deadline = Date.now() + MAX_POLL_MS;
    while (!operation.done) {
      if (Date.now() > deadline) {
        throw new Error(
          'Video generation timed out. Veo can take several minutes, especially at higher ' +
            'resolutions or durations — try a shorter clip or lower resolution.'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      operation = await this.client.operations.getVideosOperation({ operation });
    }

    const generated = operation.response?.generatedVideos?.[0];
    if (!generated?.video) {
      throw new Error('Veo returned no video in the completed operation.');
    }

    // The SDK's file download writes to disk rather than returning bytes
    // directly, so round-trip through Vercel's writable /tmp before handing
    // the buffer to Blob storage.
    const tmpPath = join(tmpdir(), `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
    try {
      await this.client.files.download({ file: generated.video, downloadPath: tmpPath });
      const buffer = await readFile(tmpPath);
      const { url } = await uploadMedia(buffer, {
        kind: 'video',
        userId: userId || 'anonymous',
        extension: 'mp4',
        contentType: 'video/mp4',
      });
      return { videoUrl: url, prompt, durationSeconds, model };
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }
}

export const veoVideoService = new VeoVideoService();
