/**
 * WorkflowCanvasToolbar Component
 *
 * Toolbar with workflow controls:
 * - Save workflow
 * - Zoom controls
 * - Credit estimate
 * - Test run
 * - Clear workflow
 */

'use client';

import React, { useState } from 'react';
import { useWorkflowBuilderStore, useIsWorkflowValid } from '@/stores/workflow-builder-store';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Trash2,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Calculate estimated credits for workflow
 */
function estimateWorkflowCredits(nodes: any[]): number {
  let total = 50; // Base workflow cost
  total += nodes.length * 5; // Per step

  nodes.forEach((node) => {
    if (node.type === 'extract') total += 10; // AI extraction
    if (node.config.onError === 'ai_recovery') total += 20; // AI recovery
  });

  return total;
}

/**
 * Credit Estimate Display
 */
function CreditEstimate() {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const estimate = estimateWorkflowCredits(nodes);
  const monthlyEstimate = estimate * 30; // Assuming daily runs

  const breakdown = [
    { label: 'Base workflow', credits: 50 },
    { label: `${nodes.length} steps`, credits: nodes.length * 5 },
  ];

  // Add AI-specific costs
  const extractSteps = nodes.filter((n) => n.type === 'extract').length;
  if (extractSteps > 0) {
    breakdown.push({ label: `${extractSteps} extract steps`, credits: extractSteps * 10 });
  }

  const aiRecoverySteps = nodes.filter((n) => n.config.onError === 'ai_recovery').length;
  if (aiRecoverySteps > 0) {
    breakdown.push({ label: `${aiRecoverySteps} AI recovery`, credits: aiRecoverySteps * 20 });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="text-sm">~{estimate} credits/run</span>
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">Credit Breakdown</h4>
            <div className="space-y-1 text-sm">
              {breakdown.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span>{item.credits} credits</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between font-medium">
              <span>Per run:</span>
              <span>{estimate} credits</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>Monthly (daily):</span>
              <span>~{monthlyEstimate} credits</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Save Workflow Dialog
 */
function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
}) {
  const workflowName = useWorkflowBuilderStore((state) => state.workflowName);
  const workflowDescription = useWorkflowBuilderStore((state) => state.workflowDescription);

  const [name, setName] = useState(workflowName);
  const [description, setDescription] = useState(workflowDescription);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name, description);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Workflow</DialogTitle>
          <DialogDescription>
            Give your workflow a name and description
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-name">Workflow Name *</Label>
            <Input
              id="workflow-name"
              placeholder="My Workflow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-description">Description (optional)</Label>
            <Textarea
              id="workflow-description"
              placeholder="What does this workflow do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="mr-2 h-4 w-4" />
            Save Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * WorkflowCanvasToolbar Component
 */
export function WorkflowCanvasToolbar({
  onSave,
  onTestRun,
  onClear,
  onUseTemplate,
}: {
  onSave?: (name: string, description: string) => Promise<void>;
  onTestRun?: () => Promise<void>;
  onClear?: () => void;
  onUseTemplate?: () => void;
}) {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const workflowName = useWorkflowBuilderStore((state) => state.workflowName);
  const zoom = useWorkflowBuilderStore((state) => state.zoom);
  const setZoom = useWorkflowBuilderStore((state) => state.setZoom);
  const resetView = useWorkflowBuilderStore((state) => state.resetView);
  const clearWorkflow = useWorkflowBuilderStore((state) => state.clearWorkflow);
  const isValid = useIsWorkflowValid();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async (name: string, description: string) => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(name, description);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTestRun = async () => {
    if (onTestRun) {
      setIsTesting(true);
      try {
        await onTestRun();
      } finally {
        setIsTesting(false);
      }
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the workflow? This cannot be undone.')) {
      clearWorkflow();
      if (onClear) onClear();
    }
  };

  return (
    <>
      <div className="h-16 border-b bg-background flex items-center justify-between px-4">
        {/* Left Side - Workflow Name */}
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {workflowName || 'Untitled Workflow'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {nodes.length} {nodes.length === 1 ? 'step' : 'steps'}
          </span>
        </div>

        {/* Right Side - Controls */}
        <div className="flex items-center gap-2">
          {/* Use Template Button */}
          {onUseTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUseTemplate}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Use Template
            </Button>
          )}

          {/* Credit Estimate */}
          {nodes.length > 0 && <CreditEstimate />}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom - 0.1)}
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={resetView}
              aria-label="Reset zoom"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom + 0.1)}
              disabled={zoom >= 2.0}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          {nodes.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleClear}
                size="sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>

              {onTestRun && (
                <Button
                  variant="outline"
                  onClick={handleTestRun}
                  disabled={!isValid || isTesting}
                  size="sm"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Test Run
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={() => setShowSaveDialog(true)}
                disabled={!isValid || isSaving}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <SaveWorkflowDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
      />
    </>
  );
}
