/**
 * Shared result shape for the media generation functions in this directory.
 *
 * Each generator (image/video/audio) is called from two places — a
 * session-authenticated HTTP route and an API-key-authenticated MCP tool —
 * so the credit/rate-limit/generation logic lives once here and each caller
 * translates the result into its own response format instead of duplicating
 * the gating logic.
 */

export type MediaGenerationFailureReason =
  | 'rate_limited'
  | 'insufficient_credits'
  | 'viewer_cannot_spend'
  | 'invalid_input'
  | 'provider_error'
  | 'not_configured';

export interface MediaGenerationFailure {
  ok: false;
  reason: MediaGenerationFailureReason;
  message: string;
  creditsNeeded?: number;
  creditsAvailable?: number;
  /** Seconds until the rate limit window resets. Only set for 'rate_limited'. */
  retryAfterSeconds?: number;
}

/** Maps a failure reason to the HTTP status an API route should return for it. */
export function failureStatus(reason: MediaGenerationFailureReason): number {
  switch (reason) {
    case 'rate_limited':
      return 429;
    case 'insufficient_credits':
    case 'viewer_cannot_spend':
      return 402;
    case 'invalid_input':
      return 400;
    case 'not_configured':
      return 503;
    case 'provider_error':
      return 502;
  }
}
