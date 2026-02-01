'use client';

import React from 'react';

interface TemplateVariableHighlighterProps {
  text: string;
  variables?: Array<{ name: string; label?: string }>;
  className?: string;
}

/**
 * Component that highlights {{variable}} patterns in template text
 * with styled input-like appearance
 */
export function TemplateVariableHighlighter({
  text,
  variables = [],
  className = '',
}: TemplateVariableHighlighterProps) {
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  
  // Match {{variable}} patterns
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    // Add the highlighted variable
    const variableName = match[1];
    const variable = variables.find((v) => v.name === variableName);
    const displayName = variable?.label || variableName;

    parts.push(
      <span
        key={`var-${match.index}`}
        className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 font-mono text-xs h-[22.5px] min-w-0 transition-all duration-200 overflow-y-hidden"
        style={{
          color: 'rgb(37, 99, 235)',
        }}
        contentEditable={false}
      >
        {displayName}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
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

/**
 * Utility function to render template text with highlighted variables
 * Returns an array of React elements
 */
export function highlightTemplateVariables(
  text: string,
  variables: Array<{ name: string; label?: string }> = []
): JSX.Element[] {
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    const variableName = match[1];
    const variable = variables.find((v) => v.name === variableName);
    const displayName = variable?.label || variableName;

    parts.push(
      <span
        key={`var-${match.index}`}
        className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 font-mono text-xs h-[22.5px] min-w-0 transition-all duration-200 overflow-y-hidden"
        style={{
          color: 'rgb(37, 99, 235)',
        }}
        contentEditable={false}
      >
        {displayName}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {text.substring(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : [<span key="text">{text}</span>];
}
