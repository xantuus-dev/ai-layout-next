'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  onTextChange?: (newText: string) => void;
  variableValues?: Record<string, string>;
  onVariableChange?: (variableName: string, value: string) => void;
}

/**
 * Component that highlights {{variable}} patterns in template text
 * with editable inline inputs that maintain the same styling
 */
export function EditableTemplateVariableHighlighter({
  text,
  variables = [],
  className = '',
  onTextChange,
  variableValues = {},
  onVariableChange,
}: EditableTemplateVariableHighlighterProps) {
  const [values, setValues] = useState<Record<string, string>>(variableValues);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  useEffect(() => {
    setValues(variableValues);
  }, [variableValues]);

  const handleVariableChange = (variableName: string, value: string) => {
    const newValues = { ...values, [variableName]: value };
    setValues(newValues);
    onVariableChange?.(variableName, value);

    // Update the text with the new value
    if (onTextChange) {
      const regex = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
      const newText = text.replace(regex, value || `{{${variableName}}}`);
      onTextChange(newText);
    }
  };

  const handleVariableClick = (variableName: string) => {
    setEditingVar(variableName);
    setTimeout(() => {
      inputRefs.current[variableName]?.focus();
      inputRefs.current[variableName]?.select();
    }, 0);
  };

  const handleBlur = () => {
    setEditingVar(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, variableName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingVar(null);
    } else if (e.key === 'Escape') {
      setEditingVar(null);
    }
  };

  const parts: JSX.Element[] = [];
  let lastIndex = 0;

  // Match {{variable}} patterns
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  let matchIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    // Add the editable variable
    const variableName = match[1];
    const variable = variables.find((v) => v.name === variableName);
    const displayName = variable?.label || variableName;
    const value = values[variableName] || '';
    const placeholder = variable?.placeholder || displayName;
    const isEditing = editingVar === variableName;

    parts.push(
      <span
        key={`var-${match.index}-${matchIndex}`}
        className="inline-flex items-center relative mx-0.5"
      >
        {isEditing ? (
          <input
            ref={(el) => {
              if (el) inputRefs.current[variableName] = el;
            }}
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => handleVariableChange(variableName, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, variableName)}
            className="px-1.5 py-0.5 rounded border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-mono text-xs h-[22.5px] min-w-[60px] transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
            style={{
              color: 'rgb(37, 99, 235)',
              width: `${Math.max(60, (value || placeholder).length * 7 + 16)}px`,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => handleVariableClick(variableName)}
            className="px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 font-mono text-xs h-[22.5px] min-w-0 transition-all duration-200 overflow-y-hidden hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-text"
            style={{
              color: 'rgb(37, 99, 235)',
            }}
          >
            {value || displayName}
          </button>
        )}
      </span>
    );

    lastIndex = regex.lastIndex;
    matchIndex++;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.length > 0 ? parts : <span>{text}</span>}
    </div>
  );
}
