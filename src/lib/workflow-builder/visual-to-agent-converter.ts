/**
 * Visual Workflow to Agent Executor Converter
 *
 * Converts visual workflow builder steps into AgentExecutor execution plans
 * This bridges the gap between the drag-and-drop UI and the AI agent system
 */

import { CanvasNode } from '@/stores/workflow-builder-store';
import { ExecutionPlan, ExecutionStep } from '@/lib/agent/types';

/**
 * Convert visual workflow nodes to agent execution plan
 */
export function convertVisualWorkflowToAgentPlan(
  taskId: string,
  nodes: CanvasNode[],
  workflowName: string,
  workflowDescription: string
): ExecutionPlan {
  // Sort nodes by Y-coordinate (execution order)
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

  // Convert each visual node to agent execution step
  const steps: ExecutionStep[] = sortedNodes.map((node, index) => {
    return convertNodeToExecutionStep(taskId, node, index);
  });

  // Estimate total credits
  const estimatedCredits = estimateAgentCredits(steps);

  // Estimate duration (rough estimate: 2-5 seconds per step)
  const estimatedDuration = steps.length * 3500; // milliseconds

  return {
    taskId,
    steps,
    totalSteps: steps.length,
    estimatedCredits,
    estimatedDuration,
    metadata: {
      workflowName,
      workflowDescription,
      visualLayout: nodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })),
    },
  };
}

/**
 * Convert a single visual node to an agent execution step
 */
function convertNodeToExecutionStep(
  taskId: string,
  node: CanvasNode,
  index: number
): ExecutionStep {
  const stepId = `${taskId}_step_${index + 1}`;

  // Map visual node type to agent tool and action
  const { tool, action, params } = mapNodeToToolAction(node);

  // Calculate estimated credits for this step
  const estimatedCredits = estimateStepCredits(node);

  // Estimated duration based on step type
  const estimatedDuration = estimateStepDuration(node.type);

  return {
    id: stepId,
    stepNumber: index + 1,
    action,
    description: getStepDescription(node),
    tool,
    params,
    dependencies: index > 0 ? [`${taskId}_step_${index}`] : [], // Depends on previous step
    retryable: node.config.onError === 'retry' || node.config.onError === 'ai_recovery',
    requiresApproval: false, // Could be configurable in advanced mode
    estimatedCredits,
    estimatedDuration,
    metadata: {
      nodeId: node.id,
      nodeType: node.type,
      errorHandling: node.config.onError,
      maxRetries: node.config.maxRetries,
      saveOutput: node.config.saveOutput,
      outputName: node.config.outputName,
    },
  };
}

/**
 * Map visual node to agent tool and parameters
 */
function mapNodeToToolAction(node: CanvasNode): {
  tool: string;
  action: string;
  params: any;
} {
  switch (node.type) {
    case 'navigate':
      return {
        tool: 'browser',
        action: 'browser.navigate',
        params: {
          url: node.config.action.url,
        },
      };

    case 'click':
      return {
        tool: 'browser',
        action: 'browser.click',
        params: {
          selector: node.config.action.selector,
        },
      };

    case 'type':
      return {
        tool: 'browser',
        action: 'browser.type',
        params: {
          selector: node.config.action.selector,
          text: node.config.action.value,
        },
      };

    case 'extract':
      return {
        tool: 'browser',
        action: 'browser.extract',
        params: {
          selector: node.config.action.selector,
          saveAs: node.config.outputName || 'extractedValue',
        },
      };

    case 'wait':
      return {
        tool: 'browser',
        action: 'browser.waitFor',
        params: {
          duration: node.config.action.duration,
        },
      };

    case 'conditional':
      return {
        tool: 'control',
        action: 'control.conditional',
        params: {
          variable: node.config.condition?.variable,
          operator: node.config.condition?.operator,
          value: node.config.condition?.value,
          skipIfFalse: node.config.skipIfFalse,
        },
      };

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Get human-readable description for step
 */
function getStepDescription(node: CanvasNode): string {
  switch (node.type) {
    case 'navigate':
      return `Navigate to ${node.config.action.url}`;
    case 'click':
      return `Click element: ${node.config.action.selector}`;
    case 'type':
      return `Type text into ${node.config.action.selector}`;
    case 'extract':
      return `Extract data from ${node.config.action.selector}`;
    case 'wait':
      return `Wait ${node.config.action.duration}ms`;
    case 'conditional':
      return `Check if ${node.config.condition?.variable} ${node.config.condition?.operator} ${node.config.condition?.value}`;
    default:
      return 'Unknown action';
  }
}

/**
 * Estimate credits for a single step
 */
function estimateStepCredits(node: CanvasNode): number {
  let credits = 5; // Base per-step cost

  switch (node.type) {
    case 'navigate':
      credits = 10;
      break;
    case 'extract':
      credits = 10;
      break;
    case 'click':
    case 'type':
      credits = 5;
      break;
    case 'wait':
      credits = 2;
      break;
    case 'conditional':
      credits = 5;
      break;
  }

  // Add AI recovery cost if enabled
  if (node.config.onError === 'ai_recovery') {
    credits += 20; // Potential AI recovery cost
  }

  return credits;
}

/**
 * Estimate duration for a step (milliseconds)
 */
function estimateStepDuration(nodeType: string): number {
  switch (nodeType) {
    case 'navigate':
      return 5000; // 5 seconds for page load
    case 'click':
    case 'type':
      return 2000; // 2 seconds for interaction
    case 'extract':
      return 3000; // 3 seconds for extraction
    case 'wait':
      return 1000; // Variable, but default 1 second
    case 'conditional':
      return 500; // Quick evaluation
    default:
      return 2000;
  }
}

/**
 * Estimate total credits for all steps
 */
function estimateAgentCredits(steps: ExecutionStep[]): number {
  const baseWorkflow = 50; // Base workflow execution cost
  const stepsTotal = steps.reduce((sum, step) => sum + (step.estimatedCredits || 0), 0);
  return baseWorkflow + stepsTotal;
}

/**
 * Create agent task from visual workflow
 */
export function createAgentTaskFromVisualWorkflow(
  userId: string,
  nodes: CanvasNode[],
  workflowName: string,
  workflowDescription: string
): {
  type: 'browser_automation';
  goal: string;
  config: any;
  context: any;
} {
  return {
    type: 'browser_automation',
    goal: workflowDescription || `Execute workflow: ${workflowName}`,
    config: {
      model: 'claude-sonnet-4-5-20250929',
      maxSteps: nodes.length + 5, // Allow some extra steps for retries
      timeout: 120000, // 2 minutes
      retryCount: 3,
    },
    context: {
      workflowName,
      workflowDescription,
      visualWorkflow: true,
      nodes: nodes.map(n => ({
        type: n.type,
        config: n.config,
      })),
    },
  };
}
