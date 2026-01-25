/**
 * Google (Gemini) Provider Implementation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ChatParams, ChatResponse, AIModel, ContentBlock } from './types';

export class GoogleProvider implements AIProvider {
  id = 'google';
  name = 'Google';
  private client: GoogleGenerativeAI | null = null;

  models: AIModel[] = [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      description: 'Ultra-fast multimodal',
      creditsPerThousandTokens: 0.075,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30,
      contextWindow: 1000000,
      capabilities: ['vision', 'multimodal', 'code-execution'],
      badge: 'Cheapest',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      description: 'Long context powerhouse',
      creditsPerThousandTokens: 1.25,
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.00,
      contextWindow: 2000000,
      capabilities: ['vision', 'multimodal', 'long-context'],
      badge: '2M Context',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      description: 'Fast and efficient',
      creditsPerThousandTokens: 0.075,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.30,
      contextWindow: 1000000,
      capabilities: ['vision', 'multimodal'],
    },
  ];

  constructor() {
    if (this.isConfigured()) {
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    }
  }

  isConfigured(): boolean {
    return !!process.env.GOOGLE_AI_API_KEY;
  }

  private convertContent(content: string | ContentBlock[]): any[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    // Convert content blocks to Gemini format
    return content.map(block => {
      if (block.type === 'text') {
        return { text: block.text || '' };
      } else if (block.type === 'image' && block.source) {
        return {
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        };
      }
      return { text: '' };
    });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Google provider is not configured. Please set GOOGLE_AI_API_KEY.');
    }

    const model = this.client.getGenerativeModel({
      model: params.model,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: params.temperature,
      },
    });

    // Convert messages to Gemini chat format
    const history = params.messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: this.convertContent(msg.content),
    }));

    const lastMessage = params.messages[params.messages.length - 1];

    // Start chat with history
    const chat = model.startChat({
      history,
    });

    const result = await chat.sendMessage(this.convertContent(lastMessage.content));
    const response = result.response;

    if (!response.text()) {
      throw new Error('No content received from Google');
    }

    // Note: Gemini API doesn't always provide accurate token counts
    // We'll estimate based on response length if not available
    const tokenEstimate = Math.ceil(response.text().length / 4);

    return {
      content: response.text(),
      usage: {
        inputTokens: 0, // Gemini doesn't provide this consistently
        outputTokens: tokenEstimate,
        totalTokens: tokenEstimate,
      },
      model: params.model,
      provider: this.id,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    const creditsPerK = model?.creditsPerThousandTokens || 0.075;
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
