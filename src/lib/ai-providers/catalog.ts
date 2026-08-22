/**
 * Single source of truth for the Anthropic model catalog.
 *
 * This module deliberately imports no SDK, so the client-side model picker can
 * read it directly instead of keeping its own hardcoded copy. Three separate
 * lists (provider catalog, chat-input picker, credits map) had already drifted
 * apart — that drift is how a model id that returns 404 stayed shipped.
 */

import { AIModel } from './types';

/** Model used when a caller or stored conversation does not specify one. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

export const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'anthropic',
    description: 'Most capable for complex work',
    creditsPerThousandTokens: 5,
    inputCostPer1M: 5,
    outputCostPer1M: 25,
    contextWindow: 1000000,
    capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
    badge: 'Premium',
    thinkingStyle: 'adaptive',
    supportsSampling: false,
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    description: 'Best for everyday tasks',
    creditsPerThousandTokens: 3,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    contextWindow: 1000000,
    capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
    thinkingStyle: 'adaptive',
    supportsSampling: false,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    // Was shipped as 'claude-haiku-4-5-20250529', which is not a real model
    // ID — the API returned 404, so selecting Haiku always failed. Pricing
    // here was also understated 4x ($0.25/$1.25), which would have under-billed
    // credits the moment the ID started resolving.
    description: 'Fastest for quick answers',
    creditsPerThousandTokens: 1,
    inputCostPer1M: 1,
    outputCostPer1M: 5,
    contextWindow: 200000,
    capabilities: ['vision', 'function-calling'],
    badge: 'Fastest',
    thinkingStyle: 'budget',
  },

  // Superseded, but kept selectable: conversations and messages persist the
  // model id they were created with, so removing these would break history.
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    description: 'Previous generation, kept for existing conversations',
    creditsPerThousandTokens: 15,
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    contextWindow: 200000,
    capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
    thinkingStyle: 'budget',
    legacy: true,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Previous generation, kept for existing conversations',
    creditsPerThousandTokens: 3,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    contextWindow: 1000000,
    capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
    thinkingStyle: 'budget',
    legacy: true,
  },
];
