'use client';

import React from 'react';
import { VARIABLE_PATTERN } from '@/lib/templates/variables';

interface TemplateVariable {
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
}

interface EditableTemplateVariableHighlighterProps {
  text: string;
  variables?: TemplateVariable[];
  className?: string;
  variableValues?: Record<string, string>;
  onVariableChange?: (variableName: string, value: string) => void;
}

/** Roughly the width of one monospace character at text-xs, in px. */
const CHAR_PX = 7;
const MIN_FIELD_PX = 72;
const MAX_FIELD_PX = 420;

function fieldWidth(content: string, placeholder: string): number {
  const basis = content.length > 0 ? content : placeholder;
  return Math.min(MAX_FIELD_PX, Math.max(MIN_FIELD_PX, basis.length * CHAR_PX + 20));
}

/**
 * Renders template text with each {{variable}} replaced by an inline field.
 *
 * The fields are always real inputs. A previous version rendered a button and
 * swapped it for an input on click, which meant the element under the caret was
 * replaced mid-interaction — a reliable way to lose focus. It also mirrored
 * every keystroke into a second editor, which stole the caret outright after
 * one character. Both are gone: this is the only editing surface, and it is
 * fully controlled by the parent.
 */
export function EditableTemplateVariableHighlighter({
  text,
  variables = [],
  className = '',
  variableValues = {},
  onVariableChange,
}: EditableTemplateVariableHighlighterProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let occurrence = 0;

  // matchAll avoids the shared-lastIndex hazard of reusing a /g regex object
  // across renders.
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`} className="whitespace-pre-wrap">
          {text.slice(lastIndex, index)}
        </span>
      );
    }

    const name = match[1];
    const variable = variables.find((v) => v.name === name);
    const label = variable?.label || name;
    const placeholder = variable?.placeholder || label;
    const value = variableValues[name] ?? '';
    const isFilled = value.trim().length > 0;

    // A repeated variable renders more than one field bound to the same value,
    // so typing in either keeps them in step.
    const key = `v-${name}-${occurrence}`;

    const shared =
      'inline-block align-baseline rounded-md border px-2 py-0.5 font-mono text-xs ' +
      'outline-none transition-colors focus:ring-2 focus:ring-blue-400/60 ' +
      (isFilled
        ? 'border-blue-400/70 bg-blue-500/10 text-blue-700 dark:border-blue-500/60 dark:bg-blue-400/10 dark:text-blue-200'
        : 'border-dashed border-blue-400/60 bg-blue-500/5 text-blue-600 dark:border-blue-500/50 dark:text-blue-300');

    if (variable?.type === 'select' && variable.options?.length) {
      parts.push(
        <select
          key={key}
          aria-label={label}
          value={value}
          onChange={(e) => onVariableChange?.(name, e.target.value)}
          className={`${shared} cursor-pointer`}
        >
          <option value="">{placeholder}</option>
          {variable.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else {
      parts.push(
        <input
          key={key}
          type={variable?.type === 'number' ? 'number' : 'text'}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onVariableChange?.(name, e.target.value)}
          className={`${shared} placeholder:text-blue-500/50 dark:placeholder:text-blue-300/40`}
          style={{ width: fieldWidth(value, placeholder) }}
        />
      );
    }

    lastIndex = index + match[0].length;
    occurrence++;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`t-${lastIndex}`} className="whitespace-pre-wrap">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return (
    <div className={`whitespace-pre-wrap break-words leading-7 ${className}`}>
      {parts.length > 0 ? parts : <span>{text}</span>}
    </div>
  );
}
