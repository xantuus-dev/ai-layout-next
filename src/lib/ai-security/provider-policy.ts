/**
 * Per-provider data-handling posture (Feature 6: ZDR / no-training).
 *
 * Because the app brings its own provider keys (rather than routing through a
 * gateway), zero-data-retention and no-training are contractual + account-level
 * settings, not something code can enforce on the wire. What code CAN do is
 * record the posture we operate each provider under, so it shows up in the
 * audit log and can back an enterprise "your data is never retained or trained
 * on" claim with a per-request trail.
 *
 * Defaults reflect each provider's standard API terms; override per deployment
 * with env once the corresponding agreement is in place:
 *   AI_ZDR_PROVIDERS="anthropic,openai"   (providers with a signed ZDR contract)
 */

export interface ProviderPolicy {
  /** Provider retains no request/response data beyond the request lifecycle. */
  zeroDataRetention: boolean;
  /** Provider does not train on API data (true under standard API terms). */
  noTraining: boolean;
}

// Standard API terms: Anthropic and OpenAI do not train on API traffic by
// default. Google's terms vary by product/tier, so we do not assume it.
const NO_TRAINING_DEFAULT: Record<string, boolean> = {
  anthropic: true,
  openai: true,
  google: false,
};

function zdrProviders(): Set<string> {
  return new Set(
    (process.env.AI_ZDR_PROVIDERS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getProviderPolicy(providerId: string | undefined): ProviderPolicy {
  const id = (providerId ?? '').toLowerCase();
  return {
    zeroDataRetention: id ? zdrProviders().has(id) : false,
    noTraining: NO_TRAINING_DEFAULT[id] ?? false,
  };
}
