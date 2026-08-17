/**
 * OpenAI (GPT) Provider Implementation
 */

import OpenAI from 'openai';
import { AIProvider, ChatParams, ChatResponse, AIModel, AIMessage, ContentBlock, ToolCall } from './types';

/** `tool_calls[].function.arguments` is a JSON string models don't always emit validly. */
function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI';
  private client: OpenAI | null = null;

  models: AIModel[] = [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      description: 'Best for code and reasoning',
      creditsPerThousandTokens: 10,
      inputCostPer1M: 10,
      outputCostPer1M: 30,
      contextWindow: 128000,
      capabilities: ['vision', 'function-calling', 'json-mode'],
      badge: 'Code Expert',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      description: 'Multimodal powerhouse',
      creditsPerThousandTokens: 5,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10,
      contextWindow: 128000,
      capabilities: ['vision', 'function-calling', 'json-mode', 'audio'],
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      description: 'Fast and affordable',
      creditsPerThousandTokens: 0.15,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.6,
      contextWindow: 128000,
      capabilities: ['vision', 'function-calling', 'json-mode'],
      badge: 'Budget',
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      description: 'Legacy fast model',
      creditsPerThousandTokens: 0.5,
      inputCostPer1M: 0.5,
      outputCostPer1M: 1.5,
      contextWindow: 16385,
      capabilities: ['function-calling', 'json-mode'],
    },
  ];

  constructor() {
    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private convertContent(content: string | ContentBlock[]): any {
    if (typeof content === 'string') {
      return content;
    }

    // Convert content blocks to OpenAI format
    return content.map(block => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      } else if (block.type === 'image' && block.source) {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        };
      }
      return { type: 'text', text: '' };
    });
  }

  /**
   * OpenAI's tool-calling shape doesn't map 1:1 from our AIMessage/ContentBlock
   * model the way Anthropic's does: tool calls live in a separate `tool_calls`
   * field on the assistant message (not inline content blocks), and each tool
   * result must become its own subsequent `{role:'tool', tool_call_id, content}`
   * message rather than a content block. So a single tool_result-bearing
   * AIMessage fans out into N OpenAI messages here.
   */
  private buildOpenAIMessages(messages: AIMessage[]): any[] {
    const out: any[] = [];

    for (const msg of messages) {
      const blocks = Array.isArray(msg.content) ? msg.content : null;

      if (blocks?.some(b => b.type === 'tool_result')) {
        for (const b of blocks) {
          if (b.type === 'tool_result') {
            out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content ?? '' });
          }
        }
        continue;
      }

      if (msg.role === 'assistant' && blocks?.some(b => b.type === 'tool_use')) {
        const text = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
        out.push({
          role: 'assistant',
          content: text || null,
          tool_calls: blocks
            .filter(b => b.type === 'tool_use')
            .map(b => ({
              id: b.id!,
              type: 'function' as const,
              function: { name: b.name!, arguments: JSON.stringify(b.input ?? {}) },
            })),
        });
        continue;
      }

      out.push({ role: msg.role, content: this.convertContent(msg.content) });
    }

    return out;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider is not configured. Please set OPENAI_API_KEY.');
    }

    const createParams: any = {
      model: params.model,
      messages: this.buildOpenAIMessages(params.messages),
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature,
    };

    if (params.tools?.length) {
      createParams.tools = params.tools.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }));
    }

    const response = await this.client.chat.completions.create(createParams);

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] | undefined = message?.tool_calls?.length
      ? message.tool_calls
          .filter((tc: any) => tc.type === 'function')
          .map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            input: safeJsonParse(tc.function.arguments),
          }))
      : undefined;

    const contentBlocks: ContentBlock[] | undefined = toolCalls
      ? [
          ...(message?.content ? [{ type: 'text' as const, text: message.content }] : []),
          ...toolCalls.map(c => ({ type: 'tool_use' as const, ...c })),
        ]
      : undefined;

    if (!message?.content && !toolCalls) {
      throw new Error('No content received from OpenAI');
    }

    return {
      content: message?.content ?? '',
      contentBlocks,
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model: params.model,
      provider: this.id,
      finishReason: choice?.finish_reason || undefined,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      console.warn(`⚠️  No credit pricing for OpenAI model "${modelId}" — billing at highest known rate`);
    }
    const creditsPerK = model?.creditsPerThousandTokens
      ?? Math.max(...this.models.map(m => m.creditsPerThousandTokens));
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
