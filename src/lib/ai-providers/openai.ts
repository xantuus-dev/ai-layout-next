/**
 * OpenAI (GPT) Provider Implementation
 */

import OpenAI from 'openai';
import { AIProvider, ChatParams, ChatResponse, AIModel, ContentBlock } from './types';

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

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider is not configured. Please set OPENAI_API_KEY.');
    }

    // Convert messages to OpenAI format
    const openaiMessages = params.messages.map(msg => ({
      role: msg.role,
      content: this.convertContent(msg.content),
    }));

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: openaiMessages as any,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error('No content received from OpenAI');
    }

    return {
      content: choice.message.content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model: params.model,
      provider: this.id,
      finishReason: choice.finish_reason || undefined,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    const creditsPerK = model?.creditsPerThousandTokens || 5;
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
