/**
 * Validation for user-authored prompt templates.
 *
 * Shared by POST /api/user/templates and PATCH /api/user/templates/[id] so the
 * two cannot drift — a rule enforced on create but not on update is the same as
 * no rule at all.
 *
 * Only the fields a user is allowed to control are read here. Curation fields
 * (isPublic, isFeatured, tier, visibility) and bookkeeping (userId, usageCount)
 * are set by the route, never taken from the request body.
 */

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 1000;
const TEMPLATE_MAX = 20_000;
const TAGS_MAX = 10;
const TAG_MAX = 40;
const VARIABLES_MAX = 25;
const LABEL_MAX = 100;
const PLACEHOLDER_MAX = 200;
const OPTIONS_MAX = 25;
const OPTION_MAX = 100;

const VARIABLE_TYPES = ['text', 'textarea', 'number', 'select'] as const;

type VariableType = (typeof VARIABLE_TYPES)[number];

export interface TemplateVariableInput {
  name: string;
  label: string;
  type: VariableType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface UserTemplateInput {
  title: string;
  description: string | null;
  template: string;
  categoryId: string | null;
  tags: string[];
  variables: TemplateVariableInput[];
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Variable names must be matchable by VARIABLE_PATTERN in ./variables — a name
 * like "my-var" would leave "{{my-var}}" unsubstituted and send raw placeholder
 * syntax to the model, so it is rejected at write time rather than silently
 * producing a broken prompt later.
 */
const VARIABLE_NAME = /^\w+$/;

function parseString(
  value: unknown,
  field: string,
  max: number,
  { required }: { required: boolean }
): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return required
      ? { ok: false, error: `${field} is required` }
      : { ok: true, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false, error: `${field} must be a string` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return required
      ? { ok: false, error: `${field} is required` }
      : { ok: true, value: null };
  }

  if (trimmed.length > max) {
    return { ok: false, error: `${field} must be ${max} characters or fewer` };
  }

  return { ok: true, value: trimmed };
}

function parseTags(value: unknown): ParseResult<string[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };

  if (!Array.isArray(value)) {
    return { ok: false, error: 'tags must be an array' };
  }

  if (value.length > TAGS_MAX) {
    return { ok: false, error: `A template may have at most ${TAGS_MAX} tags` };
  }

  const tags: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      return { ok: false, error: 'Each tag must be a string' };
    }

    const tag = entry.trim();
    if (!tag) continue;

    if (tag.length > TAG_MAX) {
      return {
        ok: false,
        error: `Each tag must be ${TAG_MAX} characters or fewer`,
      };
    }

    // De-duplicate rather than reject: two tags differing only by whitespace is
    // a slip, not something worth failing the whole save over.
    if (!tags.includes(tag)) tags.push(tag);
  }

  return { ok: true, value: tags };
}

function parseVariables(value: unknown): ParseResult<TemplateVariableInput[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };

  if (!Array.isArray(value)) {
    return { ok: false, error: 'variables must be an array' };
  }

  if (value.length > VARIABLES_MAX) {
    return {
      ok: false,
      error: `A template may define at most ${VARIABLES_MAX} variables`,
    };
  }

  const variables: TemplateVariableInput[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: 'Each variable must be an object' };
    }

    const raw = entry as Record<string, unknown>;

    if (typeof raw.name !== 'string' || !VARIABLE_NAME.test(raw.name)) {
      return {
        ok: false,
        error:
          'Each variable needs a name of letters, numbers and underscores only',
      };
    }

    if (seen.has(raw.name)) {
      return { ok: false, error: `Duplicate variable name "${raw.name}"` };
    }
    seen.add(raw.name);

    const label = parseString(raw.label, 'Variable label', LABEL_MAX, {
      required: true,
    });
    if (!label.ok) return label;

    const type = (raw.type ?? 'text') as VariableType;
    if (!VARIABLE_TYPES.includes(type)) {
      return {
        ok: false,
        error: `Variable type must be one of ${VARIABLE_TYPES.join(', ')}`,
      };
    }

    const placeholder = parseString(
      raw.placeholder,
      'Variable placeholder',
      PLACEHOLDER_MAX,
      { required: false }
    );
    if (!placeholder.ok) return placeholder;

    const variable: TemplateVariableInput = {
      name: raw.name,
      label: label.value as string,
      type,
      required: raw.required === undefined ? true : Boolean(raw.required),
    };

    if (placeholder.value) variable.placeholder = placeholder.value;

    if (type === 'select') {
      if (!Array.isArray(raw.options)) {
        return {
          ok: false,
          error: `Variable "${raw.name}" is a select and needs an options array`,
        };
      }

      const options: string[] = [];
      for (const option of raw.options) {
        if (typeof option !== 'string') {
          return { ok: false, error: 'Each variable option must be a string' };
        }

        const trimmed = option.trim();
        if (!trimmed) continue;

        if (trimmed.length > OPTION_MAX) {
          return {
            ok: false,
            error: `Each option must be ${OPTION_MAX} characters or fewer`,
          };
        }

        if (!options.includes(trimmed)) options.push(trimmed);
      }

      if (!options.length) {
        return {
          ok: false,
          error: `Variable "${raw.name}" is a select and needs at least one option`,
        };
      }

      if (options.length > OPTIONS_MAX) {
        return {
          ok: false,
          error: `A variable may have at most ${OPTIONS_MAX} options`,
        };
      }

      variable.options = options;
    }

    variables.push(variable);
  }

  return { ok: true, value: variables };
}

/**
 * Validate a create request. Every field is parsed; title and template are
 * required.
 */
export function parseCreateInput(body: unknown): ParseResult<UserTemplateInput> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be an object' };
  }

  const raw = body as Record<string, unknown>;

  const title = parseString(raw.title, 'Title', TITLE_MAX, { required: true });
  if (!title.ok) return title;

  const template = parseString(raw.template, 'Template', TEMPLATE_MAX, {
    required: true,
  });
  if (!template.ok) return template;

  const description = parseString(
    raw.description,
    'Description',
    DESCRIPTION_MAX,
    { required: false }
  );
  if (!description.ok) return description;

  const categoryId = parseString(raw.categoryId, 'Category', 64, {
    required: false,
  });
  if (!categoryId.ok) return categoryId;

  const tags = parseTags(raw.tags);
  if (!tags.ok) return tags;

  const variables = parseVariables(raw.variables);
  if (!variables.ok) return variables;

  return {
    ok: true,
    value: {
      title: title.value as string,
      description: description.value,
      template: template.value as string,
      categoryId: categoryId.value,
      tags: tags.value,
      variables: variables.value,
    },
  };
}

/**
 * Validate an update request. Only the keys actually present are parsed, so a
 * caller can rename a template without resending its body. Sending no known key
 * is an error rather than a silent no-op.
 */
export function parseUpdateInput(
  body: unknown
): ParseResult<Partial<UserTemplateInput>> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be an object' };
  }

  const raw = body as Record<string, unknown>;
  const update: Partial<UserTemplateInput> = {};

  if ('title' in raw) {
    const title = parseString(raw.title, 'Title', TITLE_MAX, {
      required: true,
    });
    if (!title.ok) return title;
    update.title = title.value as string;
  }

  if ('template' in raw) {
    const template = parseString(raw.template, 'Template', TEMPLATE_MAX, {
      required: true,
    });
    if (!template.ok) return template;
    update.template = template.value as string;
  }

  if ('description' in raw) {
    const description = parseString(
      raw.description,
      'Description',
      DESCRIPTION_MAX,
      { required: false }
    );
    if (!description.ok) return description;
    update.description = description.value;
  }

  if ('categoryId' in raw) {
    const categoryId = parseString(raw.categoryId, 'Category', 64, {
      required: false,
    });
    if (!categoryId.ok) return categoryId;
    update.categoryId = categoryId.value;
  }

  if ('tags' in raw) {
    const tags = parseTags(raw.tags);
    if (!tags.ok) return tags;
    update.tags = tags.value;
  }

  if ('variables' in raw) {
    const variables = parseVariables(raw.variables);
    if (!variables.ok) return variables;
    update.variables = variables.value;
  }

  if (!Object.keys(update).length) {
    return { ok: false, error: 'No editable fields were provided' };
  }

  return { ok: true, value: update };
}
