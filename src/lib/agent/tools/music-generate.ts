/**
 * Music Generation Tool
 *
 * Thin AgentTool wrapper around generateMusicForUser() (ElevenLabs Music,
 * src/lib/media/music.ts), following the same arrangement as
 * ImageGenerateTool: the media-layer function already owns rate limiting and
 * credit spend/gating, so it is reused rather than reimplemented.
 *
 * As with image generation, the real credit spend happens inside
 * generateMusicForUser() via spendCredits(), so this tool reports 0 credits
 * through the AgentTool interface. Reporting the true cost here would make
 * AgentExecutor deduct a second time on top of the spend that already
 * happened.
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { generateMusicForUser } from '@/lib/media/music';
import {
  MIN_MUSIC_LENGTH_MS,
  MAX_MUSIC_LENGTH_MS,
  DEFAULT_MUSIC_LENGTH_MS,
} from '@/lib/music-generation';

export class MusicGenerateTool implements AgentTool {
  name = 'music.generate';
  description =
    'Compose an original music track from a text description and return a URL to the audio. ' +
    'Describe genre, mood, instrumentation, and tempo. Use for background scores, jingles, ' +
    'intro/outro beds, and soundtracks. This is composition, not narration — use audio tools ' +
    'for spoken word.';
  category = 'utility' as const;
  inputSchema = {
    type: 'object' as const,
    properties: {
      prompt: {
        type: 'string',
        description:
          'Description of the track: genre, mood, instrumentation, tempo. ' +
          'e.g. "warm lo-fi hip hop with vinyl crackle and mellow rhodes, 70bpm"',
      },
      lengthMs: {
        type: 'number',
        description: `Track length in milliseconds (${MIN_MUSIC_LENGTH_MS}–${MAX_MUSIC_LENGTH_MS}, default ${DEFAULT_MUSIC_LENGTH_MS}). Longer tracks cost proportionally more.`,
      },
      instrumental: {
        type: 'boolean',
        description: 'True to compose without vocals (default false)',
      },
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
    // lengthMs is clamped rather than rejected downstream (see
    // clampMusicLength), so only a non-numeric value is worth failing on here.
    if (params.lengthMs !== undefined && typeof params.lengthMs !== 'number') {
      return { valid: false, error: 'lengthMs must be a number when provided' };
    }
    return { valid: true };
  }

  /** Real cost is spent internally by generateMusicForUser(); reported as 0 here to avoid double-charging. */
  estimateCost(): number {
    return 0;
  }

  async execute(
    params: { prompt: string; lengthMs?: number; instrumental?: boolean },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    const result = await generateMusicForUser({
      userId: context.userId,
      prompt: params.prompt,
      lengthMs: params.lengthMs,
      instrumental: params.instrumental,
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
        url: result.music.audioUrl,
        lengthMs: result.music.lengthMs,
        instrumental: result.music.instrumental,
        prompt: result.music.prompt,
      },
      metadata: { duration: Date.now() - startTime, credits: 0 },
    };
  }
}
