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

/**
 * How a model accepts extended thinking. The request shape is not portable
 * across generations, so it is recorded per model rather than assumed:
 *
 * - 'adaptive' — Claude 4.6 and later. `{type: 'adaptive'}`; the model decides
 *   depth. Sending `budget_tokens` to these returns a 400.
 * - 'budget'   — Claude 4.5 and earlier. `{type: 'enabled', budget_tokens: N}`.
 *   These do not accept `{type: 'adaptive'}`.
 * - 'none'     — no extended thinking.
 */
export type ThinkingStyle = 'adaptive' | 'budget' | 'none';

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
  /** Defaults to 'none' when omitted. */
  thinkingStyle?: ThinkingStyle;
  /**
   * Whether the model accepts temperature/top_p/top_k. Claude 4.7 and later
   * reject them outright, so they must be withheld rather than passed blindly.
   * Defaults to true when omitted (correct for older models and non-Claude
   * providers).
   */
  supportsSampling?: boolean;
  /** True when the model is superseded but kept so old conversations still resolve. */
  legacy?: boolean;
}

/**
 * A single event from a streaming completion.
 *
 * `thinking` carries extended-thinking deltas, which are kept separate from
 * `text` so the UI can render reasoning in its own collapsed block rather than
 * inlining it into the answer.
 */
export type StreamEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | {
      type: 'done';
      usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      finishReason?: string;
    };

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  isConfigured: () => boolean;
  chat(params: ChatParams): Promise<ChatResponse>;
  /**
   * Optional real token-by-token streaming. Providers that do not implement
   * this still work — the router falls back to `chat()` and emits the whole
   * response as a single text event.
   */
  chatStream?(params: ChatParams): AsyncGenerator<StreamEvent, void, unknown>;
  estimateCredits(tokens: number, model: string): number;
}

export interface AIRouterOptions {
  preferredProvider?: string;
  fallbackEnabled?: boolean;
}
