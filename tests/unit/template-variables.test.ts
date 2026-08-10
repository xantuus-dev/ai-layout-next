import { describe, it, expect } from 'vitest';
import {
  extractVariableNames,
  fillTemplate,
  countFilledVariables,
  tidyFilledPrompt,
} from '@/lib/templates/variables';

// The real "Professional Email Composer" template, which repeats two variables.
const EMAIL_TEMPLATE = `Draft a professional email:

**Recipient**: {{recipient_name}}
**Subject**: {{email_subject}}
**Tone**: {{tone_style}}
**Length**: {{desired_length}} words

Instructions:
- Maintain {{tone_style}} tone
- Keep length to ~{{desired_length}} words

{{additional_instructions}}`;

describe('extractVariableNames', () => {
  it('lists variables in order of first appearance', () => {
    expect(extractVariableNames(EMAIL_TEMPLATE)).toEqual([
      'recipient_name',
      'email_subject',
      'tone_style',
      'desired_length',
      'additional_instructions',
    ]);
  });

  it('counts a repeated variable once', () => {
    expect(extractVariableNames('{{a}} {{a}} {{a}}')).toEqual(['a']);
  });

  it('returns [] for a template with no variables', () => {
    expect(extractVariableNames('just prose')).toEqual([]);
  });

  it('ignores malformed placeholders', () => {
    expect(extractVariableNames('{single} {{ spaced }} {{kebab-case}}')).toEqual([]);
  });
});

describe('fillTemplate', () => {
  it('substitutes every occurrence of a repeated variable', () => {
    const out = fillTemplate(EMAIL_TEMPLATE, {
      tone_style: 'formal',
      desired_length: '150',
    });
    expect(out).toContain('**Tone**: formal');
    expect(out).toContain('- Maintain formal tone');
    expect(out).toContain('~150 words');
  });

  it('leaves no placeholder syntax behind for unfilled variables', () => {
    const out = fillTemplate(EMAIL_TEMPLATE, {});
    expect(out).not.toMatch(/\{\{|\}\}/);
  });

  it('trims surrounding whitespace from values', () => {
    expect(fillTemplate('Hi {{name}}', { name: '  Ada  ' })).toBe('Hi Ada');
  });

  it('treats a missing key and an empty string the same way', () => {
    expect(fillTemplate('X{{a}}Y', {})).toBe(fillTemplate('X{{a}}Y', { a: '' }));
  });

  it('does not re-substitute a value that itself looks like a placeholder', () => {
    // A value of "{{b}}" must be inserted literally, not expanded again.
    expect(fillTemplate('{{a}}', { a: '{{b}}', b: 'boom' })).toBe('{{b}}');
  });
});

describe('countFilledVariables', () => {
  it('counts distinct filled variables against the distinct total', () => {
    expect(
      countFilledVariables(EMAIL_TEMPLATE, { recipient_name: 'Ada', tone_style: 'warm' })
    ).toEqual({ filled: 2, total: 5 });
  });

  it('does not count whitespace as filled', () => {
    expect(countFilledVariables('{{a}}', { a: '   ' })).toEqual({ filled: 0, total: 1 });
  });

  it('reports zero total for a template with no variables', () => {
    expect(countFilledVariables('no vars', {})).toEqual({ filled: 0, total: 0 });
  });
});

describe('tidyFilledPrompt', () => {
  it('collapses the double space left where a value was removed', () => {
    expect(tidyFilledPrompt('Keep length to  words')).toBe('Keep length to words');
  });

  it('strips trailing spaces at end of line', () => {
    expect(tidyFilledPrompt('**Subject**: \nnext')).toBe('**Subject**:\nnext');
  });

  it('collapses three or more blank lines into one', () => {
    expect(tidyFilledPrompt('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('preserves single blank lines, which carry the template structure', () => {
    expect(tidyFilledPrompt('a\n\nb')).toBe('a\n\nb');
  });

  it('never deletes a heading line ending in a colon', () => {
    // A previous version removed these, which stripped "Instructions:" from
    // the email template.
    const out = tidyFilledPrompt(fillTemplate(EMAIL_TEMPLATE, { recipient_name: 'Ada' }));
    expect(out).toContain('Instructions:');
  });

  it('leaves a fully filled prompt materially unchanged', () => {
    const filled = fillTemplate(EMAIL_TEMPLATE, {
      recipient_name: 'Ada',
      email_subject: 'Q3 review',
      tone_style: 'formal',
      desired_length: '150',
      additional_instructions: 'Mention the deadline.',
    });
    const tidied = tidyFilledPrompt(filled);
    expect(tidied).toContain('**Recipient**: Ada');
    expect(tidied).toContain('Mention the deadline.');
    expect(tidied).toContain('Instructions:');
  });
});
