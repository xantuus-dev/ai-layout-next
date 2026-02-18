/**
 * Workflow Converter Utilities
 *
 * Convert between visual canvas nodes and database workflow steps
 * - CanvasNode[] → WorkflowStep[] (for saving to database)
 * - WorkflowStep[] → CanvasNode[] (for loading from database)
 * - Validation and error checking
 */

import { CanvasNode, NodeType } from '@/stores/workflow-builder-store';

/**
 * Workflow Step for database (matches Prisma schema)
 */
export interface WorkflowStepCreate {
  order: number;
  type: string;
  action: any; // JSON
  onError: string;
  maxRetries: number;
  retryDelay: number;
  condition?: any; // JSON
  skipIfFalse: boolean;
  saveOutput: boolean;
  outputName?: string;
}

/**
 * Workflow data structure
 */
export interface WorkflowData {
  name: string;
  description: string;
  steps: WorkflowStepCreate[];
  visualLayout?: {
    nodes: Array<{ id: string; x: number; y: number }>;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Convert visual canvas nodes to database workflow steps
 * Nodes are sorted by Y-coordinate (top to bottom = execution order)
 */
export function convertToWorkflowSteps(nodes: CanvasNode[]): WorkflowStepCreate[] {
  // Sort by Y-coordinate (top to bottom)
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

  return sortedNodes.map((node, index) => ({
    order: index,
    type: node.type,
    action: node.config.action,
    onError: node.config.onError,
    maxRetries: node.config.maxRetries,
    retryDelay: node.config.retryDelay,
    condition: node.config.condition,
    skipIfFalse: node.config.skipIfFalse,
    saveOutput: node.config.saveOutput,
    outputName: node.config.outputName,
  }));
}

/**
 * Convert database workflow steps to visual canvas nodes
 */
export function convertFromWorkflowSteps(
  steps: any[], // Prisma WorkflowStep[]
  visualLayout?: { nodes: Array<{ id: string; x: number; y: number }> }
): CanvasNode[] {
  return steps.map((step, index) => {
    // Try to get saved position from visualLayout
    const savedPosition = visualLayout?.nodes?.find((n) => n.id === step.id);

    // Calculate auto-layout position if no saved position
    const position = savedPosition
      ? { x: savedPosition.x, y: savedPosition.y }
      : { x: 400, y: index * 120 };

    return {
      id: step.id,
      type: step.type as NodeType,
      position,
      config: {
        action: step.action,
        onError: step.onError,
        maxRetries: step.maxRetries,
        retryDelay: step.retryDelay,
        condition: step.condition,
        skipIfFalse: step.skipIfFalse,
        saveOutput: step.saveOutput,
        outputName: step.outputName,
      },
    };
  });
}

/**
 * Validate workflow before saving/executing
 */
export function validateWorkflow(nodes: CanvasNode[], workflowName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have a name
  if (!workflowName.trim()) {
    errors.push('Workflow name is required');
  }

  // Must have at least one step
  if (nodes.length === 0) {
    errors.push('Workflow must have at least one step');
  }

  // Validate each node
  nodes.forEach((node, index) => {
    const stepNumber = index + 1;

    switch (node.type) {
      case 'navigate':
        if (!node.config.action.url) {
          errors.push(`Step ${stepNumber} (Navigate): URL is required`);
        } else {
          // Validate URL format
          try {
            new URL(node.config.action.url);
          } catch {
            errors.push(`Step ${stepNumber} (Navigate): Invalid URL format`);
          }
        }
        break;

      case 'click':
        if (!node.config.action.selector) {
          errors.push(`Step ${stepNumber} (Click): CSS selector is required`);
        }
        break;

      case 'type':
        if (!node.config.action.selector) {
          errors.push(`Step ${stepNumber} (Type): CSS selector is required`);
        }
        if (!node.config.action.value) {
          warnings.push(`Step ${stepNumber} (Type): No text value provided`);
        }
        break;

      case 'extract':
        if (!node.config.action.selector) {
          errors.push(`Step ${stepNumber} (Extract): CSS selector is required`);
        }
        if (node.config.saveOutput && !node.config.outputName) {
          errors.push(`Step ${stepNumber} (Extract): Output variable name is required`);
        }
        break;

      case 'wait':
        if (!node.config.action.duration || node.config.action.duration <= 0) {
          errors.push(`Step ${stepNumber} (Wait): Duration must be greater than 0`);
        }
        break;

      case 'conditional':
        if (!node.config.condition?.variable) {
          errors.push(`Step ${stepNumber} (Conditional): Variable name is required`);
        }
        if (!node.config.condition?.operator) {
          errors.push(`Step ${stepNumber} (Conditional): Operator is required`);
        }
        break;
    }

    // Validate output name format (if saving output)
    if (node.config.saveOutput && node.config.outputName) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(node.config.outputName)) {
        errors.push(
          `Step ${stepNumber}: Invalid variable name '${node.config.outputName}'. Must start with letter or underscore and contain only letters, numbers, and underscores.`
        );
      }
    }

    // Check for duplicate output names
    if (node.config.saveOutput && node.config.outputName) {
      const duplicates = nodes.filter(
        (n) => n.id !== node.id && n.config.outputName === node.config.outputName
      );
      if (duplicates.length > 0) {
        warnings.push(
          `Step ${stepNumber}: Duplicate variable name '${node.config.outputName}'. Later steps will overwrite this value.`
        );
      }
    }
  });

  // Check for unreferenced variables
  const definedVariables = new Set(
    nodes
      .filter((n) => n.config.saveOutput && n.config.outputName)
      .map((n) => n.config.outputName!)
  );

  nodes.forEach((node, index) => {
    const stepNumber = index + 1;
    const actionJson = JSON.stringify(node.config.action);

    // Find variable references like {{variableName}}
    const variableRefs = actionJson.match(/\{\{(\w+)\}\}/g);
    if (variableRefs) {
      variableRefs.forEach((ref) => {
        const varName = ref.slice(2, -2); // Remove {{ and }}
        if (!definedVariables.has(varName)) {
          warnings.push(
            `Step ${stepNumber}: References undefined variable '${varName}'. Make sure it's defined in a previous step.`
          );
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extract visual layout from nodes (for saving positions)
 */
export function extractVisualLayout(nodes: CanvasNode[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
    })),
  };
}

/**
 * Create workflow data object for API submission
 */
export function createWorkflowData(
  nodes: CanvasNode[],
  workflowName: string,
  workflowDescription: string
): WorkflowData {
  return {
    name: workflowName,
    description: workflowDescription,
    steps: convertToWorkflowSteps(nodes),
    visualLayout: extractVisualLayout(nodes),
  };
}

/**
 * Estimate total credits for workflow execution
 */
export function estimateWorkflowCredits(nodes: CanvasNode[]): {
  total: number;
  breakdown: Array<{ label: string; credits: number }>;
} {
  const breakdown: Array<{ label: string; credits: number }> = [];
  let total = 0;

  // Base workflow cost
  const baseCost = 50;
  breakdown.push({ label: 'Base workflow', credits: baseCost });
  total += baseCost;

  // Per-step cost
  const stepCost = nodes.length * 5;
  breakdown.push({ label: `${nodes.length} steps`, credits: stepCost });
  total += stepCost;

  // Extract steps (AI processing)
  const extractSteps = nodes.filter((n) => n.type === 'extract').length;
  if (extractSteps > 0) {
    const extractCost = extractSteps * 10;
    breakdown.push({ label: `${extractSteps} extract steps`, credits: extractCost });
    total += extractCost;
  }

  // AI recovery
  const aiRecoverySteps = nodes.filter((n) => n.config.onError === 'ai_recovery').length;
  if (aiRecoverySteps > 0) {
    const recoveryCost = aiRecoverySteps * 20;
    breakdown.push({
      label: `${aiRecoverySteps} AI recovery (potential)`,
      credits: recoveryCost,
    });
    total += recoveryCost;
  }

  return { total, breakdown };
}
