/**
 * Builds the system prompt for a chat turn.
 *
 * The personalization fields — nickname, occupation, bio, customInstructions —
 * have existed on User with a settings page and a CRUD endpoint, but no chat
 * path ever read them. A user could write custom instructions and they had no
 * effect whatsoever. This is where they finally reach the model.
 *
 * Pure: composing the prompt is separated from loading the user so the
 * assembly rules can be tested without a database.
 */

export interface Personalization {
  nickname?: string | null;
  occupation?: string | null;
  bio?: string | null;
  customInstructions?: string | null;
}

/** Matches the column limits enforced by /api/user/personalization. */
const LIMITS = {
  nickname: 50,
  occupation: 100,
  bio: 2000,
  customInstructions: 3000,
} as const;

const BASE_PROMPT =
  'You are Xantuus AI, a helpful assistant. Be direct and concise. ' +
  'If you are unsure or lack the information to answer, say so rather than guessing.';

function clean(value: string | null | undefined, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Defence in depth: the API validates length on write, but rows predating
  // that validation (or written by another path) must not blow the context.
  return trimmed.slice(0, limit);
}

/**
 * Compose the system prompt from the user's profile and any memory context.
 *
 * Returns the base prompt alone when nothing is personalized, so callers can
 * always send a system message rather than branching. Custom instructions come
 * last and are explicitly labelled as user-authored preferences — they steer
 * tone and format, they are not a channel for overriding the assistant's own
 * rules.
 * Exported for testing.
 */
export function buildSystemPrompt(
  personalization: Personalization | null | undefined,
  memoryContext?: string | null,
  styleContext?: string | null
): string {
  const sections: string[] = [BASE_PROMPT];

  const nickname = clean(personalization?.nickname, LIMITS.nickname);
  const occupation = clean(personalization?.occupation, LIMITS.occupation);
  const bio = clean(personalization?.bio, LIMITS.bio);
  const instructions = clean(personalization?.customInstructions, LIMITS.customInstructions);

  const about: string[] = [];
  if (nickname) about.push(`They prefer to be called ${nickname}.`);
  if (occupation) about.push(`Their occupation: ${occupation}.`);
  if (bio) about.push(`About them: ${bio}`);

  if (about.length > 0) {
    sections.push(`About the user:\n${about.join('\n')}`);
  }

  if (memoryContext) {
    sections.push(memoryContext);
  }

  // Learned voice sits before custom instructions deliberately: the profile is
  // inferred from how the user writes, whereas custom instructions are what
  // they explicitly asked for. When the two disagree, the explicit request is
  // the one that should win, so it comes last.
  if (styleContext) {
    sections.push(styleContext);
  }

  if (instructions) {
    sections.push(
      'The user has set these preferences for how you should respond. Follow them ' +
        'unless doing so would conflict with being accurate or safe:\n' +
        instructions
    );
  }

  return sections.join('\n\n');
}

/**
 * True when the profile contains anything worth sending.
 * Lets a caller skip the database read when it already knows there is nothing.
 * Exported for testing.
 */
export function hasPersonalization(personalization: Personalization | null | undefined): boolean {
  if (!personalization) return false;

  return [
    personalization.nickname,
    personalization.occupation,
    personalization.bio,
    personalization.customInstructions,
  ].some((v) => typeof v === 'string' && v.trim().length > 0);
}
