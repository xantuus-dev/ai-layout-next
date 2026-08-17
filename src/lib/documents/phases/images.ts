/**
 * Image Phase — for every outline item flagged needsImage, generates a
 * supporting illustration via image.generate. Degrades gracefully (section
 * simply has no image) when generation is unavailable or fails, since images
 * are a nice-to-have, not structurally required.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, ImageAsset } from '../types';
import { callTool } from '../phase-utils';
import { buildImagePromptFromSection } from '../prompts';

export async function runImagePhase(
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const traces: ExecutionTrace[] = [];
  let step = startStepNumber;
  const images: ImageAsset[] = [];
  const sections = spec.sections.map((s) => ({ ...s, imageIds: [...(s.imageIds || [])] }));

  for (const item of spec.outline) {
    if (!item.needsImage) continue;
    const section = sections.find((s) => s.id === item.id);
    if (!section) continue;

    const genCall = await callTool(context, {
      stepNumber: step++,
      action: 'images.generate',
      toolName: 'image.generate',
      params: { prompt: buildImagePromptFromSection(spec.goal, item) },
    });
    traces.push(genCall.trace);

    if (genCall.result.success) {
      const imageId = `image${images.length + 1}`;
      images.push({
        id: imageId,
        purpose: `Illustration for "${item.heading}"`,
        url: genCall.result.data.url,
        source: 'generated',
        altText: item.heading,
      });
      section.imageIds!.push(imageId);
    }
  }

  return { spec: { ...spec, sections, images }, traces };
}
