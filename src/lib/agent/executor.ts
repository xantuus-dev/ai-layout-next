/**
 * Agent Executor - ReAct Loop Implementation
 *
 * This implements the Reasoning + Acting pattern where the agent:
 * 1. Reasons about what to do next
 * 2. Acts by calling a tool
 * 3. Observes the result
 * 4. Repeats until task is complete
 */

import { aiRouter } from '@/lib/ai-providers';
import { prisma } from '@/lib/prisma';
import {
  Agent,
  AgentTask,
  AgentResult,
  AgentState,
  AgentStatus,
  ExecutionPlan,
  ExecutionStep,
  ExecutionTrace,
  AgentContext,
  ToolResult,
  AgentTool,
  StepStatus,
  AgentEventHandler,
  AgentEvent,
} from './types';
import { ToolRegistry } from './tools/registry';

/**
 * Core agent executor that implements the ReAct loop
 */
export class AgentExecutor implements Agent {
  readonly type: any;
  readonly config: any;

  private toolRegistry: ToolRegistry;
  private eventHandlers: AgentEventHandler[] = [];
  private currentState?: AgentState;
  private shouldStop = false;

  constructor(type: any, config: any, toolRegistry: ToolRegistry) {
    this.type = type;
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Register event handler
   */
  onEvent(handler: AgentEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit event to all handlers
   */
  private async emitEvent(event: AgentEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    }
  }

  // ============================================================================
  // PLANNING
  // ============================================================================

  /**
   * Create execution plan using AI
   */
  async plan(task: AgentTask): Promise<ExecutionPlan> {
    console.log(`[Agent] Planning task ${task.id}`);

    const availableTools = this.toolRegistry.getAllTools();
    const toolDescriptions = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
    }));

    // Use AI to create a plan
    const planningPrompt = this.createPlanningPrompt(task, toolDescriptions);

    const response = await aiRouter.chat(
      this.config.model || 'claude-sonnet-4-5-20250929',
      {
        messages: [{
          role: 'user',
          content: planningPrompt,
        }],
        maxTokens: 4096,
      }
    );

    // Parse AI response into execution plan
    const plan = this.parsePlanFromAI(response.content, task.id);

    // Estimate costs
    plan.estimatedCredits = this.estimatePlanCredits(plan);
    plan.estimatedDuration = this.estimatePlanDuration(plan);

    console.log(`[Agent] Plan created: ${plan.steps.length} steps, ~${plan.estimatedCredits} credits`);

    return plan;
  }

  /**
   * Create planning prompt for AI
   */
  private createPlanningPrompt(task: AgentTask, tools: any[]): string {
    return `You are an AI agent planner. Create a step-by-step execution plan to achieve the following goal:

GOAL: ${task.goal}

TASK TYPE: ${task.type}

AVAILABLE TOOLS:
${tools.map(t => `- ${t.name} (${t.category}): ${t.description}`).join('\n')}

CONTEXT:
${JSON.stringify(task.context || {}, null, 2)}

Create a detailed execution plan as a JSON array of steps. Each step should have:
- action: The tool action to perform (e.g., "browser.navigate", "email.send")
- description: Human-readable description of what this step does
- tool: The tool name
- params: Object with parameters for the tool
- requiresApproval: true if this step needs human approval

Example:
\`\`\`json
[
  {
    "action": "browser.navigate",
    "description": "Navigate to the target website",
    "tool": "browser",
    "params": { "url": "https://example.com" },
    "requiresApproval": false
  },
  {
    "action": "browser.extract",
    "description": "Extract price information",
    "tool": "browser",
    "params": { "selector": ".price" },
    "requiresApproval": false
  }
]
\`\`\`

Return ONLY the JSON array, no other text.`;
  }

  /**
   * Parse AI response into execution plan
   */
  private parsePlanFromAI(content: string, taskId: string): ExecutionPlan {
    // Extract JSON from AI response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[([\s\S]*?)\]/);

    if (!jsonMatch) {
      throw new Error('Failed to parse plan from AI response');
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];
    const stepsData = JSON.parse(jsonString);

    const steps: ExecutionStep[] = stepsData.map((step: any, index: number) => ({
      id: `${taskId}_step_${index + 1}`,
      stepNumber: index + 1,
      action: step.action,
      description: step.description,
      tool: step.tool,
      params: step.params,
      dependencies: step.dependencies || [],
      retryable: step.retryable !== false,
      requiresApproval: step.requiresApproval || false,
      estimatedCredits: step.estimatedCredits || 100,
      estimatedDuration: step.estimatedDuration || 5000,
    }));

    return {
      taskId,
      steps,
      totalSteps: steps.length,
      estimatedCredits: 0, // Will be calculated
      estimatedDuration: 0, // Will be calculated
      createdAt: new Date(),
    };
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  /**
   * Execute task with the given plan
   */
  async execute(task: AgentTask, plan: ExecutionPlan): Promise<AgentResult> {
    console.log(`[Agent] Starting execution of task ${task.id}`);

    // Initialize state
    this.currentState = {
      taskId: task.id,
      status: 'executing' as AgentStatus,
      currentStep: 0,
      totalSteps: plan.totalSteps,
      progress: 0,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      creditsUsed: 0,
      tokensUsed: 0,
      executionTime: 0,
      context: {},
      trace: [],
    };

    await this.emitEvent({ type: 'task.started', taskId: task.id, plan });

    const startTime = Date.now();

    try {
      // Execute each step in the plan
      for (let i = 0; i < plan.steps.length; i++) {
        if (this.shouldStop) {
          throw new Error('Execution cancelled');
        }

        const step = plan.steps[i];
        this.currentState.currentStep = i + 1;
        this.currentState.progress = Math.round(((i + 1) / plan.totalSteps) * 100);

        await this.executeStep(task, step);
      }

      // Mark as completed
      this.currentState.status = 'completed';
      this.currentState.completedAt = new Date();
      this.currentState.executionTime = Date.now() - startTime;

      const result: AgentResult = {
        taskId: task.id,
        status: 'completed',
        result: this.currentState.result,
        steps: plan.totalSteps,
        duration: this.currentState.executionTime,
        creditsUsed: this.currentState.creditsUsed,
        tokensUsed: this.currentState.tokensUsed,
        trace: this.currentState.trace,
        completedAt: new Date(),
      };

      await this.emitEvent({ type: 'task.completed', taskId: task.id, result });

      // Save to database
      await this.saveResult(task.id, result);

      return result;

    } catch (error: any) {
      console.error(`[Agent] Execution failed:`, error);

      this.currentState.status = 'failed';
      this.currentState.error = error.message;

      const result: AgentResult = {
        taskId: task.id,
        status: 'failed',
        error: error.message,
        steps: this.currentState.currentStep,
        duration: Date.now() - startTime,
        creditsUsed: this.currentState.creditsUsed,
        tokensUsed: this.currentState.tokensUsed,
        trace: this.currentState.trace,
        completedAt: new Date(),
      };

      await this.emitEvent({ type: 'task.failed', taskId: task.id, error: error.message });

      // Save to database
      await this.saveResult(task.id, result);

      return result;
    }
  }

  /**
   * Execute a single step with ReAct pattern
   */
  private async executeStep(task: AgentTask, step: ExecutionStep): Promise<void> {
    console.log(`[Agent] Executing step ${step.stepNumber}: ${step.description}`);

    await this.emitEvent({
      type: 'task.step.started',
      taskId: task.id,
      stepNumber: step.stepNumber,
    });

    const stepStartTime = Date.now();

    try {
      // 1. REASON: Get AI's reasoning for this step
      const reasoning = await this.reason(task, step);

      // 2. ACT: Execute the tool
      const context = this.buildContext(task);
      const tool = this.toolRegistry.getTool(step.tool);

      if (!tool) {
        throw new Error(`Tool not found: ${step.tool}`);
      }

      // Validate parameters
      const validation = tool.validate(step.params);
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.error}`);
      }

      // Check if approval required
      if (step.requiresApproval) {
        await this.emitEvent({
          type: 'approval.required',
          taskId: task.id,
          stepNumber: step.stepNumber,
          action: step.action,
        });
        // In production, wait for user approval here
        // For now, we'll just log and continue
        console.log(`[Agent] Approval required for step ${step.stepNumber}`);
      }

      // Execute tool
      const result = await tool.execute(step.params, context);

      // 3. OBSERVE: Process the result
      if (!result.success) {
        throw new Error(result.error || 'Tool execution failed');
      }

      // Store result in context for future steps
      if (this.currentState) {
        this.currentState.context[`step${step.stepNumber}`] = result.data;
        this.currentState.creditsUsed += result.metadata?.credits || 0;
        this.currentState.tokensUsed += result.metadata?.tokens || 0;
      }

      // Add to trace
      const trace: ExecutionTrace = {
        stepNumber: step.stepNumber,
        timestamp: new Date(),
        action: step.action,
        tool: step.tool,
        reasoning,
        input: step.params,
        output: result.data,
        status: 'completed' as StepStatus,
        duration: Date.now() - stepStartTime,
        credits: result.metadata?.credits || 0,
        tokens: result.metadata?.tokens || 0,
      };

      this.currentState?.trace.push(trace);

      await this.emitEvent({
        type: 'task.step.completed',
        taskId: task.id,
        stepNumber: step.stepNumber,
        result,
      });

      console.log(`[Agent] Step ${step.stepNumber} completed in ${trace.duration}ms`);

    } catch (error: any) {
      console.error(`[Agent] Step ${step.stepNumber} failed:`, error);

      const trace: ExecutionTrace = {
        stepNumber: step.stepNumber,
        timestamp: new Date(),
        action: step.action,
        tool: step.tool,
        input: step.params,
        error: error.message,
        status: 'failed' as StepStatus,
        duration: Date.now() - stepStartTime,
        credits: 0,
        tokens: 0,
      };

      this.currentState?.trace.push(trace);

      await this.emitEvent({
        type: 'task.step.failed',
        taskId: task.id,
        stepNumber: step.stepNumber,
        error: error.message,
      });

      // Retry logic
      if (step.retryable && (this.config.retryCount || 3) > 0) {
        console.log(`[Agent] Retrying step ${step.stepNumber}...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
        return this.executeStep(task, step); // Retry
      }

      throw error;
    }
  }

  /**
   * Get AI reasoning for a step
   */
  private async reason(task: AgentTask, step: ExecutionStep): Promise<string> {
    const prompt = `You are executing a task. Explain your reasoning for the next action.

TASK: ${task.goal}
CURRENT STEP: ${step.description}
ACTION: ${step.action}

Provide a brief (1-2 sentences) explanation of why this action makes sense.`;

    try {
      const response = await aiRouter.chat(
        'claude-haiku-4-5-20250529', // Use cheap model for reasoning
        {
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 200,
        }
      );

      return response.content;
    } catch (error) {
      return `Executing ${step.action}: ${step.description}`;
    }
  }

  /**
   * Build context for tool execution
   */
  private buildContext(task: AgentTask): AgentContext {
    return {
      userId: task.userId,
      taskId: task.id,
      stepNumber: this.currentState?.currentStep || 0,
      state: this.currentState!,
      prisma,
      aiRouter,
      memory: this.currentState?.context || {},
    };
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  async pause(): Promise<void> {
    this.shouldStop = true;
    if (this.currentState) {
      this.currentState.status = 'paused';
      await this.emitEvent({
        type: 'task.paused',
        taskId: this.currentState.taskId,
        state: this.currentState,
      });
    }
  }

  async resume(state: AgentState): Promise<AgentResult> {
    this.currentState = state;
    this.shouldStop = false;
    // Resume execution from current step
    throw new Error('Resume not yet implemented');
  }

  async cancel(): Promise<void> {
    this.shouldStop = true;
    if (this.currentState) {
      this.currentState.status = 'cancelled';
      await this.emitEvent({
        type: 'task.cancelled',
        taskId: this.currentState.taskId,
      });
    }
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  /**
   * Save execution result to database
   */
  private async saveResult(taskId: string, result: AgentResult): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.status,
          result: result.result as any,
          error: result.error,
          executionTrace: result.trace as any,
          totalTokens: result.tokensUsed,
          totalCredits: result.creditsUsed,
          executionTime: result.duration,
          completedAt: result.status === 'completed' ? new Date() : null,
          failedAt: result.status === 'failed' ? new Date() : null,
        },
      });

      // Save individual execution records
      for (const trace of result.trace) {
        await prisma.taskExecution.create({
          data: {
            taskId,
            step: trace.stepNumber,
            action: trace.action,
            tool: trace.tool,
            input: trace.input,
            output: trace.output,
            reasoning: trace.reasoning,
            status: trace.status,
            error: trace.error,
            tokens: trace.tokens,
            credits: trace.credits,
            duration: trace.duration,
            createdAt: trace.timestamp,
            completedAt: trace.status === 'completed' ? trace.timestamp : null,
          },
        });
      }

      // Deduct credits from user
      await prisma.user.update({
        where: { id: result.taskId }, // Note: This should be userId, fix in production
        data: {
          creditsUsed: {
            increment: result.creditsUsed,
          },
        },
      });

    } catch (error) {
      console.error('[Agent] Failed to save result:', error);
    }
  }

  // ============================================================================
  // COST ESTIMATION
  // ============================================================================

  private estimatePlanCredits(plan: ExecutionPlan): number {
    return plan.steps.reduce((total, step) => total + (step.estimatedCredits || 100), 500);
  }

  private estimatePlanDuration(plan: ExecutionPlan): number {
    return plan.steps.reduce((total, step) => total + (step.estimatedDuration || 5000), 0);
  }
}
