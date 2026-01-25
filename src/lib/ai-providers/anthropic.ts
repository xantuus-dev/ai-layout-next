/**
 * Anthropic (Claude) Provider Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatParams, ChatResponse, AIModel } from './types';

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

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Anthropic provider is not configured. Please set ANTHROPIC_API_KEY.');
    }

    // Convert messages to Anthropic format
    const anthropicMessages = params.messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    // Build API parameters
    const apiParams: any = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      messages: anthropicMessages,
    };

    // Add temperature if specified
    if (params.temperature !== undefined) {
      apiParams.temperature = params.temperature;
    }

    // Add extended thinking if enabled
    if (params.thinking) {
      apiParams.thinking = params.thinking;
    }

    const response = await this.client.messages.create(apiParams);

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
    const creditsPerK = model?.creditsPerThousandTokens || 3;
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
