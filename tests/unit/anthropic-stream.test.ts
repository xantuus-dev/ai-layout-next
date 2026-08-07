import { describe, it, expect } from 'vitest';
import { AnthropicProvider } from '@/lib/ai-providers/anthropic';
import type { StreamEvent } from '@/lib/ai-providers/types';

// The streaming path is what makes time-to-first-token ~1.7s instead of the
// full generation time, so these guard the delta mapping rather than the
// network: a fake client stands in for the SDK's MessageStream.

type RawEvent = { type: string; delta?: { type: string; text?: string; thinking?: string } };

function fakeStream(events: RawEvent[], usage = { input_tokens: 10, output_tokens: 20 }) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    async finalMessage() {
      return { usage, stop_reason: 'end_turn' };
    },
  };
}

/** Build a provider whose SDK client is replaced by a scripted stream. */
function providerYielding(events: RawEvent[], usage?: { input_tokens: number; output_tokens: number }) {
  const provider = new AnthropicProvider();
  (provider as any).client = {
    messages: { stream: () => fakeStream(events, usage) },
  };
  return provider;
}

async function collect(gen: AsyncGenerator<StreamEvent, void, unknown>) {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const params = { model: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user' as const, content: 'hi' }] };

describe('AnthropicProvider.chatStream', () => {
  it('maps text deltas to text events, in order', async () => {
    const provider = providerYielding([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
    ]);

    const events = await collect(provider.chatStream(params));
    const text = events.filter((e) => e.type === 'text');

    expect(text).toEqual([
      { type: 'text', delta: 'Hello' },
      { type: 'text', delta: ' world' },
    ]);
  });

  it('keeps thinking deltas separate from answer text', async () => {
    const provider = providerYielding([
      { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Let me consider' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'The answer' } },
    ]);

    const events = await collect(provider.chatStream(params));

    // The UI renders these in different places, so they must not be merged.
    expect(events.filter((e) => e.type === 'thinking')).toEqual([
      { type: 'thinking', delta: 'Let me consider' },
    ]);
    expect(events.filter((e) => e.type === 'text')).toEqual([
      { type: 'text', delta: 'The answer' },
    ]);
  });

  it('ignores signature deltas and non-delta events', async () => {
    const provider = providerYielding([
      { type: 'message_start' },
      { type: 'content_block_start' },
      { type: 'content_block_delta', delta: { type: 'signature_delta' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } },
      { type: 'message_stop' },
    ]);

    const events = await collect(provider.chatStream(params));

    expect(events.filter((e) => e.type === 'text' || e.type === 'thinking')).toEqual([
      { type: 'text', delta: 'ok' },
    ]);
  });

  it('ends with a done event carrying usage totals', async () => {
    const provider = providerYielding(
      [{ type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } }],
      { input_tokens: 100, output_tokens: 250 }
    );

    const events = await collect(provider.chatStream(params));
    const last = events[events.length - 1];

    // Credits are billed off these totals, so the arithmetic matters.
    expect(last).toEqual({
      type: 'done',
      usage: { inputTokens: 100, outputTokens: 250, totalTokens: 350 },
      finishReason: 'end_turn',
    });
  });

  it('still emits done when the model produced no content', async () => {
    const provider = providerYielding([]);
    const events = await collect(provider.chatStream(params));

    // An empty response must not leave the route waiting forever.
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });

  it('throws a clear error when the provider is not configured', async () => {
    const provider = new AnthropicProvider();
    (provider as any).client = null;

    await expect(collect(provider.chatStream(params))).rejects.toThrow(/not configured/i);
  });
});
