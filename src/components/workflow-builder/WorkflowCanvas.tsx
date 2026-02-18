/**
 * WorkflowCanvas Component
 *
 * Drop zone and display area for workflow nodes
 * - Displays nodes in execution order (top to bottom)
 * - Shows connection lines between nodes
 * - Handles zoom and pan
 * - Empty state when no nodes
 */

'use client';

import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useWorkflowBuilderStore } from '@/stores/workflow-builder-store';
import { WorkflowNode } from './WorkflowNode';
import { ConnectionLines } from './ConnectionLines';
import { cn } from '@/lib/utils';
import { Workflow, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Empty State Component
 */
function EmptyState({ onAddFirstNode, onBrowseTemplates }: { onAddFirstNode: () => void; onBrowseTemplates: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Workflow className="h-12 w-12 text-muted-foreground" />
      </div>

      <h3 className="text-xl font-semibold mb-2">Start Building Your Workflow</h3>

      <p className="text-muted-foreground mb-6 max-w-md">
        Add steps from the palette on the left to create your automated workflow.
        Steps execute from top to bottom.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onAddFirstNode} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add Your First Step
        </Button>

        <Button variant="outline" size="lg" onClick={onBrowseTemplates}>
          <Sparkles className="mr-2 h-4 w-4" />
          Browse Templates
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <div className="p-4 rounded-lg border bg-card">
          <div className="font-medium text-sm mb-1">1. Add Steps</div>
          <div className="text-xs text-muted-foreground">
            Click steps from the palette to add them
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="font-medium text-sm mb-1">2. Configure</div>
          <div className="text-xs text-muted-foreground">
            Click a step to configure its settings
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="font-medium text-sm mb-1">3. Execute</div>
          <div className="text-xs text-muted-foreground">
            Save and run your workflow
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * WorkflowCanvas Component
 */
export function WorkflowCanvas({ onBrowseTemplates }: { onBrowseTemplates?: () => void }) {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const selectedNodeId = useWorkflowBuilderStore((state) => state.selectedNodeId);
  const selectNode = useWorkflowBuilderStore((state) => state.selectNode);
  const removeNode = useWorkflowBuilderStore((state) => state.removeNode);
  const addNode = useWorkflowBuilderStore((state) => state.addNode);
  const zoom = useWorkflowBuilderStore((state) => state.zoom);
  const panX = useWorkflowBuilderStore((state) => state.panX);
  const panY = useWorkflowBuilderStore((state) => state.panY);

  // Handle canvas click to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectNode(null);
    }
  };

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className="flex-1 bg-muted/30 overflow-hidden">
        <EmptyState
          onAddFirstNode={() => addNode('navigate')}
          onBrowseTemplates={onBrowseTemplates || (() => {})}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 bg-muted/30 overflow-auto relative"
      onClick={handleCanvasClick}
      role="region"
      aria-label="Workflow canvas"
    >
      {/* Canvas Content with Zoom & Pan */}
      <div
        className="min-h-full p-8"
        style={{
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
          transformOrigin: 'top left',
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Connection Lines (SVG Overlay) */}
        <ConnectionLines nodes={nodes} />

        {/* Sortable Node List */}
        <SortableContext
          items={nodes.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4 relative z-10">
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className="flex items-center gap-4"
                style={{
                  marginLeft: node.position.x,
                }}
              >
                {/* Step Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>

                {/* Node */}
                <div className="flex-1">
                  <WorkflowNode
                    node={node}
                    isSelected={node.id === selectedNodeId}
                    onSelect={selectNode}
                    onRemove={removeNode}
                  />
                </div>
              </div>
            ))}
          </div>
        </SortableContext>

        {/* Grid Pattern (optional visual aid) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-4 right-4 bg-background border rounded-md px-3 py-1.5 text-sm font-medium shadow-sm">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
