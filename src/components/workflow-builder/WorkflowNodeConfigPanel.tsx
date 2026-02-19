/**
 * WorkflowNodeConfigPanel Component
 *
 * Configuration panel for selected workflow node
 * - Dynamic forms based on node type
 * - Real-time validation
 * - Error handling configuration
 * - Output variable settings
 */

'use client';

import React from 'react';
import { CanvasNode, useWorkflowBuilderStore } from '@/stores/workflow-builder-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowNodeConfigPanelProps {
  node: CanvasNode;
}

/**
 * Navigate Node Configuration
 */
function NavigateConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        action: {
          ...node.config.action,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="url">Target URL *</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://example.com"
          value={node.config.action.url || ''}
          onChange={(e) => handleUpdate('url', e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          The webpage to navigate to
        </p>
      </div>
    </div>
  );
}

/**
 * Click Node Configuration
 */
function ClickConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        action: {
          ...node.config.action,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="selector">CSS Selector *</Label>
        <Input
          id="selector"
          placeholder=".button, #submit, button[type='submit']"
          value={node.config.action.selector || ''}
          onChange={(e) => handleUpdate('selector', e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          CSS selector of the element to click
        </p>
      </div>
    </div>
  );
}

/**
 * Type Node Configuration
 */
function TypeConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        action: {
          ...node.config.action,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="selector">Input Selector *</Label>
        <Input
          id="selector"
          placeholder="#email, input[name='username']"
          value={node.config.action.selector || ''}
          onChange={(e) => handleUpdate('selector', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="value">Text to Type</Label>
        <Textarea
          id="value"
          placeholder="Text to enter"
          value={node.config.action.value || ''}
          onChange={(e) => handleUpdate('value', e.target.value)}
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supports variables like {`{{variableName}}`}
        </p>
      </div>
    </div>
  );
}

/**
 * Extract Node Configuration
 */
function ExtractConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        action: {
          ...node.config.action,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="selector">Element Selector *</Label>
        <Input
          id="selector"
          placeholder=".price, #product-title, .description"
          value={node.config.action.selector || ''}
          onChange={(e) => handleUpdate('selector', e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * Wait Node Configuration
 */
function WaitConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        action: {
          ...node.config.action,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="duration">Duration (milliseconds)</Label>
        <Input
          id="duration"
          type="number"
          min="0"
          step="100"
          value={node.config.action.duration || 1000}
          onChange={(e) => handleUpdate('duration', parseInt(e.target.value))}
        />
        <p className="text-xs text-muted-foreground mt-1">
          1000ms = 1 second
        </p>
      </div>
    </div>
  );
}

/**
 * Conditional Node Configuration
 */
function ConditionalConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        condition: {
          variable: node.config.condition?.variable || '',
          operator: node.config.condition?.operator || 'equals',
          value: node.config.condition?.value || '',
          ...node.config.condition,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="variable">Variable Name *</Label>
        <Input
          id="variable"
          placeholder="price, status, result"
          value={node.config.condition?.variable || ''}
          onChange={(e) => handleUpdate('variable', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="operator">Operator</Label>
        <Select
          value={node.config.condition?.operator || 'equals'}
          onValueChange={(value) => handleUpdate('operator', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="notEquals">Not Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="greaterThan">Greater Than</SelectItem>
            <SelectItem value="lessThan">Less Than</SelectItem>
            <SelectItem value="exists">Exists</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="value">Comparison Value</Label>
        <Input
          id="value"
          placeholder="Value to compare"
          value={node.config.condition?.value || ''}
          onChange={(e) => handleUpdate('value', e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * Error Handling Configuration (Common)
 */
function ErrorHandlingConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h4 className="font-medium text-sm">Error Handling</h4>

      <div>
        <Label htmlFor="onError">On Error</Label>
        <Select
          value={node.config.onError}
          onValueChange={(value) => handleUpdate('onError', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="retry">Retry</SelectItem>
            <SelectItem value="continue">Continue</SelectItem>
            <SelectItem value="stop">Stop Workflow</SelectItem>
            <SelectItem value="ai_recovery">AI Recovery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {node.config.onError === 'retry' && (
        <>
          <div>
            <Label htmlFor="maxRetries">Max Retries</Label>
            <Input
              id="maxRetries"
              type="number"
              min="1"
              max="10"
              value={node.config.maxRetries}
              onChange={(e) => handleUpdate('maxRetries', parseInt(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="retryDelay">Retry Delay (ms)</Label>
            <Input
              id="retryDelay"
              type="number"
              min="0"
              step="100"
              value={node.config.retryDelay}
              onChange={(e) => handleUpdate('retryDelay', parseInt(e.target.value))}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Output Configuration (Common)
 */
function OutputConfig({ node }: { node: CanvasNode }) {
  const updateNode = useWorkflowBuilderStore((state) => state.updateNode);

  const handleUpdate = (key: string, value: any) => {
    updateNode(node.id, {
      config: {
        ...node.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h4 className="font-medium text-sm">Output</h4>

      <div className="flex items-center justify-between">
        <Label htmlFor="saveOutput">Save Output</Label>
        <Switch
          id="saveOutput"
          checked={node.config.saveOutput}
          onCheckedChange={(checked) => handleUpdate('saveOutput', checked)}
        />
      </div>

      {node.config.saveOutput && (
        <div>
          <Label htmlFor="outputName">Variable Name</Label>
          <Input
            id="outputName"
            placeholder="myVariable"
            value={node.config.outputName || ''}
            onChange={(e) => handleUpdate('outputName', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use {`{{${node.config.outputName}}}`} in later steps
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main Config Panel Component
 */
export function WorkflowNodeConfigPanel({ node }: WorkflowNodeConfigPanelProps) {
  const selectNode = useWorkflowBuilderStore((state) => state.selectNode);

  // Render config form based on node type
  const renderTypeConfig = () => {
    switch (node.type) {
      case 'navigate':
        return <NavigateConfig node={node} />;
      case 'click':
        return <ClickConfig node={node} />;
      case 'type':
        return <TypeConfig node={node} />;
      case 'extract':
        return <ExtractConfig node={node} />;
      case 'wait':
        return <WaitConfig node={node} />;
      case 'conditional':
        return <ConditionalConfig node={node} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Configure Step</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => selectNode(null)}
          aria-label="Close configuration panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Type-specific configuration */}
        {renderTypeConfig()}

        {/* Error handling (common) */}
        <ErrorHandlingConfig node={node} />

        {/* Output configuration (common for extract/navigate/etc) */}
        {(node.type === 'extract' || node.type === 'navigate' || node.type === 'click') && (
          <OutputConfig node={node} />
        )}
      </div>
    </div>
  );
}
