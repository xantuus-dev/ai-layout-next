/**
 * WorkflowNode Component
 *
 * Individual draggable workflow step node
 * - Displays node icon, label, and config preview
 * - Shows execution state during monitoring
 * - Handles selection for configuration
 * - Supports drag reordering
 */

'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  Globe,
  MousePointerClick,
  Type as TypeIcon,
  FileSearch,
  Clock,
  GitBranch,
  CheckCircle2,
  XCircle,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { CanvasNode, NodeType, ExecutionState } from '@/stores/workflow-builder-store';

interface WorkflowNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Get icon component for node type
 */
function getNodeIcon(type: NodeType) {
  switch (type) {
    case 'navigate':
      return Globe;
    case 'click':
      return MousePointerClick;
    case 'type':
      return TypeIcon;
    case 'extract':
      return FileSearch;
    case 'wait':
      return Clock;
    case 'conditional':
      return GitBranch;
  }
}

/**
 * Get human-readable label for node type
 */
function getNodeLabel(type: NodeType): string {
  switch (type) {
    case 'navigate':
      return 'Navigate';
    case 'click':
      return 'Click Element';
    case 'type':
      return 'Type Text';
    case 'extract':
      return 'Extract Data';
    case 'wait':
      return 'Wait';
    case 'conditional':
      return 'Conditional';
  }
}

/**
 * Get preview text for node configuration
 */
function getConfigPreview(node: CanvasNode): string {
  const { type, config } = node;

  switch (type) {
    case 'navigate':
      return config.action.url || 'No URL set';
    case 'click':
      return config.action.selector || 'No selector set';
    case 'type':
      return config.action.selector
        ? `${config.action.selector}: "${config.action.value || ''}"`
        : 'No selector set';
    case 'extract':
      return config.action.selector || 'No selector set';
    case 'wait':
      return `${config.action.duration || 1000}ms`;
    case 'conditional':
      return config.condition
        ? `${config.condition.variable} ${config.condition.operator} ${config.condition.value}`
        : 'No condition set';
  }
}

/**
 * Get execution state indicator
 */
function getExecutionIndicator(state?: ExecutionState) {
  switch (state) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'skipped':
      return <span className="text-xs text-muted-foreground">Skipped</span>;
    default:
      return null;
  }
}

/**
 * Get border color based on state
 */
function getBorderColor(
  isSelected: boolean,
  executionState?: ExecutionState,
  isValid?: boolean
): string {
  if (executionState === 'running') return 'border-blue-500 shadow-lg shadow-blue-500/50';
  if (executionState === 'completed') return 'border-green-500';
  if (executionState === 'failed') return 'border-red-500';
  if (isSelected) return 'border-primary ring-2 ring-primary/20';
  if (isValid === false) return 'border-red-300 dark:border-red-700';
  return 'border-border';
}

/**
 * WorkflowNode Component
 */
export function WorkflowNode({ node, isSelected, onSelect, onRemove }: WorkflowNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getNodeIcon(node.type);
  const label = getNodeLabel(node.type);
  const preview = getConfigPreview(node);

  // Basic validation - check if required fields are filled
  const isValid = (() => {
    switch (node.type) {
      case 'navigate':
        return !!node.config.action.url;
      case 'click':
      case 'type':
      case 'extract':
        return !!node.config.action.selector;
      case 'wait':
        return node.config.action.duration > 0;
      case 'conditional':
        return !!node.config.condition?.variable && !!node.config.condition?.operator;
      default:
        return true;
    }
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative w-full max-w-sm bg-background rounded-lg border-2 transition-all duration-200',
        getBorderColor(isSelected, node.executionState, isValid),
        isDragging && 'opacity-50 cursor-grabbing',
        !isDragging && 'cursor-pointer hover:shadow-md'
      )}
      onClick={() => onSelect(node.id)}
      role="button"
      aria-label={`${label} step${isSelected ? ' (selected)' : ''}`}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.id);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          onRemove(node.id);
        }
      }}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing',
          'hover:bg-muted/50 rounded-l-lg'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Node Content */}
      <div className="p-4 pl-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-2 rounded-md',
                isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="font-medium text-sm">{label}</span>
          </div>

          {/* Execution State Indicator */}
          {node.executionState && (
            <div className="flex items-center gap-1">
              {getExecutionIndicator(node.executionState)}
            </div>
          )}
        </div>

        {/* Configuration Preview */}
        <div
          className={cn(
            'text-xs truncate',
            isValid ? 'text-muted-foreground' : 'text-red-500'
          )}
        >
          {preview}
        </div>

        {/* Error Handling Badge */}
        {node.config.onError === 'ai_recovery' && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              AI Recovery
            </span>
          </div>
        )}

        {/* Output Variable Badge */}
        {node.config.saveOutput && node.config.outputName && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
              Output: {node.config.outputName}
            </span>
          </div>
        )}

        {/* Execution Output Preview */}
        {node.executionOutput && (
          <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
            <div className="text-xs text-green-700 dark:text-green-300 font-mono truncate">
              {JSON.stringify(node.executionOutput).slice(0, 100)}
            </div>
          </div>
        )}

        {/* Execution Error */}
        {node.executionError && (
          <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <div className="text-xs text-red-700 dark:text-red-300">
              {node.executionError}
            </div>
          </div>
        )}
      </div>

      {/* Remove Button (appears on hover when selected) */}
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(node.id);
          }}
          className={cn(
            'absolute -top-2 -right-2 p-1 rounded-full',
            'bg-destructive text-destructive-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-destructive/90 focus:ring-2 focus:ring-destructive/20'
          )}
          aria-label="Remove node"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
