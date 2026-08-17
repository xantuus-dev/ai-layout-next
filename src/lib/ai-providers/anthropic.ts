/**
 * Anthropic (Claude) Provider Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatParams, ChatResponse, AIModel, StreamEvent, ContentBlock, ToolCall } from './types';
import { ANTHROPIC_MODELS } from './catalog';

/** Translate our provider-neutral content blocks into Anthropic's native block shapes. */
function toAnthropicBlocks(content: string | ContentBlock[]): any {
  if (typeof content === 'string') return content;
  return content.map((b) => {
    if (b.type === 'text') return { type: 'text', text: b.text ?? '' };
    if (b.type === 'image') return { type: 'image', source: b.source };
    if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input ?? {} };
    return { type: 'tool_result', tool_use_id: b.tool_use_id, content: b.content ?? '', is_error: b.is_error };
  });
}

export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  name = 'Anthropic';
  private client: Anthropic | null = null;

  // Catalog lives in ./catalog so the client picker and the credits map can
  // read the same list without pulling in the Anthropic SDK.
  models: AIModel[] = ANTHROPIC_MODELS;

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
    // Instruction hierarchy (prompt-injection defense): system messages carry
    // the app's own instructions (personalization, memory, custom-instruction
    // preferences) and must reach the model through Anthropic's dedicated
    // top-level `system` parameter — NOT as an ordinary `user` turn, which
    // would be indistinguishable from, and overridable by, user input.
    //
    // System content is always plain text here (buildSystemPrompt returns a
    // string); if a caller ever sends block content in a system message we
    // extract its text parts so nothing is silently dropped.
    const systemText = params.messages
      .filter(msg => msg.role === 'system')
      .map(msg =>
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(block => block.text ?? '').join('')
      )
      .filter(Boolean)
      .join('\n\n');

    const anthropicMessages = params.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({ role: msg.role, content: toAnthropicBlocks(msg.content) }));

    const apiParams: any = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      messages: anthropicMessages,
    };

    if (systemText) {
      apiParams.system = systemText;
    }

    if (params.tools?.length) {
      apiParams.tools = params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    // The request shape is not portable across model generations: Claude 4.7+
    // rejects sampling parameters, and the two thinking forms are mutually
    // exclusive. Sending the wrong one is a 400, not a soft degrade — so the
    // shape is chosen from the model's own metadata rather than assumed.
    // An unknown id (e.g. one only present in a stored conversation) falls back
    // to the permissive older shape, which is what such ids will be.
    const model = this.models.find(m => m.id === params.model);

    // Two independent reasons to withhold temperature:
    //  - Claude 4.7+ reject it outright.
    //  - On every model, enabling thinking restricts it to exactly 1
    //    ("`temperature` may only be set to 1 when thinking is enabled"),
    //    so passing a caller's value alongside thinking is a 400.
    const samplingAllowed = (model?.supportsSampling ?? true) && !params.thinking;
    if (params.temperature !== undefined && samplingAllowed) {
      apiParams.temperature = params.temperature;
    }

    if (params.thinking) {
      const style = model?.thinkingStyle ?? 'budget';

      if (style === 'adaptive') {
        // display defaults to "omitted" on these models, which streams thinking
        // blocks with empty text — the reasoning UI would render a blank block.
        // Ask for summaries explicitly.
        apiParams.thinking = { type: 'adaptive', display: 'summarized' };
      } else if (style === 'budget') {
        apiParams.thinking = params.thinking;
      }
      // style 'none': the model has no extended thinking; omit the field.
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

    // Extract text and tool_use blocks from response
    let responseText = '';
    const toolCalls: ToolCall[] = [];
    const contentBlocks: ContentBlock[] = [];
    if (response.content && response.content.length > 0) {
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
          contentBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          const call: ToolCall = {
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          };
          toolCalls.push(call);
          contentBlocks.push({ type: 'tool_use', ...call });
        }
      }
    }

    // A pure tool-use turn has no text — only throw when there is neither.
    if (!responseText && toolCalls.length === 0) {
      throw new Error('No text content received from Anthropic');
    }

    return {
      content: responseText,
      contentBlocks: contentBlocks.length ? contentBlocks : undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
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
