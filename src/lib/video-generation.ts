/**
 * Compatibility surface for the old Veo-only module.
 *
 * Veo now lives in ./video-providers/veo alongside the provider interface it
 * implements. This re-export keeps existing importers working; new code should
 * import from '@/lib/video-providers' and resolve a provider through the
 * registry rather than reaching for `veoVideoService` directly, so a second
 * model can be added without touching call sites.
 */

export { veoVideoService, VEO_MODELS } from './video-providers/veo';
export type { VeoAspectRatio, VeoResolution, VeoDurationSeconds } from './video-providers/veo';
