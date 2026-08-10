/**
 * Prompt template variable substitution.
 *
 * Templates embed variables as {{snake_case}} placeholders. These helpers are
 * pure so the substitution rules can be unit tested without rendering anything —
 * the previous implementation rebuilt the prompt inside a React onChange
 * handler, which made the behaviour untestable and coupled it to focus events.
 */

/** Matches a {{variable}} placeholder. Names are word characters only. */
export const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Every variable name referenced by a template, in order of first appearance
 * and de-duplicated. A template may repeat a variable ({{tone_style}} appears
 * twice in the email composer), and it should still count once.
 */
export function extractVariableNames(template: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

/**
 * Replace every placeholder with its value.
 *
 * A variable with no value collapses to an empty string rather than being left
 * as a literal "{{email_subject}}" — sending raw placeholder syntax to the model
 * is never what the user meant. Repeated variables all receive the same value.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(VARIABLE_PATTERN, (_match, name: string) =>
    (values[name] ?? '').trim()
  );
}

/**
 * How many of a template's variables have a non-blank value.
 * Drives the "3 of 5 filled" progress hint.
 */
export function countFilledVariables(
  template: string,
  values: Record<string, string>
): { filled: number; total: number } {
  const names = extractVariableNames(template);

  return {
    filled: names.filter((name) => (values[name] ?? '').trim().length > 0).length,
    total: names.length,
  };
}

/**
 * Tidy the prompt produced by filling a partially completed template.
 *
 * Deliberately minimal. An earlier version also deleted lines that ended in a
 * bare colon, on the theory that "**Subject**:" is debris once the value is
 * blank — but that rule cannot tell such a line apart from a real heading, and
 * it removed "Instructions:" from the email template. Predictable beats clever:
 * only whitespace is normalised, never a line of the user's template.
 */
export function tidyFilledPrompt(filled: string): string {
  return filled
    // Collapse runs of spaces/tabs left behind where a value was removed.
    // Newlines are untouched — the template's line structure is meaningful.
    .replace(/[ \t]{2,}/g, ' ')
    // Strip trailing spaces a removed value left at end of line.
    .replace(/[ \t]+$/gm, '')
    // Never leave more than one blank line.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
