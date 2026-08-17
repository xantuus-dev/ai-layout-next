/**
 * Multi-Provider AI Architecture
 * Type definitions for unified AI provider interface
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  // tool_use — "I want to call this tool" (assistant turn)
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result — "here's what it returned" (user turn). `name` is also set
  // here (= the originating call's tool name) so google.ts can build a
  // functionResponse part without an id->name lookup table — Gemini's
  // function calling has no id concept at all.
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

/**
 * Provider-neutral tool definition, translated by each provider into its own
 * wire format (Anthropic input_schema / OpenAI function.parameters / Google
 * functionDeclarations.parameters).
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; enum?: string[]; items?: any }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

/** A single tool invocation requested by the model. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
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
  tools?: ToolDefinition[];
}

export interface ChatResponse {
  content: string;
  /**
   * The exact ordered content-block sequence to replay as the next assistant
   * AIMessage. Needed (rather than just `content`) because order matters for
   * interleaved text/tool_use blocks and because tool_use blocks carry fields
   * `content` alone can't represent. Absent when the turn was plain text.
   */
  contentBlocks?: ContentBlock[];
  /** Convenience extraction of the tool_use blocks in `contentBlocks`, if any. */
  toolCalls?: ToolCall[];
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
