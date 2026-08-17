/**
 * Google (Gemini) Provider Implementation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ChatParams, ChatResponse, AIModel, ContentBlock, ToolCall } from './types';

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
      capabilities: ['vision', 'multimodal', 'code-execution', 'function-calling'],
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
      capabilities: ['vision', 'multimodal', 'long-context', 'function-calling'],
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
      capabilities: ['vision', 'multimodal', 'function-calling'],
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
      } else if (block.type === 'tool_use') {
        return { functionCall: { name: block.name, args: block.input ?? {} } };
      } else if (block.type === 'tool_result') {
        // `response` must be an object per the SDK's FunctionResponse type —
        // our tool_result content is always a JSON string, so wrap it.
        return { functionResponse: { name: block.name, response: { result: block.content ?? '' } } };
      }
      return { text: '' };
    });
  }

  /**
   * Gemini's history validation (VALID_PARTS_PER_ROLE in the SDK) rejects
   * `functionResponse` parts under role 'user' — only role 'function' may
   * carry them. Our internal convention keeps tool-result AIMessages at role
   * 'user' uniformly across providers, so this maps that one case on the way
   * out; everything else follows the existing assistant->model mapping.
   */
  private toGeminiRole(msg: { role: string; content: string | ContentBlock[] }): string {
    const blocks = Array.isArray(msg.content) ? msg.content : null;
    if (blocks?.length && blocks.every(b => b.type === 'tool_result')) {
      return 'function';
    }
    return msg.role === 'assistant' ? 'model' : 'user';
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('Google provider is not configured. Please set GOOGLE_AI_API_KEY.');
    }

    // Instruction hierarchy (prompt-injection defense): route system messages
    // through Gemini's dedicated `systemInstruction` rather than folding them
    // into the conversation as `user` turns, where they would be
    // indistinguishable from — and overridable by — actual user input.
    const systemText = params.messages
      .filter(msg => msg.role === 'system')
      .map(msg =>
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(block => block.text ?? '').join('')
      )
      .filter(Boolean)
      .join('\n\n');

    const modelConfig: any = {
      model: params.model,
      ...(systemText ? { systemInstruction: systemText } : {}),
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: params.temperature,
      },
    };

    if (params.tools?.length) {
      // Cast: the SDK's Schema type requires SchemaType enum members (nominal,
      // not structural) where we pass plain lowercase string literals — the
      // values line up 1:1 at runtime ('object', 'string', ...), only the
      // static type disagrees.
      modelConfig.tools = [{
        functionDeclarations: params.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as any,
        })),
      }];
    }

    const model = this.client.getGenerativeModel(modelConfig);

    // Convert the non-system messages to Gemini chat format.
    const conversation = params.messages.filter(msg => msg.role !== 'system');
    const history = conversation.slice(0, -1).map(msg => ({
      role: this.toGeminiRole(msg),
      parts: this.convertContent(msg.content),
    }));

    const lastMessage = conversation[conversation.length - 1];

    // Start chat with history
    const chat = model.startChat({
      history,
    });

    const result = await chat.sendMessage(this.convertContent(lastMessage.content));
    const response = result.response;

    const text = response.text(); // '' for a pure tool-call turn, never throws on that alone
    const calls = response.functionCalls() ?? [];

    // Gemini's FunctionCall has no id (confirmed in the SDK's own types) —
    // synthesize one, unique enough within this loop's lifetime.
    const toolCalls: ToolCall[] | undefined = calls.length
      ? calls.map((fc, i) => ({
          id: `g_${Date.now()}_${i}`,
          name: fc.name,
          input: (fc.args ?? {}) as Record<string, unknown>,
        }))
      : undefined;

    const contentBlocks: ContentBlock[] | undefined = toolCalls
      ? [
          ...(text ? [{ type: 'text' as const, text }] : []),
          ...toolCalls.map(c => ({ type: 'tool_use' as const, ...c })),
        ]
      : undefined;

    if (!text && !toolCalls) {
      throw new Error('No content received from Google');
    }

    // Note: Gemini API doesn't always provide accurate token counts
    // We'll estimate based on response length if not available
    const tokenEstimate = Math.ceil(text.length / 4);

    return {
      content: text,
      contentBlocks,
      toolCalls,
      usage: {
        inputTokens: 0, // Gemini doesn't provide this consistently
        outputTokens: tokenEstimate,
        totalTokens: tokenEstimate,
      },
      model: params.model,
      provider: this.id,
      finishReason: toolCalls ? 'tool_use' : undefined,
    };
  }

  estimateCredits(tokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      console.warn(`⚠️  No credit pricing for Google model "${modelId}" — billing at highest known rate`);
    }
    const creditsPerK = model?.creditsPerThousandTokens
      ?? Math.max(...this.models.map(m => m.creditsPerThousandTokens));
    return Math.max(1, Math.ceil((tokens / 1000) * creditsPerK));
  }
}
