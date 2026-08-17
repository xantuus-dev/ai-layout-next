/**
 * Image Generation Tool
 *
 * Thin AgentTool wrapper around the existing generateImageForUser() (Gemini
 * image generation, src/lib/media/image.ts) — reused as-is rather than
 * reimplemented, since it already handles rate limiting and credit
 * spend/gating end to end.
 *
 * Because generateImageForUser() deducts real credits itself via
 * spendCredits(), this tool reports 0 credits back through the AgentTool
 * interface (estimateCost + ToolResult.metadata.credits) — otherwise
 * AgentExecutor would deduct a second time on top of the spend that already
 * happened inside generateImageForUser().
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { generateImageForUser } from '@/lib/media/image';

export class ImageGenerateTool implements AgentTool {
  name = 'image.generate';
  description =
    'Generate an image from a text prompt and return a URL. Use for supporting images, ' +
    'hero images, and illustrations to embed in documents, decks, and reports. Not for ' +
    'charts or graphs of data — use chart.render for those.';
  category = 'utility' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      prompt: { type: 'string', description: 'Description of the image to generate' },
      width: { type: 'number', description: 'Image width in pixels (default 1024)' },
      height: { type: 'number', description: 'Image height in pixels (default 1024)' },
    },
    required: ['prompt'],
  };

  validate(params: any): { valid: boolean; error?: string } {
    if (!params?.prompt || typeof params.prompt !== 'string') {
      return { valid: false, error: 'prompt parameter required (string)' };
    }
    if (params.prompt.length > 2000) {
      return { valid: false, error: 'prompt exceeds 2000 characters' };
    }
    return { valid: true };
  }

  /** Real cost is spent internally by generateImageForUser(); reported as 0 here to avoid double-charging. */
  estimateCost(): number {
    return 0;
  }

  async execute(
    params: { prompt: string; width?: number; height?: number },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    const result = await generateImageForUser({
      userId: context.userId,
      prompt: params.prompt,
      width: params.width,
      height: params.height,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.message,
        metadata: { duration: Date.now() - startTime, credits: 0 },
      };
    }

    return {
      success: true,
      data: {
        url: result.image.imageUrl,
        width: result.image.width,
        height: result.image.height,
        prompt: result.image.prompt,
      },
      metadata: { duration: Date.now() - startTime, credits: 0 },
    };
  }
}
