/**
 * Live-chat ReAct tool-calling loop.
 *
 * A lightweight sibling to `executor.ts` (the plan-then-execute engine behind
 * `/api/agent/execute`): this one drives a single synchronous chat turn,
 * reusing the same tool registry, sensitivity rules, and execution guards,
 * but does its own turn-by-turn orchestration and never persists a `Task` row
 * — there is nothing to resume across server restarts, only across the one
 * HTTP request/response (or, for an approval halt, the next request the
 * client makes with `resumeMessages` echoed back).
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';
import { secureChat } from '@/lib/ai-security/guard';
import type { AIMessage, ContentBlock, ToolCall, ToolDefinition } from '@/lib/ai-providers/types';
import { toolRegistry } from './tools';
import { SENSITIVE_TOOLS } from './approval';
import { applyExecutionGuards, withTimeout } from './guards';
import type { AgentContext, AgentState, ToolResult } from './types';

export interface ToolTraceEntry {
  tool: string;
  input: Record<string, unknown>;
  success: boolean;
  summary: string;
  durationMs: number;
  credits: number;
}

export interface ChatLoopParams {
  modelId: string;
  /** System + history + new user turn, pre-assembled by the caller. */
  messages: AIMessage[];
  userId: string;
  approvedTools: string[];
  /**
   * Tool names the user explicitly declined on this resume. Only meaningful
   * for a tool call left pending from a prior halt (see resumePendingCalls
   * below) — declining injects a failed tool_result instead of executing it,
   * so the model can respond gracefully instead of the turn just dying.
   */
  deniedTools?: string[];
  /** Logical surface name, forwarded to secureChat's audit log. */
  surface?: string;
  maxTokens?: number;
  thinking?: { type: 'enabled'; budget_tokens: number };
  /** Default 6 — chat is a synchronous request, latency must stay bounded. */
  maxIterations?: number;
}

interface LoopUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type ChatLoopResult =
  | {
      status: 'done';
      content: string;
      toolTrace: ToolTraceEntry[];
      usage: LoopUsage;
      toolCreditsUsed: number;
      provider: string;
      finishReason?: string;
    }
  | {
      status: 'pendingApproval';
      pendingApproval: { toolName: string; input: Record<string, unknown>; description: string };
      resumeMessages: AIMessage[];
      toolTrace: ToolTraceEntry[];
      usage: LoopUsage;
      toolCreditsUsed: number;
      provider: string;
    };

const DEFAULT_MAX_ITERATIONS = 6;

function errorResultBlock(callId: string, name: string, message: string): ContentBlock {
  return {
    type: 'tool_result',
    tool_use_id: callId,
    name,
    content: JSON.stringify({ error: message }),
    is_error: true,
  };
}

function summarizeResult(result: ToolResult): string {
  if (!result.success) return `error: ${(result.error || 'unknown error').slice(0, 200)}`;
  const json = JSON.stringify(result.data ?? null);
  return json.length > 200 ? json.slice(0, 200) + '…' : json;
}

function describeCall(toolName: string, input: Record<string, unknown>): string {
  const tool = toolRegistry.getTool(toolName);
  const preview = Object.entries(input)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 60)}`)
    .join(', ');
  return `${tool?.description ?? toolName}${preview ? ` (${preview})` : ''}`;
}

function addUsage(total: LoopUsage, next: LoopUsage): LoopUsage {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    totalTokens: total.totalTokens + next.totalTokens,
  };
}

/**
 * On resume, the message array can end with an assistant turn whose tool_use
 * blocks were never fully answered (the batch halted partway through for
 * approval). Find those unanswered calls so the loop can pick up exactly
 * where it left off instead of asking the model to act on a dangling,
 * unresolved tool_use — which every provider rejects or mishandles.
 */
function findUnansweredToolCalls(messages: AIMessage[]): ToolCall[] {
  let assistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      assistantIdx = i;
      break;
    }
  }
  if (assistantIdx === -1) return [];

  const content = messages[assistantIdx].content;
  if (!Array.isArray(content)) return [];
  const calls = content.filter((b): b is ContentBlock & { type: 'tool_use' } => b.type === 'tool_use');
  if (!calls.length) return [];

  const answeredIds = new Set<string>();
  for (let i = assistantIdx + 1; i < messages.length; i++) {
    const c = messages[i].content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type === 'tool_result' && b.tool_use_id) answeredIds.add(b.tool_use_id);
    }
  }

  return calls
    .filter((b) => b.id && !answeredIds.has(b.id))
    .map((b) => ({ id: b.id!, name: b.name!, input: (b.input ?? {}) as Record<string, unknown> }));
}

export async function runChatLoop(params: ChatLoopParams): Promise<ChatLoopResult> {
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: AIMessage[] = [...params.messages];
  const toolTrace: ToolTraceEntry[] = [];
  const deniedTools = new Set(params.deniedTools ?? []);
  let usage: LoopUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let toolCreditsUsed = 0;
  let provider = '';

  const modelInfo = aiRouter.getModel(params.modelId);
  const toolsSupported = modelInfo?.capabilities.includes('function-calling') ?? false;
  const tools: ToolDefinition[] | undefined = toolsSupported
    ? toolRegistry.getAllTools().map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
    : undefined;

  // Shared scratch state for tools within this single turn, mirroring the
  // per-task `memory` the old executor threads across steps.
  const memory: Record<string, unknown> = {};
  const taskId = `chat-${randomUUID()}`;

  // Resume path: pick up any tool_use calls left unanswered by a prior halt
  // before making any new model call this request.
  let pendingCalls = findUnansweredToolCalls(messages);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let toolCalls: ToolCall[];

    if (pendingCalls.length) {
      toolCalls = pendingCalls;
      pendingCalls = [];
    } else {
      const response = await secureChat(
        params.modelId,
        { messages, tools, maxTokens: params.maxTokens, thinking: params.thinking },
        { surface: params.surface ?? 'chat', userId: params.userId }
      );

      usage = addUsage(usage, response.usage);
      provider = response.provider;
      messages.push({ role: 'assistant', content: response.contentBlocks ?? response.content });

      if (!response.toolCalls?.length) {
        return { status: 'done', content: response.content, toolTrace, usage, toolCreditsUsed, provider, finishReason: response.finishReason };
      }

      toolCalls = response.toolCalls;
    }

    const resultBlocks: ContentBlock[] = [];
    let haltedForApproval = false;

    for (const call of toolCalls) {
      const tool = toolRegistry.getTool(call.name);
      if (!tool) {
        resultBlocks.push(errorResultBlock(call.id, call.name, `Unknown tool "${call.name}"`));
        continue;
      }

      if (deniedTools.has(call.name)) {
        resultBlocks.push(errorResultBlock(call.id, call.name, 'User declined to approve this action.'));
        continue;
      }

      const validation = tool.validate(call.input);
      if (!validation.valid) {
        resultBlocks.push(errorResultBlock(call.id, call.name, validation.error || 'Invalid parameters'));
        continue;
      }

      if (SENSITIVE_TOOLS.has(call.name) && !params.approvedTools.includes(call.name)) {
        // Halt the whole turn: earlier calls in this same batch that already
        // ran keep their results (not rolled back), but nothing further runs.
        // The still-unanswered tool_use blocks (this one and any after it)
        // are recovered by findUnansweredToolCalls() on the next request.
        haltedForApproval = true;
        if (resultBlocks.length) messages.push({ role: 'user', content: resultBlocks });
        return {
          status: 'pendingApproval',
          pendingApproval: { toolName: call.name, input: call.input, description: describeCall(call.name, call.input) },
          resumeMessages: messages,
          toolTrace,
          usage,
          toolCreditsUsed,
          provider,
        };
      }

      const estimatedCredits = tool.estimateCost(call.input);
      const guard = await applyExecutionGuards(params.userId, call.name, estimatedCredits, toolCreditsUsed);
      if (!guard.allowed) {
        resultBlocks.push(errorResultBlock(call.id, call.name, guard.reason || 'Execution guard rejected this call'));
        continue;
      }

      const stubState: AgentState = {
        taskId,
        status: 'executing',
        currentStep: iteration,
        totalSteps: 0,
        progress: 0,
        creditsUsed: toolCreditsUsed,
        tokensUsed: usage.totalTokens,
        executionTime: 0,
        context: {},
        trace: [],
      };
      const context: AgentContext = {
        userId: params.userId,
        taskId,
        stepNumber: iteration,
        state: stubState,
        prisma,
        aiRouter,
        memory,
      };

      let result: ToolResult;
      try {
        result = await withTimeout(() => tool.execute(call.input, context), guard.timeout, call.name);
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : String(err) };
      }

      const credits = result.metadata?.credits ?? estimatedCredits;
      toolCreditsUsed += credits;
      toolTrace.push({
        tool: call.name,
        input: call.input,
        success: result.success,
        summary: summarizeResult(result),
        durationMs: result.metadata?.duration ?? 0,
        credits,
      });

      resultBlocks.push({
        type: 'tool_result',
        tool_use_id: call.id,
        name: call.name,
        content: JSON.stringify(result.success ? result.data ?? null : { error: result.error }),
        is_error: !result.success,
      });
    }

    if (!haltedForApproval) {
      messages.push({ role: 'user', content: resultBlocks });
    }
  }

  // Exceeded maxIterations without a final answer — force one last
  // tools-less call rather than erroring the request out from under the user.
  messages.push({
    role: 'user',
    content:
      'You have reached the maximum number of tool calls for this turn. Provide your best final answer now using only the information already gathered — do not request any more tools.',
  });
  const final = await secureChat(
    params.modelId,
    { messages, maxTokens: params.maxTokens, thinking: params.thinking },
    { surface: params.surface ?? 'chat', userId: params.userId }
  );
  usage = addUsage(usage, final.usage);

  return { status: 'done', content: final.content, toolTrace, usage, toolCreditsUsed, provider: final.provider, finishReason: final.finishReason };
}
