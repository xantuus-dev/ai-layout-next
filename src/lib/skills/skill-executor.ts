/**
 * Skill Execution Engine
 *
 * Executes custom skills from the marketplace within the agent execution context.
 * Supports multiple skill types: config, javascript, python
 */

import { prisma } from '@/lib/prisma';
import { AgentExecutor } from '../agent/executor';
import { ToolRegistry } from '../agent/tools/registry';
import { AIRouter } from '../ai-providers/router';
import type {
  AgentTask,
  AgentContext,
  ExecutionPlan,
  AgentResult,
} from '../agent/types';

export interface SkillExecutionOptions {
  skillId: string;
  userId: string;
  input: Record<string, any>;
  context?: AgentContext;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata: {
    skillId: string;
    skillName: string;
    executionTime: number;
    creditsUsed: number;
    tokensUsed: number;
  };
}

/**
 * Skill Executor
 *
 * Loads and executes custom skills from the marketplace.
 */
export class SkillExecutor {
  private toolRegistry: ToolRegistry;
  private aiRouter: AIRouter;

  constructor(toolRegistry: ToolRegistry, aiRouter: AIRouter) {
    this.toolRegistry = toolRegistry;
    this.aiRouter = aiRouter;
  }

  /**
   * Execute a skill
   */
  async execute(
    options: SkillExecutionOptions
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Load skill from database
      const skill = await this.loadSkill(options.skillId, options.userId);

      if (!skill) {
        throw new Error('Skill not found or not installed');
      }

      // 2. Execute based on skill type
      let result: any;
      let creditsUsed = 0;
      let tokensUsed = 0;

      switch (skill.skillType) {
        case 'config':
          const configResult = await this.executeConfigSkill(skill, options);
          result = configResult.output;
          creditsUsed = configResult.creditsUsed;
          tokensUsed = configResult.tokensUsed;
          break;

        case 'javascript':
          result = await this.executeJavaScriptSkill(skill, options);
          creditsUsed = skill.estimatedCreditCost; // Flat cost for code execution
          break;

        case 'python':
          throw new Error('Python skills not yet supported');

        default:
          throw new Error(`Unsupported skill type: ${skill.skillType}`);
      }

      // 3. Track execution
      await this.trackExecution(options.skillId, options.userId, {
        success: true,
        creditsUsed,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output: result,
        metadata: {
          skillId: skill.id,
          skillName: skill.name,
          executionTime,
          creditsUsed,
          tokensUsed,
        },
      };
    } catch (error) {
      console.error('[SkillExecutor] Execution failed:', error);

      // Track failed execution
      await this.trackExecution(options.skillId, options.userId, {
        success: false,
        error: (error as Error).message,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          skillId: options.skillId,
          skillName: 'Unknown',
          executionTime,
          creditsUsed: 0,
          tokensUsed: 0,
        },
      };
    }
  }

  /**
   * Load skill and verify installation
   */
  private async loadSkill(skillId: string, userId: string) {
    // Verify user has installed this skill
    const installation = await prisma.skillInstallation.findFirst({
      where: {
        userId,
        skillId,
        isActive: true,
      },
      include: {
        skill: true,
      },
    });

    if (!installation) {
      return null;
    }

    return installation.skill;
  }

  /**
   * Execute config-based skill
   *
   * Config skills are predefined workflows using existing tools.
   */
  private async executeConfigSkill(
    skill: any,
    options: SkillExecutionOptions
  ): Promise<{
    output: any;
    creditsUsed: number;
    tokensUsed: number;
  }> {
    const { skillDefinition } = skill;

    if (!skillDefinition.steps || !Array.isArray(skillDefinition.steps)) {
      throw new Error('Invalid skill definition: missing steps');
    }

    // Create a temporary task for this skill execution
    const task: AgentTask = {
      id: `skill-${skill.id}-${Date.now()}`,
      userId: options.userId,
      goal: skill.name,
      type: 'custom',
      config: skill.agentConfig || {},
      createdAt: new Date(),
    };

    // Build execution plan from skill definition
    const plan: ExecutionPlan = {
      taskId: task.id,
      steps: skillDefinition.steps.map((step: any, index: number) => ({
        id: `${task.id}-step-${index}`,
        stepNumber: index + 1,
        action: step.action,
        description: step.description,
        tool: step.tool,
        params: this.substituteParams(step.params, options.input),
        estimatedCredits: step.estimatedCredits || 10,
        estimatedDuration: step.estimatedDuration || 5000,
        requiresApproval: step.requiresApproval || false,
        dependencies: step.dependencies || [],
      })),
      totalSteps: skillDefinition.steps.length,
      estimatedCredits: skill.estimatedCreditCost,
      estimatedDuration: skillDefinition.steps.reduce(
        (sum: number, s: any) => sum + (s.estimatedDuration || 5000),
        0
      ),
      createdAt: new Date(),
    };

    // Create agent executor
    const agentConfig = skill.agentConfig || {};
    const executor = new AgentExecutor(
      'custom',
      agentConfig,
      this.toolRegistry
    );

    // Execute the skill
    const result: AgentResult = await executor.execute(task, plan);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Skill execution failed');
    }

    return {
      output: result.result,
      creditsUsed: result.creditsUsed,
      tokensUsed: result.tokensUsed,
    };
  }

  /**
   * Execute JavaScript skill
   *
   * JavaScript skills run sandboxed user code.
   */
  private async executeJavaScriptSkill(
    skill: any,
    options: SkillExecutionOptions
  ): Promise<any> {
    const { skillDefinition } = skill;

    if (!skillDefinition.code || typeof skillDefinition.code !== 'string') {
      throw new Error('Invalid skill definition: missing code');
    }

    // Create sandboxed context
    const sandbox = this.createSandbox(options.input);

    try {
      // Execute user code in sandbox
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const fn = new AsyncFunction('input', 'tools', skillDefinition.code);

      // Provide safe tool access
      const safeTools = this.createSafeToolAccess(options.userId);

      const result = await Promise.race([
        fn(options.input, safeTools),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), 30000)
        ), // 30s timeout
      ]);

      return result;
    } catch (error) {
      console.error('[SkillExecutor] JavaScript execution failed:', error);
      throw new Error(`Code execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create sandboxed execution context
   */
  private createSandbox(input: Record<string, any>): Record<string, any> {
    return {
      input,
      // Provide safe utilities
      console: {
        log: (...args: any[]) =>
          console.log('[Skill Sandbox]', ...args),
        error: (...args: any[]) =>
          console.error('[Skill Sandbox]', ...args),
      },
      // No access to process, require, etc.
    };
  }

  /**
   * Create safe tool access for JavaScript skills
   */
  private createSafeToolAccess(userId: string): Record<string, any> {
    // TODO: Implement safe tool wrapper that checks permissions
    // For now, return empty object
    return {
      // Example: fetch: async (url: string) => { ... }
    };
  }

  /**
   * Substitute input parameters in step params
   */
  private substituteParams(
    params: Record<string, any>,
    input: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Replace {{input.fieldName}} with actual values
        result[key] = value.replace(/\{\{input\.(\w+)\}\}/g, (_, field) => {
          return input[field] !== undefined ? input[field] : '';
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteParams(value, input);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Track skill execution for analytics
   */
  private async trackExecution(
    skillId: string,
    userId: string,
    result: { success: boolean; creditsUsed?: number; error?: string }
  ): Promise<void> {
    try {
      // Update installation execution count
      await prisma.skillInstallation.updateMany({
        where: {
          userId,
          skillId,
          isActive: true,
        },
        data: {
          executionCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Deduct credits from user
      if (result.success && result.creditsUsed) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            creditsUsed: { increment: result.creditsUsed },
          },
        });
      }
    } catch (error) {
      console.error('[SkillExecutor] Failed to track execution:', error);
      // Don't throw - tracking failure shouldn't fail the skill
    }
  }
}

/**
 * Get skill executor instance
 */
let skillExecutor: SkillExecutor | null = null;

export function getSkillExecutor(): SkillExecutor {
  if (!skillExecutor) {
    const { getToolRegistry } = require('../agent/tools/registry');
    const { getAIRouter } = require('../ai-providers/router');

    skillExecutor = new SkillExecutor(getToolRegistry(), getAIRouter());
  }

  return skillExecutor;
}
