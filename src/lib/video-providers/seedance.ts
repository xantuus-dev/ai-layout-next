/**
 * ByteDance Seedance 2.5 video provider, via fal.
 *
 * Seedance generates up to 30 seconds in a single pass with audio co-generated
 * in the same latent space, rather than dubbed on afterwards. fal is the access
 * route here because it publishes a typed client and a queue API; the model is
 * also on Replicate and first-party on BytePlus ModelArk.
 *
 * IMPORTANT — the long durations are not reachable through a serverless request.
 * A 30-second generation runs well past Vercel's 300s function ceiling, so this
 * provider polls against its own deadline and fails with an actionable message
 * rather than being killed mid-poll. Making full-length clips usable needs the
 * queued/webhook path (fal accepts a `webhookUrl` on submit), which is separate
 * work; until then only short clips complete inline.
 */

import { fal } from '@fal-ai/client';
import { uploadMedia } from '@/lib/storage';
import {
  assertSupported,
  type VideoGenerationRequest,
  type VideoGenerationResult,
  type VideoProvider,
  type VideoProviderCapabilities,
} from './types';

/**
 * fal exposes one endpoint per workflow family. Only text-to-video is wired up;
 * image-to-video, first-last-frame, omni-reference, video-edit and video-extend
 * are siblings under the same prefix and need extra request fields to be useful.
 */
const TEXT_TO_VIDEO_ENDPOINT = 'bytedance/seedance-2.5/text-to-video';

export const SEEDANCE_MODELS = ['seedance-2.5'] as const;

const DEFAULT_MODEL = 'seedance-2.5';
const POLL_INTERVAL_MS = 5_000;
// Same reasoning as the Veo provider: stay under the route's maxDuration so the
// error comes from here with something the caller can act on.
const MAX_POLL_MS = 280_000;

/** 4 through 30 inclusive — fal takes the duration as a string enum. */
const DURATIONS_SECONDS = Array.from({ length: 27 }, (_, i) => i + 4);

const CAPABILITIES: VideoProviderCapabilities = {
  aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  // 4K exists as an upscale endpoint rather than a native option here.
  resolutions: ['480p', '720p', '1080p'],
  durationsSeconds: DURATIONS_SECONDS,
  typicalRuntimeMs: MAX_POLL_MS,
};

/** The subset of fal's output this provider reads. */
interface SeedanceOutput {
  video?: { url?: string };
}

class SeedanceVideoService implements VideoProvider {
  readonly id = 'seedance';
  readonly label = 'ByteDance Seedance 2.5';
  readonly models = SEEDANCE_MODELS;
  readonly defaultModel = DEFAULT_MODEL;
  readonly capabilities = CAPABILITIES;

  isConfigured(): boolean {
    return !!process.env.FAL_KEY;
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('Seedance is not configured: set FAL_KEY');
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

    // The client reads FAL_KEY on its own, but only from its own module-level
    // lookup; configuring explicitly keeps it working when the value is loaded
    // after import (as it is under --env-file and in tests).
    fal.config({ credentials: process.env.FAL_KEY });

    const { request_id: requestId } = await fal.queue.submit(TEXT_TO_VIDEO_ENDPOINT, {
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution,
        // fal takes duration as a string enum ('auto' or '4'..'30').
        duration: String(durationSeconds),
        generate_audio: true,
        // Scopes fal-side abuse controls per end user rather than per key.
        ...(userId ? { end_user_id: userId } : {}),
      },
    });

    const deadline = Date.now() + MAX_POLL_MS;
    for (;;) {
      const status = await fal.queue.status(TEXT_TO_VIDEO_ENDPOINT, { requestId });
      if (status.status === 'COMPLETED') break;

      if (Date.now() > deadline) {
        throw new Error(
          `Seedance generation timed out after ${Math.round(MAX_POLL_MS / 1000)}s (fal request ${requestId}). ` +
            'Longer clips need the queued path rather than a synchronous request — try a shorter duration.'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const result = await fal.queue.result(TEXT_TO_VIDEO_ENDPOINT, { requestId });
    const videoUrl = (result.data as SeedanceOutput)?.video?.url;
    if (!videoUrl) {
      throw new Error(`Seedance returned no video URL (fal request ${requestId}).`);
    }

    // fal serves the clip from its own CDN on a URL we do not control the
    // lifetime of, so copy it into Blob the way the Veo provider does and store
    // that instead.
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Could not download the generated video from fal: ${response.status}`);
    }
    const { url } = await uploadMedia(Buffer.from(await response.arrayBuffer()), {
      kind: 'video',
      userId: userId || 'anonymous',
      extension: 'mp4',
      contentType: 'video/mp4',
    });

    return { videoUrl: url, prompt, durationSeconds, model };
  }
}

export const seedanceVideoService = new SeedanceVideoService();
