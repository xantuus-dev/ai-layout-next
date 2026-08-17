/**
 * Drafting Phase — writes prose content for every outline item, threading in
 * inline [cN] citation markers where the model has a relevant source.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, DocumentSection } from '../types';
import { callModel } from '../phase-utils';
import { buildSectionDraftPrompt } from '../prompts';

export async function runDraftingPhase(
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const traces: ExecutionTrace[] = [];
  let step = startStepNumber;
  const sections: DocumentSection[] = [];

  for (const item of spec.outline) {
    const draftCall = await callModel(context, {
      stepNumber: step++,
      action: 'drafting.writeSection',
      prompt: buildSectionDraftPrompt(spec.goal, item, spec.citations),
      maxTokens: 900,
    });
    traces.push(draftCall.trace);

    sections.push({
      id: item.id,
      heading: item.heading,
      level: item.level,
      content: draftCall.content.trim() || `(Content generation failed for "${item.heading}".)`,
      chartIds: [],
      tableIds: [],
      imageIds: [],
    });
  }

  return { spec: { ...spec, sections }, traces };
}
