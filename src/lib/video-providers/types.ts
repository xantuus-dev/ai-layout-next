/**
 * Shared vocabulary for text-to-video providers.
 *
 * Video generation was written directly against Google Veo, whose limits (two
 * aspect ratios, three resolutions, 4/6/8-second clips) ended up baked into the
 * call sites as types. Models differ enough on all three axes — Seedance 2.5
 * generates up to 30 seconds in one pass, for instance — that the shape has to
 * come from the provider rather than from one vendor's enum.
 *
 * Each provider therefore declares what it accepts via {@link VideoProviderCapabilities}
 * and validates against its own declaration, so an unsupported request fails
 * here with a readable message instead of as a vendor API error.
 */

/** What one provider will accept. Values are provider vocabulary, not a shared enum. */
export interface VideoProviderCapabilities {
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  /** Exact clip lengths the provider accepts, in seconds. */
  durationsSeconds: readonly number[];
  /**
   * Roughly how long a generation runs, worst case. Callers use this to decide
   * between awaiting a request inline and handing it to a queue — anything
   * approaching a serverless function's ceiling cannot be awaited in a route.
   */
  typicalRuntimeMs: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  /**
   * Clip length in seconds. Numeric rather than a string union because the
   * accepted set is per-provider; callers holding the old string form should
   * pass `Number(value)`.
   */
  durationSeconds?: number;
  /** A specific model within the provider. Defaults to the provider's own. */
  model?: string;
  /** Scopes the stored object path. Falls back to 'anonymous' when absent. */
  userId?: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  prompt: string;
  durationSeconds: number;
  /** The model that actually produced the clip, for the GeneratedVideo row. */
  model: string;
}

export interface VideoProvider {
  /** Stable key used in config and logs, e.g. 'veo'. */
  readonly id: string;
  /** Human-readable name for UI and error messages. */
  readonly label: string;
  readonly models: readonly string[];
  readonly defaultModel: string;
  readonly capabilities: VideoProviderCapabilities;
  /** False when the provider's credentials are absent. */
  isConfigured(): boolean;
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

/**
 * Reject a request a provider cannot serve, naming what it does support.
 * Providers call this before spending a network round-trip on a certain error.
 */
export function assertSupported(
  provider: Pick<VideoProvider, 'label' | 'capabilities'>,
  request: VideoGenerationRequest
): void {
  const { aspectRatios, resolutions, durationsSeconds } = provider.capabilities;

  if (request.aspectRatio && !aspectRatios.includes(request.aspectRatio)) {
    throw new Error(
      `${provider.label} does not support aspect ratio ${request.aspectRatio}. Supported: ${aspectRatios.join(', ')}.`
    );
  }
  if (request.resolution && !resolutions.includes(request.resolution)) {
    throw new Error(
      `${provider.label} does not support resolution ${request.resolution}. Supported: ${resolutions.join(', ')}.`
    );
  }
  if (request.durationSeconds !== undefined && !durationsSeconds.includes(request.durationSeconds)) {
    throw new Error(
      `${provider.label} does not support ${request.durationSeconds}s clips. Supported: ${durationsSeconds.join(', ')}.`
    );
  }
}
