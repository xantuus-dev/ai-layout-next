'use client';

import { useState } from 'react';
import { ChevronRight, Brain, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReasoningBlockProps {
  /** Reasoning text streamed so far. */
  content: string;
  /** True while the model is still producing reasoning. */
  isActive: boolean;
  /** How long reasoning took, in ms. Only meaningful once isActive is false. */
  durationMs?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return 'less than a second';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

/**
 * Collapsible display of the model's extended-thinking output.
 *
 * Expanded while reasoning streams in so there is visible progress instead of a
 * static spinner, then collapsed to a one-line summary once the answer starts —
 * the reasoning is context, not the response.
 */
export default function ReasoningBlock({
  content,
  isActive,
  durationMs,
}: ReasoningBlockProps) {
  // null means "follow isActive"; a boolean means the user has taken control.
  const [manuallyExpanded, setManuallyExpanded] = useState<boolean | null>(null);
  const isExpanded = manuallyExpanded ?? isActive;

  if (!content && !isActive) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setManuallyExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronRight
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
          aria-hidden="true"
        />
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Brain className="w-3.5 h-3.5 shrink-0 text-primary" aria-hidden="true" />
        )}
        <span className="font-medium">
          {isActive
            ? 'Thinking…'
            : durationMs
              ? `Thought for ${formatDuration(durationMs)}`
              : 'Thought process'}
        </span>
      </button>

      {isExpanded && content && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50">
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_p]:my-1.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
