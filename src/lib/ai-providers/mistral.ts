/**
 * Mistral AI Provider Implementation
 *
 * Mistral's chat message/tool-call shape is close to OpenAI's (tool calls
 * live on a separate `toolCalls` field, not inline content blocks; tool
 * results are their own `role: 'tool'` messages) — buildMistralMessages below
 * mirrors openai.ts's fan-out for exactly that reason. The SDK types
 * (Mistral, ChatCompletionRequest, AssistantMessage, etc.) were read directly
 * from node_modules/@mistralai/mistralai's .d.ts files while building this,
 * not assumed from memory — the npm package is @mistralai/mistralai, not the
 * deprecated @mistralai/client.
 */

import { Mistral } from '@mistralai/mistralai';
import type {
  ChatCompletionRequestMessage,
  ChatCompletionRequestTool,
  ContentChunk,
} from '@mistralai/mistralai/models/components';
import { AIProvider, ChatParams, ChatResponse, AIModel, StreamEvent, AIMessage, ContentBlock, ToolCall } from './types';

/**
 * PRICING IS UNVERIFIED. These figures are estimates based on Mistral's
 * publicly known pricing tiers at the time this was written, not a live
 * lookup — this codebase has shipped wrong-by-4x model pricing before (see
 * the Haiku comment in catalog.ts) from exactly this kind of unverified
 * entry. Confirm against https://mistral.ai/pricing before relying on these
 * for real billing.
 */
export const MISTRAL_MODELS: AIModel[] = [
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    description: "Mistral's flagship model for complex reasoning",
    creditsPerThousandTokens: 4,
    inputCostPer1M: 2,
    outputCostPer1M: 6,
    contextWindow: 128000,
    capabilities: ['function-calling', 'json-mode'],
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium',
    provider: 'mistral',
    description: 'Balanced cost and capability',
    creditsPerThousandTokens: 1.5,
    inputCostPer1M: 0.4,
    outputCostPer1M: 2,
    contextWindow: 128000,
    capabilities: ['function-calling', 'json-mode'],
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    description: 'Fast and affordable',
    creditsPerThousandTokens: 0.3,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.3,
    contextWindow: 128000,
    capabilities: ['function-calling', 'json-mode'],
    badge: 'Budget',
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    provider: 'mistral',
    description: 'Specialized for code generation',
    creditsPerThousandTokens: 1,
    inputCostPer1M: 0.3,
    outputCostPer1M: 0.9,
    contextWindow: 256000,
    capabilities: ['function-calling'],
    badge: 'Code',
  },
  {
    id: 'pixtral-large-latest',
    name: 'Pixtral Large',
    provider: 'mistral',
    description: "Mistral's vision-capable flagship",
    creditsPerThousandTokens: 4,
    inputCostPer1M: 2,
    outputCostPer1M: 6,
    contextWindow: 128000,
    capabilities: ['vision', 'function-calling', 'json-mode'],
  },
];

/** `tool_calls[].function.arguments` may already be an object or a JSON string, depending on the SDK path. */
function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toFunctionArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  return typeof args === 'string' ? safeJsonParse(args) : args;
}

/** Extract plain text from Mistral's content union (string | ContentChunk[] | null). */
function extractText(content: string | ContentChunk[] | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((c): c is ContentChunk & { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

export class MistralProvider implements AIProvider {
  id = 'mistral';
  name = 'Mistral AI';
  private client: Mistral | null = null;

  models: AIModel[] = MISTRAL_MODELS;

  constructor() {
    if (this.isConfigured()) {
      this.client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    }
  }

  isConfigured(): boolean {
    return !!process.env.MISTRAL_API_KEY;
  }

  private convertContent(content: string | ContentBlock[]): string | ContentChunk[] {
    if (typeof content === 'string') return content;

    return content.map((block): ContentChunk => {
      if (block.type === 'image' && block.source) {
        return {
          type: 'image_url',
          imageUrl: `data:${block.source.media_type};base64,${block.source.data}`,
        };
      }
      return { type: 'text', text: block.text ?? '' };
    });
  }

  /**
   * Same fan-out openai.ts uses: a tool_result-bearing AIMessage becomes N
   * separate `role: 'tool'` messages, and an assistant tool_use turn moves
   * its calls out of content and onto a dedicated `toolCalls` field.
   */
  private buildMistralMessages(messages: AIMessage[]): ChatCompletionRequestMessage[] {
    const out: ChatCompletionRequestMessage[] = [];

    for (const msg of messages) {
      const blocks = Array.isArray(msg.content) ? msg.content : null;

      if (blocks?.some((b) => b.type === 'tool_result')) {
        for (const b of blocks) {
          if (b.type === 'tool_result') {
            out.push({
              role: 'tool',
              content: b.content ?? '',
              toolCallId: b.tool_use_id,
              name: b.name,
            });
          }
        }
        continue;
      }

      if (msg.role === 'assistant' && blocks?.some((b) => b.type === 'tool_use')) {
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        out.push({
          role: 'assistant',
          content: text || null,
          toolCalls: blocks
            .filter((b) => b.type === 'tool_use')
            .map((b) => ({
              id: b.id,
              type: 'function' as const,
              function: { name: b.name!, arguments: JSON.stringify(b.input ?? {}) },
            })),
        });
        continue;
      }

      if (msg.role === 'system') {
        // System content is always plain text in this codebase (buildSystemPrompt
        // returns a string) and SystemMessage's content type has no image_url
        // variant anyway — extract text rather than reusing convertContent's
        // general ContentChunk union.
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        out.push({ role: 'system', content: text });
      } else if (msg.role === 'assistant') {
        out.push({ role: 'assistant', content: this.convertContent(msg.content) });
      } else {
        out.push({ role: 'user', content: this.convertContent(msg.content) });
      }
    }

    return out;
  }

  private buildTools(params: ChatParams): ChatCompletionRequestTool[] | undefined {
    if (!params.tools?.length) return undefined;
    return params.tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Mistral provider is not configured. Please set MISTRAL_API_KEY.');
    }

    const response = await this.client.chat.complete({
      model: params.model,
      messages: this.buildMistralMessages(params.messages),
      maxTokens: params.maxTokens || 4096,
      temperature: params.temperature,
      tools: this.buildTools(params),
    });

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] | undefined = message?.toolCalls?.length
      ? message.toolCalls
          .filter((tc) => tc.id)
          .map((tc) => ({
            id: tc.id!,
            name: tc.function.name,
            input: toFunctionArgs(tc.function.arguments),
          }))
      : undefined;

    const text = extractText(message?.content);

    const contentBlocks: ContentBlock[] | undefined = toolCalls
      ? [
          ...(text ? [{ type: 'text' as const, text }] : []),
          ...toolCalls.map((c) => ({ type: 'tool_use' as const, ...c })),
        ]
      : undefined;

    if (!text && !toolCalls) {
      throw new Error('No content received from Mistral');
    }

    return {
      content: text,
      contentBlocks,
      toolCalls,
      usage: {
        inputTokens: response.usage.promptTokens ?? 0,
        outputTokens: response.usage.completionTokens ?? 0,
        totalTokens: response.usage.totalTokens ?? 0,
      },
      model: params.model,
      provider: this.id,
      finishReason: choice?.finishReason,
    };
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamEvent, void, unknown> {
    if (!this.client) {
      throw new Error('Mistral provider is not configured. Please set MISTRAL_API_KEY.');
    }

    const stream = await this.client.chat.stream({
      model: params.model,
      messages: this.buildMistralMessages(params.messages),
      maxTokens: params.maxTokens || 4096,
      temperature: params.temperature,
      tools: this.buildTools(params),
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: string | undefined;

    for await (const event of stream) {
      const chunk = event.data;

      if (chunk.usage) {
        inputTokens = chunk.usage.promptTokens ?? inputTokens;
        outputTokens = chunk.usage.completionTokens ?? outputTokens;
      }

      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finishReason) finishReason = choice.finishReason;

      const delta = extractText(choice.delta.content);
      if (delta) {
        yield { type: 'text', delta };
      }
    }

    yield {
      type: 'done',
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      finishReason,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) {
      console.warn(`⚠️  No credit pricing for Mistral model "${modelId}" — billing at highest known rate`);
    }
    const creditsPerK = model?.creditsPerThousandTokens
      ?? Math.max(...this.models.map((m) => m.creditsPerThousandTokens));
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
