/**
 * WorkflowBuilderCanvas Component
 *
 * Main container that orchestrates the visual workflow builder
 * - Integrates palette, canvas, toolbar, and config panel
 * - Provides drag-and-drop context (@dnd-kit)
 * - Manages layout and responsiveness
 * - Handles save, test, and execution operations
 */

'use client';

import React, { useState } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useWorkflowBuilderStore, useSelectedNode } from '@/stores/workflow-builder-store';
import { WorkflowNodePalette } from './WorkflowNodePalette';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowCanvasToolbar } from './WorkflowCanvasToolbar';
import { WorkflowNodeConfigPanel } from './WorkflowNodeConfigPanel';
import { WorkflowTemplateLibrary } from './WorkflowTemplateLibrary';
import { cn } from '@/lib/utils';

interface WorkflowBuilderCanvasProps {
  workflowId?: string;
  onSave?: (name: string, description: string) => Promise<void>;
  onTestRun?: () => Promise<void>;
}

/**
 * WorkflowBuilderCanvas Component
 */
export function WorkflowBuilderCanvas({
  workflowId,
  onSave,
  onTestRun,
}: WorkflowBuilderCanvasProps) {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const reorderNodes = useWorkflowBuilderStore((state) => state.reorderNodes);
  const isConfigPanelOpen = useWorkflowBuilderStore((state) => state.isConfigPanelOpen);
  const selectedNode = useSelectedNode();

  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);

  /**
   * Handle drag end event - reorder nodes
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderNodes(oldIndex, newIndex);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <WorkflowCanvasToolbar
        onSave={onSave}
        onTestRun={onTestRun}
        onUseTemplate={() => setIsTemplateLibraryOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* Left Sidebar - Node Palette */}
          <WorkflowNodePalette />

          {/* Center - Canvas */}
          <WorkflowCanvas onBrowseTemplates={() => setIsTemplateLibraryOpen(true)} />

          {/* Right Sidebar - Config Panel */}
          <div
            className={cn(
              'border-l bg-background transition-all duration-300 overflow-hidden',
              isConfigPanelOpen && selectedNode ? 'w-80' : 'w-0'
            )}
          >
            {isConfigPanelOpen && selectedNode && (
              <WorkflowNodeConfigPanel node={selectedNode} />
            )}
          </div>
        </DndContext>
      </div>

      {/* Template Library Dialog */}
      <WorkflowTemplateLibrary
        open={isTemplateLibraryOpen}
        onClose={() => setIsTemplateLibraryOpen(false)}
      />
    </div>
  );
}
