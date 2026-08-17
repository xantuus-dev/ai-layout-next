/**
 * Concept -> scene breakdown, the first step of the video pipeline.
 *
 * Follows the prompt-and-parse convention already used for AI planning in
 * src/lib/agent/executor.ts (createPlanningPrompt/parsePlanFromAI): no
 * forced-tool-use/JSON-schema precedent exists in this codebase, so this
 * asks for a fenced ```json block and extracts it with the same regex
 * fallback rather than introducing a new structured-output mechanism.
 */

import { aiRouter } from '@/lib/ai-providers';
import type { VeoDurationSeconds } from '@/lib/video-generation';
import type { BreakdownConceptInput, SceneSpec } from './types';

const PLANNING_MODEL = 'claude-sonnet-4-5-20250929';
const VALID_SCENE_DURATIONS: VeoDurationSeconds[] = ['4', '6', '8'];

// A single Veo clip is already "the most expensive call in the app" (see the
// VIDEO_GENERATION rate-limit comment in src/lib/rate-limit.ts) - 5 scenes
// means up to 5 of those plus 5 ElevenLabs calls in one background job,
// which is already an aggressive ceiling for a single project.
export const MAX_SCENES = 5;

function buildBreakdownPrompt(input: BreakdownConceptInput): string {
  const { concept, targetDurationSeconds, aspectRatio, tone } = input;

  return `You are a video director breaking a concept into a shot list for AI video generation.

CONCEPT: ${concept}

TARGET TOTAL DURATION: ~${targetDurationSeconds} seconds
ASPECT RATIO: ${aspectRatio}
TONE: ${tone || 'match the concept'}

Break this into a sequence of scenes. Each scene becomes one AI-generated video
clip with a synced voiceover line. Rules:
- Produce at most ${MAX_SCENES} scenes.
- Each scene's "durationSeconds" must be exactly "4", "6", or "8" (as a string) -
  these are the only durations the video model supports.
- The scenes' durations should sum to approximately the target total duration.
- "veoPrompt": a vivid, concrete visual description for the video model - describe
  what's on screen, camera movement, and setting. No dialogue or text overlays.
- "voiceoverText": the narration line spoken during that scene, timed to roughly
  fit the scene's duration when read aloud.

Return ONLY a JSON array, no other text, in this shape:
\`\`\`json
[
  {
    "veoPrompt": "Slow push-in on a hand pouring coffee into a white ceramic mug, steam rising, warm morning light",
    "voiceoverText": "Every great day starts with a great cup of coffee.",
    "durationSeconds": "4"
  }
]
\`\`\`

Return ONLY the JSON array, no other text.`;
}

function parseScenesFromAI(content: string): SceneSpec[] {
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[([\s\S]*?)\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse scene breakdown from AI response');
  }

  const jsonString = jsonMatch[1] || jsonMatch[0];
  let scenesData: any[];
  try {
    scenesData = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to parse scene breakdown JSON: ${error instanceof Error ? error.message : 'invalid JSON'}`
    );
  }

  if (!Array.isArray(scenesData) || scenesData.length === 0) {
    throw new Error('Scene breakdown must be a non-empty array');
  }

  const truncated = scenesData.slice(0, MAX_SCENES);

  return truncated.map((scene, index) => {
    if (!scene.veoPrompt || typeof scene.veoPrompt !== 'string') {
      throw new Error(`Scene ${index + 1} is missing a veoPrompt`);
    }
    if (!scene.voiceoverText || typeof scene.voiceoverText !== 'string') {
      throw new Error(`Scene ${index + 1} is missing voiceoverText`);
    }

    const durationSeconds = String(scene.durationSeconds) as VeoDurationSeconds;
    if (!VALID_SCENE_DURATIONS.includes(durationSeconds)) {
      throw new Error(
        `Scene ${index + 1} has invalid durationSeconds "${scene.durationSeconds}" (must be "4", "6", or "8")`
      );
    }

    return {
      order: index,
      veoPrompt: scene.veoPrompt,
      voiceoverText: scene.voiceoverText,
      durationSeconds,
      status: 'pending',
    };
  });
}

export async function breakdownConcept(input: BreakdownConceptInput): Promise<SceneSpec[]> {
  const prompt = buildBreakdownPrompt(input);

  const response = await aiRouter.chat(PLANNING_MODEL, {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
  });

  return parseScenesFromAI(response.content);
}
