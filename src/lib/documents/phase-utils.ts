/**
 * Shared helpers for document generation pipeline phases.
 *
 * Phases are deterministic orchestration code that calls the LLM and tools
 * for specific, well-defined sub-tasks (unlike AgentExecutor's model-driven
 * tool selection) — these helpers standardize how a phase calls a model or a
 * tool and records an ExecutionTrace entry for it, so every phase produces
 * traces in the same shape AgentExecutor already writes to TaskExecution.
 */

import type { AgentContext, ExecutionTrace, StepStatus, ToolResult } from '../agent/types';
import { toolRegistry } from '../agent/tools';

const DRAFTING_MODEL = 'claude-sonnet-4-5-20250929';
const CHEAP_MODEL = 'claude-haiku-4-5';

export function makeTrace(input: {
  stepNumber: number;
  action: string;
  tool: string;
  reasoning?: string;
  input: any;
  output?: any;
  error?: string;
  status: StepStatus;
  duration: number;
  credits: number;
  tokens: number;
}): ExecutionTrace {
  return { timestamp: new Date(), ...input };
}

/** Calls the AI router with a plain-text prompt, returning content + a ready-to-push trace. */
export async function callModel(
  context: AgentContext,
  opts: { stepNumber: number; action: string; prompt: string; model?: string; maxTokens?: number; temperature?: number }
): Promise<{ content: string; trace: ExecutionTrace }> {
  const model = opts.model || DRAFTING_MODEL;
  const startTime = Date.now();

  try {
    const response = await context.aiRouter.chat(model, {
      messages: [{ role: 'user', content: opts.prompt }],
      maxTokens: opts.maxTokens || 1500,
      temperature: opts.temperature ?? 0.6,
    });
    const credits = context.aiRouter.estimateCredits(model, response.usage.totalTokens);

    return {
      content: response.content,
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: 'ai.chat',
        input: { model, promptLength: opts.prompt.length },
        output: { contentLength: response.content.length },
        status: 'completed',
        duration: Date.now() - startTime,
        credits,
        tokens: response.usage.totalTokens,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: '',
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: 'ai.chat',
        input: { model, promptLength: opts.prompt.length },
        error: message,
        status: 'failed',
        duration: Date.now() - startTime,
        credits: 0,
        tokens: 0,
      }),
    };
  }
}

/** Runs a registered tool by name, returning its result + a ready-to-push trace. Never throws. */
export async function callTool(
  context: AgentContext,
  opts: { stepNumber: number; action: string; toolName: string; params: any }
): Promise<{ result: ToolResult; trace: ExecutionTrace }> {
  const startTime = Date.now();
  const tool = toolRegistry.getTool(opts.toolName);

  if (!tool) {
    const result: ToolResult = { success: false, error: `Tool not found: ${opts.toolName}` };
    return {
      result,
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: opts.toolName,
        input: opts.params,
        error: result.error,
        status: 'failed',
        duration: Date.now() - startTime,
        credits: 0,
        tokens: 0,
      }),
    };
  }

  const validation = tool.validate(opts.params);
  if (!validation.valid) {
    const result: ToolResult = { success: false, error: validation.error };
    return {
      result,
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: opts.toolName,
        input: opts.params,
        error: result.error,
        status: 'failed',
        duration: Date.now() - startTime,
        credits: 0,
        tokens: 0,
      }),
    };
  }

  try {
    const result = await tool.execute(opts.params, context);
    return {
      result,
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: opts.toolName,
        input: opts.params,
        output: result.success ? result.data : undefined,
        error: result.success ? undefined : result.error,
        status: result.success ? 'completed' : 'failed',
        duration: Date.now() - startTime,
        credits: result.metadata?.credits || 0,
        tokens: result.metadata?.tokens || 0,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: { success: false, error: message },
      trace: makeTrace({
        stepNumber: opts.stepNumber,
        action: opts.action,
        tool: opts.toolName,
        input: opts.params,
        error: message,
        status: 'failed',
        duration: Date.now() - startTime,
        credits: 0,
        tokens: 0,
      }),
    };
  }
}

/** Extracts a JSON value from a model response that may wrap it in a ```json fence or prose. */
export function extractJson<T = any>(content: string): T | null {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;

  // Try the whole candidate first, then fall back to the first balanced-looking
  // {...} or [...] span, since models sometimes add a sentence before/after.
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    const span = arrMatch && (!objMatch || arrMatch[0].length > objMatch[0].length) ? arrMatch[0] : objMatch?.[0];
    if (!span) return null;
    try {
      return JSON.parse(span);
    } catch {
      return null;
    }
  }
}

export { CHEAP_MODEL, DRAFTING_MODEL };
