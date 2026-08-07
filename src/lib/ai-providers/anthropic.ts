/**
 * Anthropic (Claude) Provider Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatParams, ChatResponse, AIModel, StreamEvent } from './types';

export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  name = 'Anthropic';
  private client: Anthropic | null = null;

  models: AIModel[] = [
    {
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      provider: 'anthropic',
      description: 'Most capable for complex work',
      creditsPerThousandTokens: 15,
      inputCostPer1M: 15,
      outputCostPer1M: 75,
      contextWindow: 200000,
      capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
      badge: 'Premium',
    },
    {
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      provider: 'anthropic',
      description: 'Best for everyday tasks',
      creditsPerThousandTokens: 3,
      inputCostPer1M: 3,
      outputCostPer1M: 15,
      contextWindow: 200000,
      capabilities: ['vision', 'function-calling', 'thinking', 'long-context'],
    },
    {
      id: 'claude-haiku-4-5-20250529',
      name: 'Claude Haiku 4.5',
      provider: 'anthropic',
      description: 'Fastest for quick answers',
      creditsPerThousandTokens: 1,
      inputCostPer1M: 0.25,
      outputCostPer1M: 1.25,
      contextWindow: 200000,
      capabilities: ['vision', 'function-calling'],
      badge: 'Fastest',
    },
  ];

  constructor() {
    if (this.isConfigured()) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Translate our provider-neutral params into Anthropic's request shape.
   * Shared by chat() and chatStream() so the two cannot drift apart.
   */
  private buildApiParams(params: ChatParams): any {
    const anthropicMessages = params.messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    const apiParams: any = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      messages: anthropicMessages,
    };

    if (params.temperature !== undefined) {
      apiParams.temperature = params.temperature;
    }

    if (params.thinking) {
      apiParams.thinking = params.thinking;
    }

    return apiParams;
  }

  /**
   * Stream a completion, yielding deltas as the model produces them.
   *
   * Reasoning and answer text arrive as separate event types so the UI can
   * show a "thinking" block that is distinct from the response body.
   */
  async *chatStream(params: ChatParams): AsyncGenerator<StreamEvent, void, unknown> {
    if (!this.client) {
      throw new Error('Anthropic provider is not configured. Please set ANTHROPIC_API_KEY.');
    }

    const stream = this.client.messages.stream(this.buildApiParams(params));

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;

      const delta = event.delta;
      if (delta.type === 'text_delta') {
        yield { type: 'text', delta: delta.text };
      } else if (delta.type === 'thinking_delta') {
        yield { type: 'thinking', delta: delta.thinking };
      }
      // signature_delta carries the thinking signature, which is not display
      // content and is intentionally ignored.
    }

    // Usage totals are only final once the message completes.
    const finalMessage = await stream.finalMessage();
    yield {
      type: 'done',
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
      finishReason: finalMessage.stop_reason || undefined,
    };
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Anthropic provider is not configured. Please set ANTHROPIC_API_KEY.');
    }

    const response = await this.client.messages.create(this.buildApiParams(params));

    // Extract text content from response
    let responseText = '';
    if (response.content && response.content.length > 0) {
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }
    }

    if (!responseText) {
      throw new Error('No text content received from Anthropic');
    }

    return {
      content: responseText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: params.model,
      provider: this.id,
      finishReason: response.stop_reason || undefined,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      // Unknown/unpriced model: bill at this provider's highest known rate
      // rather than a guessed mid-tier default, so margin is protected
      // instead of silently eroded until pricing is added.
      console.warn(`⚠️  No credit pricing for Anthropic model "${modelId}" — billing at highest known rate`);
    }
    const creditsPerK = model?.creditsPerThousandTokens
      ?? Math.max(...this.models.map(m => m.creditsPerThousandTokens));
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
