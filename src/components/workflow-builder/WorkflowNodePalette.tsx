/**
 * WorkflowNodePalette Component
 *
 * Step type library - users can click to add nodes to canvas
 * - Displays available node types with icons and descriptions
 * - Click to add node to canvas
 * - Collapsible panel for space efficiency
 */

'use client';

import React from 'react';
import {
  Globe,
  MousePointerClick,
  Type as TypeIcon,
  FileSearch,
  Clock,
  GitBranch,
  ChevronLeft,
  Plus,
} from 'lucide-react';
import { NodeType, useWorkflowBuilderStore } from '@/stores/workflow-builder-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NodeTypeDefinition {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'action' | 'data' | 'control';
  estimatedCredits: number;
}

/**
 * Available node types with metadata
 */
const NODE_TYPES: NodeTypeDefinition[] = [
  {
    type: 'navigate',
    label: 'Navigate',
    description: 'Navigate to a URL',
    icon: Globe,
    category: 'action',
    estimatedCredits: 10,
  },
  {
    type: 'click',
    label: 'Click',
    description: 'Click an element on the page',
    icon: MousePointerClick,
    category: 'action',
    estimatedCredits: 5,
  },
  {
    type: 'type',
    label: 'Type Text',
    description: 'Type text into an input field',
    icon: TypeIcon,
    category: 'action',
    estimatedCredits: 5,
  },
  {
    type: 'extract',
    label: 'Extract Data',
    description: 'Extract text from an element',
    icon: FileSearch,
    category: 'data',
    estimatedCredits: 10,
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Wait for a specified duration',
    icon: Clock,
    category: 'control',
    estimatedCredits: 2,
  },
  {
    type: 'conditional',
    label: 'Conditional',
    description: 'Execute based on a condition',
    icon: GitBranch,
    category: 'control',
    estimatedCredits: 5,
  },
];

/**
 * Node Type Card Component
 */
function NodeTypeCard({ nodeType, onClick }: { nodeType: NodeTypeDefinition; onClick: () => void }) {
  const Icon = nodeType.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'w-full p-3 rounded-lg border-2 border-dashed',
              'border-muted hover:border-primary',
              'bg-background hover:bg-accent',
              'transition-all duration-200',
              'cursor-pointer group',
              'text-left'
            )}
            aria-label={`Add ${nodeType.label} step`}
            data-node-type={nodeType.type}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={cn(
                'p-2 rounded-md bg-muted',
                'group-hover:bg-primary/10 group-hover:text-primary',
                'transition-colors'
              )}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">{nodeType.label}</span>
                  <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {nodeType.description}
                </p>
              </div>
            </div>

            {/* Credit Cost */}
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">{nodeType.category}</span>
              <span>~{nodeType.estimatedCredits} credits</span>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{nodeType.description}</p>
          <p className="text-xs text-muted-foreground mt-1">Click to add to canvas</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * WorkflowNodePalette Component
 */
export function WorkflowNodePalette() {
  const addNode = useWorkflowBuilderStore((state) => state.addNode);
  const isPaletteOpen = useWorkflowBuilderStore((state) => state.isPalettePanelOpen);
  const togglePalette = useWorkflowBuilderStore((state) => state.togglePalettePanel);

  const handleAddNode = (type: NodeType) => {
    addNode(type);
  };

  // Group nodes by category
  const actionNodes = NODE_TYPES.filter((n) => n.category === 'action');
  const dataNodes = NODE_TYPES.filter((n) => n.category === 'data');
  const controlNodes = NODE_TYPES.filter((n) => n.category === 'control');

  return (
    <div
      className={cn(
        'h-full border-r bg-background transition-all duration-300',
        isPaletteOpen ? 'w-64' : 'w-12'
      )}
    >
      {/* Collapse Toggle */}
      <div className="flex items-center justify-between p-3 border-b">
        {isPaletteOpen && (
          <h3 className="text-sm font-semibold">Step Library</h3>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePalette}
          className="ml-auto"
          aria-label={isPaletteOpen ? 'Collapse palette' : 'Expand palette'}
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              !isPaletteOpen && 'rotate-180'
            )}
          />
        </Button>
      </div>

      {/* Palette Content */}
      {isPaletteOpen && (
        <div className="p-3 space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
          {/* Action Steps */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Actions
            </h4>
            <div className="space-y-2">
              {actionNodes.map((nodeType) => (
                <NodeTypeCard
                  key={nodeType.type}
                  nodeType={nodeType}
                  onClick={() => handleAddNode(nodeType.type)}
                />
              ))}
            </div>
          </div>

          {/* Data Steps */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Data
            </h4>
            <div className="space-y-2">
              {dataNodes.map((nodeType) => (
                <NodeTypeCard
                  key={nodeType.type}
                  nodeType={nodeType}
                  onClick={() => handleAddNode(nodeType.type)}
                />
              ))}
            </div>
          </div>

          {/* Control Steps */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Control Flow
            </h4>
            <div className="space-y-2">
              {controlNodes.map((nodeType) => (
                <NodeTypeCard
                  key={nodeType.type}
                  nodeType={nodeType}
                  onClick={() => handleAddNode(nodeType.type)}
                />
              ))}
            </div>
          </div>

          {/* Help Text */}
          <Card className="bg-muted/50">
            <CardHeader className="p-3">
              <CardTitle className="text-xs">Quick Tip</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Click any step to add it to your workflow. Steps execute from top to bottom.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collapsed State - Vertical Icons */}
      {!isPaletteOpen && (
        <div className="flex flex-col items-center gap-4 py-4">
          {NODE_TYPES.slice(0, 4).map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <TooltipProvider key={nodeType.type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAddNode(nodeType.type)}
                      className="h-8 w-8"
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{nodeType.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}
    </div>
  );
}
