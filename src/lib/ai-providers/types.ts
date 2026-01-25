/**
 * Multi-Provider AI Architecture
 * Type definitions for unified AI provider interface
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ChatParams {
  messages: AIMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

export interface ChatResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  finishReason?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  creditsPerThousandTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  capabilities: string[];
  badge?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  isConfigured: () => boolean;
  chat(params: ChatParams): Promise<ChatResponse>;
  estimateCredits(tokens: number, model: string): number;
}

export interface AIRouterOptions {
  preferredProvider?: string;
  fallbackEnabled?: boolean;
}
