/**
 * Video provider registry.
 *
 * Mirrors src/lib/ai-providers/router.ts, which does the same job for chat
 * models: providers register themselves, callers resolve one by model id, and
 * an unconfigured provider is simply absent rather than a runtime surprise.
 *
 * Adding a provider means implementing {@link VideoProvider} and adding it to
 * PROVIDERS — no call site changes.
 */

import { veoVideoService } from './veo';
import { seedanceVideoService } from './seedance';
import { atlasVideoService } from './atlas';
import type { VideoProvider } from './types';

export * from './types';
export { veoVideoService, VEO_MODELS } from './veo';
export type { VeoAspectRatio, VeoResolution, VeoDurationSeconds } from './veo';
export { seedanceVideoService, SEEDANCE_MODELS } from './seedance';
export { atlasVideoService, ATLAS_MODELS } from './atlas';

/** Registration order is preference order: the first configured one is the default.
 *
 *  Atlas leads because it is the cheapest route to the Seedance family and the
 *  only one with SOC 2 / HIPAA / a public status page. fal stays registered
 *  below it purely as failover — it reaches the same ByteDance models, so it is
 *  a route-around for an Atlas outage rather than genuine model redundancy.
 *  Veo is last: it is the only independent model here, and the dearest.
 *
 *  Reordering this array is the entire switch — no call site knows the order. */
const PROVIDERS: readonly VideoProvider[] = [
  atlasVideoService,
  seedanceVideoService,
  veoVideoService,
];

export function listVideoProviders(): readonly VideoProvider[] {
  return PROVIDERS;
}

export function listConfiguredVideoProviders(): VideoProvider[] {
  return PROVIDERS.filter((provider) => provider.isConfigured());
}

/** True when at least one provider has credentials — i.e. video is available at all. */
export function isVideoGenerationConfigured(): boolean {
  return listConfiguredVideoProviders().length > 0;
}

/** Every model that can actually be run right now, across configured providers. */
export function listVideoModels(): string[] {
  return listConfiguredVideoProviders().flatMap((provider) => [...provider.models]);
}

export function getVideoProviderById(id: string): VideoProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

/**
 * Resolve the provider that owns `model`, or the default provider when no model
 * is given. Returns undefined when the model is unknown or its provider has no
 * credentials, so callers can distinguish "cannot serve this" from a failure
 * mid-generation.
 */
export function getVideoProviderForModel(model?: string): VideoProvider | undefined {
  if (!model) return listConfiguredVideoProviders()[0];
  const owner = PROVIDERS.find((provider) => provider.models.includes(model));
  return owner?.isConfigured() ? owner : undefined;
}

/** The model used when a caller does not name one. */
export function defaultVideoModel(): string | undefined {
  return listConfiguredVideoProviders()[0]?.defaultModel;
}
