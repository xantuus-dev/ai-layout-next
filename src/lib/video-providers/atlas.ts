/**
 * Atlas Cloud video provider.
 *
 * Atlas resells the same ByteDance Seedance family we already reach through
 * fal, but materially cheaper and with the operational posture the fal and
 * kie.ai routes lack: SOC 2, HIPAA, a public status page, and published data
 * retention terms. It also exposes the whole family — 2.5 down to the far
 * cheaper 2.0 Mini — which is what makes an entry tier affordable at all.
 *
 * Model ids happen to match fal's exactly (`bytedance/seedance-2.5/text-to-video`),
 * so this provider is deliberately kept side by side with seedance.ts rather
 * than replacing it: registering both lets one fail over to the other.
 *
 * Plain fetch rather than an SDK — Atlas publishes no typed client.
 */

import { uploadMedia } from '@/lib/storage';
import {
  assertSupported,
  type VideoGenerationRequest,
  type VideoGenerationResult,
  type VideoProvider,
  type VideoProviderCapabilities,
} from './types';

const BASE_URL = process.env.ATLAS_API_BASE_URL ?? 'https://api.atlascloud.ai/api/v1';
const GENERATE_PATH = '/model/generateVideo';
const PREDICTION_PATH = '/model/prediction';

/**
 * Every Seedance variant Atlas serves, cheapest last. Registered together so a
 * plan tier can pick a model rather than only a resolution — the difference
 * between 2.5 and 2.0 Mini is roughly 3.4x on price, which dwarfs any
 * resolution saving.
 */
export const ATLAS_MODELS = [
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0-fast/text-to-video',
  'bytedance/seedance-2.0-mini/text-to-video',
] as const;

const DEFAULT_MODEL: (typeof ATLAS_MODELS)[number] = 'bytedance/seedance-2.5/text-to-video';

const POLL_INTERVAL_MS = 5_000;
// Same reasoning as the fal and Veo providers: stay under the route's
// maxDuration of 300 so the timeout is ours and carries an actionable message.
const MAX_POLL_MS = 280_000;

/** Atlas accepts 4-30, or -1 to let the model choose. We only offer explicit lengths. */
const DURATIONS_SECONDS = Array.from({ length: 27 }, (_, i) => i + 4);

const CAPABILITIES: VideoProviderCapabilities = {
  // Atlas calls this `ratio`, not `aspect_ratio` — see toRequestBody below.
  aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  resolutions: ['480p', '720p', '1080p'],
  durationsSeconds: DURATIONS_SECONDS,
  typicalRuntimeMs: MAX_POLL_MS,
};

/** Shape of the submit response we depend on: { data: { id } }. */
interface GenerateResponse {
  data?: { id?: string };
  error?: string;
  message?: string;
}

/** Shape of the poll response: { data: { status, outputs[], error } }. */
interface PredictionResponse {
  data?: {
    status?: string;
    outputs?: string[];
    error?: string;
  };
}

/** Atlas reports success under two different spellings. */
const SUCCESS_STATES = new Set(['completed', 'succeeded']);
const FAILURE_STATES = new Set(['failed', 'error', 'canceled', 'cancelled']);

class AtlasVideoService implements VideoProvider {
  readonly id = 'atlas';
  readonly label = 'Atlas Cloud (Seedance)';
  readonly models = ATLAS_MODELS;
  readonly defaultModel = DEFAULT_MODEL;
  readonly capabilities = CAPABILITIES;

  isConfigured(): boolean {
    return !!process.env.ATLASCLOUD_API_KEY;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
    };
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('Atlas Cloud is not configured: set ATLASCLOUD_API_KEY');
    }

    assertSupported(this, request);

    const {
      prompt,
      aspectRatio = '16:9',
      resolution = '720p',
      durationSeconds = 8,
      model = DEFAULT_MODEL,
      userId,
    } = request;

    if (!this.models.includes(model as (typeof ATLAS_MODELS)[number])) {
      throw new Error(
        `Atlas Cloud does not serve the model "${model}". Available: ${this.models.join(', ')}`
      );
    }

    const submit = await fetch(`${BASE_URL}${GENERATE_PATH}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        prompt,
        duration: durationSeconds,
        resolution,
        // Atlas names this `ratio`; fal and kie both call it `aspect_ratio`.
        // Sending the wrong key silently falls back to their 'adaptive'
        // default rather than erroring, so the clip comes back the wrong shape.
        ratio: aspectRatio,
        generate_audio: true,
        watermark: false,
        return_last_frame: false,
        output_format: 'mp4',
      }),
    });

    if (!submit.ok) {
      throw new Error(
        `Atlas Cloud rejected the request (${submit.status}): ${(await submit.text()).slice(0, 300)}`
      );
    }

    const submitted = (await submit.json()) as GenerateResponse;
    const predictionId = submitted.data?.id;
    if (!predictionId) {
      throw new Error(
        `Atlas Cloud returned no prediction id: ${JSON.stringify(submitted).slice(0, 300)}`
      );
    }

    const videoUrl = await this.pollForResult(predictionId);

    // Atlas serves the clip from storage whose lifetime we do not control, so
    // copy it into Blob and hand back our own URL — the same thing the fal and
    // Veo providers do, and the reason a customer's video does not expire.
    const download = await fetch(videoUrl);
    if (!download.ok) {
      throw new Error(`Could not download the generated video from Atlas Cloud: ${download.status}`);
    }

    const { url } = await uploadMedia(Buffer.from(await download.arrayBuffer()), {
      kind: 'video',
      userId: userId || 'anonymous',
      extension: 'mp4',
      contentType: 'video/mp4',
    });

    return { videoUrl: url, prompt, durationSeconds, model };
  }

  private async pollForResult(predictionId: string): Promise<string> {
    const deadline = Date.now() + MAX_POLL_MS;

    for (;;) {
      const response = await fetch(`${BASE_URL}${PREDICTION_PATH}/${predictionId}`, {
        headers: { Authorization: `Bearer ${process.env.ATLASCLOUD_API_KEY}` },
      });

      if (!response.ok) {
        throw new Error(
          `Atlas Cloud status check failed (${response.status}) for prediction ${predictionId}.`
        );
      }

      const body = (await response.json()) as PredictionResponse;
      const status = (body.data?.status ?? '').toLowerCase();

      if (SUCCESS_STATES.has(status)) {
        const output = body.data?.outputs?.[0];
        if (!output) {
          throw new Error(
            `Atlas Cloud reported "${status}" but returned no output for prediction ${predictionId}.`
          );
        }
        return output;
      }

      if (FAILURE_STATES.has(status)) {
        throw new Error(
          body.data?.error || `Atlas Cloud generation failed (prediction ${predictionId}).`
        );
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Atlas Cloud generation timed out after ${Math.round(MAX_POLL_MS / 1000)}s ` +
            `(prediction ${predictionId}, last status "${status || 'unknown'}"). Longer clips need ` +
            'the queued path rather than a synchronous request — try a shorter duration.'
        );
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

export const atlasVideoService = new AtlasVideoService();
