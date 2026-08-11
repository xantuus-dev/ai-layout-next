import { describe, it, expect } from 'vitest';
import {
  parseCreateInput,
  parseUpdateInput,
  type ParseResult,
} from '@/lib/templates/user-template-input';
import { extractVariableNames } from '@/lib/templates/variables';

/** A minimal valid create body. */
const VALID = {
  title: 'Weekly standup summary',
  template: 'Summarise this standup for {{audience}}:\n\n{{notes}}',
  variables: [
    { name: 'audience', label: 'Audience', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

function expectError<T>(result: ParseResult<T>) {
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
}

describe('parseCreateInput', () => {
  it('accepts a well-formed template', () => {
    const result = parseCreateInput(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.title).toBe('Weekly standup summary');
    expect(result.value.variables).toHaveLength(2);
    expect(result.value.description).toBeNull();
    expect(result.value.categoryId).toBeNull();
    expect(result.value.tags).toEqual([]);
  });

  it('defaults a variable to required and to type text', () => {
    const result = parseCreateInput({
      ...VALID,
      variables: [{ name: 'audience', label: 'Audience' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.variables[0]).toMatchObject({
      type: 'text',
      required: true,
    });
  });

  it('requires a title', () => {
    expect(expectError(parseCreateInput({ ...VALID, title: '   ' }))).toMatch(
      /Title is required/
    );
  });

  it('requires a template body', () => {
    expect(expectError(parseCreateInput({ title: 'x' }))).toMatch(
      /Template is required/
    );
  });

  it('rejects a body that is not an object', () => {
    expect(expectError(parseCreateInput('nope'))).toMatch(/must be an object/);
    expect(expectError(parseCreateInput([VALID]))).toMatch(/must be an object/);
  });

  // The renderer only substitutes {{\w+}}, so a name outside that alphabet
  // would be sent to the model as literal placeholder syntax.
  it('rejects variable names the renderer cannot substitute', () => {
    for (const name of ['my-var', 'my var', 'my.var', '']) {
      expect(
        expectError(
          parseCreateInput({
            ...VALID,
            variables: [{ name, label: 'Label' }],
          })
        )
      ).toMatch(/letters, numbers and underscores/);
    }
  });

  it('accepts exactly the names extractVariableNames can find', () => {
    const result = parseCreateInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.variables.map((v) => v.name)).toEqual(
      extractVariableNames(VALID.template)
    );
  });

  it('rejects duplicate variable names', () => {
    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          variables: [
            { name: 'a', label: 'First' },
            { name: 'a', label: 'Second' },
          ],
        })
      )
    ).toMatch(/Duplicate variable name/);
  });

  it('requires a label on each variable', () => {
    expect(
      expectError(
        parseCreateInput({ ...VALID, variables: [{ name: 'a', label: '' }] })
      )
    ).toMatch(/Variable label is required/);
  });

  it('rejects an unknown variable type', () => {
    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          variables: [{ name: 'a', label: 'A', type: 'password' }],
        })
      )
    ).toMatch(/Variable type must be one of/);
  });

  it('requires options on a select variable', () => {
    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          variables: [{ name: 'a', label: 'A', type: 'select' }],
        })
      )
    ).toMatch(/needs an options array/);

    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          variables: [
            { name: 'a', label: 'A', type: 'select', options: ['  ', ''] },
          ],
        })
      )
    ).toMatch(/needs at least one option/);
  });

  it('trims and de-duplicates tags, dropping blanks', () => {
    const result = parseCreateInput({
      ...VALID,
      tags: ['  email ', 'email', '', 'summary'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tags).toEqual(['email', 'summary']);
  });

  it('enforces the tag count limit', () => {
    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
        })
      )
    ).toMatch(/at most 10 tags/);
  });

  it('enforces the title length limit', () => {
    expect(
      expectError(parseCreateInput({ ...VALID, title: 'x'.repeat(201) }))
    ).toMatch(/200 characters or fewer/);
  });

  it('enforces the variable count limit', () => {
    expect(
      expectError(
        parseCreateInput({
          ...VALID,
          variables: Array.from({ length: 26 }, (_, i) => ({
            name: `v${i}`,
            label: `V${i}`,
          })),
        })
      )
    ).toMatch(/at most 25 variables/);
  });

  // Curation and ownership are set by the route. Anything sent for them in the
  // body must not survive into the parsed value.
  it('drops curation and ownership fields from the body', () => {
    const result = parseCreateInput({
      ...VALID,
      isPublic: true,
      isFeatured: true,
      visibility: 'public',
      tier: 'enterprise',
      userId: 'someone-else',
      usageCount: 9999,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual([
      'categoryId',
      'description',
      'tags',
      'template',
      'title',
      'variables',
    ]);
  });
});

describe('parseUpdateInput', () => {
  it('parses only the keys that are present', () => {
    const result = parseUpdateInput({ title: 'Renamed' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ title: 'Renamed' });
  });

  it('rejects an update with no editable fields', () => {
    expect(expectError(parseUpdateInput({}))).toMatch(/No editable fields/);
    expect(expectError(parseUpdateInput({ isFeatured: true }))).toMatch(
      /No editable fields/
    );
  });

  it('treats an explicit empty description as a clear', () => {
    const result = parseUpdateInput({ description: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ description: null });
  });

  it('treats an explicit empty categoryId as a clear', () => {
    const result = parseUpdateInput({ categoryId: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ categoryId: null });
  });

  // The rules must not be laxer on update than on create.
  it('applies the same validation as create', () => {
    expect(expectError(parseUpdateInput({ title: '' }))).toMatch(
      /Title is required/
    );
    expect(expectError(parseUpdateInput({ template: '   ' }))).toMatch(
      /Template is required/
    );
    expect(
      expectError(parseUpdateInput({ variables: [{ name: 'a-b', label: 'A' }] }))
    ).toMatch(/letters, numbers and underscores/);
  });
});
