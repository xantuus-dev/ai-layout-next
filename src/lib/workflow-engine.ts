/**
 * Workflow Execution Engine
 *
 * Executes browser automation workflows with:
 * - Sequential step execution
 * - Variable storage and substitution
 * - Conditional logic
 * - AI-powered error recovery
 * - Execution state tracking
 */

import { prisma } from './prisma';
import { browserControl } from './browser-control';
import { aiRouter } from './ai-providers/router';
import { calculateWorkflowCredits } from './credits';

export interface WorkflowStep {
  id: string;
  order: number;
  type: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'conditional' | 'loop';
  action: any; // Action-specific parameters
  onError: 'stop' | 'continue' | 'retry' | 'ai_recovery';
  maxRetries: number;
  retryDelay: number;
  condition?: any;
  skipIfFalse: boolean;
  saveOutput: boolean;
  outputName?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  sessionId: string;
  userId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  variables: Record<string, any>;
  executionTrace: Array<StepExecution>;
  aiRecoveries: number;
  startTime: number;
}

export interface StepExecution {
  stepId: string;
  stepOrder: number;
  stepType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  input: any;
  output?: any;
  error?: string;
  aiRecoveryUsed: boolean;
  startTime: number;
  endTime?: number;
}

/**
 * Execute a complete workflow
 */
export async function executeWorkflow(
  workflowId: string,
  sessionId: string,
  userId: string,
  initialVariables: Record<string, any> = {}
): Promise<WorkflowExecution> {
  const startTime = Date.now();

  // Load workflow with steps
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!workflow) {
    throw new Error('Workflow not found');
  }

  if (workflow.userId !== userId) {
    throw new Error('Unauthorized: Workflow does not belong to user');
  }

  // Initialize execution state
  const execution: WorkflowExecution = {
    workflowId,
    sessionId,
    userId,
    status: 'running',
    currentStep: 0,
    totalSteps: workflow.steps.length,
    variables: { ...initialVariables },
    executionTrace: [],
    aiRecoveries: 0,
    startTime,
  };

  // Create execution record in database
  const dbExecution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      status: 'running',
      currentStep: 0,
      totalSteps: workflow.steps.length,
      result: {},
      executionTrace: {},
      aiRecoveryDetail: {},
    },
  });

  try {
    // Execute each step
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      execution.currentStep = i + 1;

      // Update execution in database
      await prisma.workflowExecution.update({
        where: { id: dbExecution.id },
        data: { currentStep: i + 1 },
      });

      const stepExecution = await executeStep(step, execution, sessionId);
      execution.executionTrace.push(stepExecution);

      // Stop if step failed and onError is 'stop'
      if (stepExecution.status === 'failed' && step.onError === 'stop') {
        execution.status = 'failed';
        break;
      }

      // Save output to variables if requested
      if (step.saveOutput && step.outputName && stepExecution.output) {
        execution.variables[step.outputName] = stepExecution.output;
      }
    }

    // Mark as completed if all steps succeeded
    if (execution.currentStep === execution.totalSteps && execution.status === 'running') {
      execution.status = 'completed';
    }
  } catch (error: any) {
    execution.status = 'failed';
    console.error('Workflow execution error:', error);
  }

  // Calculate credits
  const credits = calculateWorkflowCredits(
    execution.totalSteps,
    execution.aiRecoveries
  );

  // Update execution record in database
  await prisma.workflowExecution.update({
    where: { id: dbExecution.id },
    data: {
      status: execution.status,
      completedAt: new Date(),
      result: execution.variables,
      executionTrace: execution.executionTrace as any, // Convert to JSON
      aiRecoveryDetail: { count: execution.aiRecoveries },
      totalCredits: credits,
      duration: Date.now() - startTime,
    },
  });

  // Update workflow stats
  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      totalRuns: { increment: 1 },
      successfulRuns: execution.status === 'completed' ? { increment: 1 } : undefined,
      failedRuns: execution.status === 'failed' ? { increment: 1 } : undefined,
      lastRunAt: new Date(),
    },
  });

  // Log usage
  await prisma.usageRecord.create({
    data: {
      userId,
      type: 'workflow_execution',
      credits,
      metadata: {
        workflowId,
        workflowName: workflow.name,
        status: execution.status,
        steps: execution.totalSteps,
        aiRecoveries: execution.aiRecoveries,
      },
    },
  });

  // Update user credits
  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: { increment: credits },
    },
  });

  return execution;
}

/**
 * Execute a single workflow step
 */
async function executeStep(
  step: any,
  execution: WorkflowExecution,
  sessionId: string
): Promise<StepExecution> {
  const stepExecution: StepExecution = {
    stepId: step.id,
    stepOrder: step.order,
    stepType: step.type,
    status: 'running',
    attempts: 0,
    input: substituteVariables(step.action, execution.variables),
    aiRecoveryUsed: false,
    startTime: Date.now(),
  };

  // Check condition if exists
  if (step.condition) {
    const conditionMet = evaluateCondition(step.condition, execution.variables);
    if (!conditionMet && step.skipIfFalse) {
      stepExecution.status = 'skipped';
      stepExecution.endTime = Date.now();
      return stepExecution;
    }
  }

  // Execute with retries
  let lastError: string | undefined;
  for (let attempt = 0; attempt < step.maxRetries; attempt++) {
    stepExecution.attempts = attempt + 1;

    try {
      const result = await executeAction(step.type, stepExecution.input, sessionId);

      if (result.success) {
        stepExecution.status = 'completed';
        stepExecution.output = result.data;
        stepExecution.endTime = Date.now();
        return stepExecution;
      } else {
        lastError = result.error;

        // Try AI recovery if enabled
        if (step.onError === 'ai_recovery' && attempt < step.maxRetries - 1) {
          const recovered = await attemptAIRecovery(
            step,
            result.error || 'Unknown error',
            execution,
            sessionId
          );

          if (recovered.success) {
            stepExecution.status = 'completed';
            stepExecution.output = recovered.data;
            stepExecution.aiRecoveryUsed = true;
            stepExecution.endTime = Date.now();
            execution.aiRecoveries++;
            return stepExecution;
          }
        }

        // Wait before retry
        if (attempt < step.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, step.retryDelay));
        }
      }
    } catch (error: any) {
      lastError = error.message;
    }
  }

  // All retries failed
  stepExecution.status = 'failed';
  stepExecution.error = lastError;
  stepExecution.endTime = Date.now();

  return stepExecution;
}

/**
 * Execute a specific action type
 */
async function executeAction(
  type: string,
  action: any,
  sessionId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (type) {
      case 'navigate':
        return await browserControl.executeAction(sessionId, {
          type: 'navigate',
          target: action.url,
        });

      case 'click':
        return await browserControl.executeAction(sessionId, {
          type: 'click',
          selector: action.selector,
        });

      case 'type':
        return await browserControl.executeAction(sessionId, {
          type: 'type',
          selector: action.selector,
          value: action.value,
        });

      case 'extract':
        return await browserControl.executeAction(sessionId, {
          type: 'extract',
          selector: action.selector,
        });

      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, action.duration || 1000));
        return { success: true, data: { waited: action.duration } };

      default:
        return { success: false, error: `Unknown action type: ${type}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Attempt AI-powered error recovery
 */
async function attemptAIRecovery(
  step: any,
  error: string,
  execution: WorkflowExecution,
  sessionId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Use AI to suggest alternative selectors or actions
    const recoveryPrompt = `A workflow step failed with this error: "${error}"

Step details:
- Type: ${step.type}
- Action: ${JSON.stringify(step.action, null, 2)}

Suggest an alternative approach to accomplish the same goal. Respond with JSON:
{
  "suggestion": "brief explanation",
  "action": { /* modified action parameters */ }
}`;

    const response = await aiRouter.chat('claude-sonnet-4-5-20250929', {
      messages: [
        { role: 'user', content: recoveryPrompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
    });

    // Parse AI response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'AI recovery failed to generate valid suggestion' };
    }

    const recovery = JSON.parse(jsonMatch[0]);

    // Try the suggested action
    const result = await executeAction(step.type, recovery.action, sessionId);

    return result;
  } catch (error: any) {
    return { success: false, error: `AI recovery failed: ${error.message}` };
  }
}

/**
 * Substitute variables in action parameters
 */
function substituteVariables(action: any, variables: Record<string, any>): any {
  const jsonStr = JSON.stringify(action);
  const substituted = jsonStr.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
  return JSON.parse(substituted);
}

/**
 * Evaluate conditional logic
 */
function evaluateCondition(condition: any, variables: Record<string, any>): boolean {
  try {
    // Simple condition evaluation (can be enhanced)
    const { variable, operator, value } = condition;
    const varValue = variables[variable];

    switch (operator) {
      case 'equals':
        return varValue === value;
      case 'notEquals':
        return varValue !== value;
      case 'contains':
        return String(varValue).includes(value);
      case 'greaterThan':
        return Number(varValue) > Number(value);
      case 'lessThan':
        return Number(varValue) < Number(value);
      case 'exists':
        return varValue !== undefined && varValue !== null;
      default:
        return true;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutions(
  workflowId: string,
  userId: string,
  limit: number = 10
) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow || workflow.userId !== userId) {
    throw new Error('Unauthorized');
  }

  const executions = await prisma.workflowExecution.findMany({
    where: { workflowId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return executions;
}
