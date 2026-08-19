import { describe, it, expect } from 'vitest';
import { MistralProvider } from '@/lib/ai-providers/mistral';
import type { StreamEvent } from '@/lib/ai-providers/types';

// Guards the message/tool-call translation between our provider-neutral
// shapes and Mistral's SDK types (verified against node_modules/@mistralai/
// mistralai's .d.ts files while building this, not assumed from memory) — a
// fake client stands in for the network, matching the pattern in
// anthropic-stream.test.ts.

function providerWith(client: any) {
  const provider = new MistralProvider();
  (provider as any).client = client;
  return provider;
}

async function collect(gen: AsyncGenerator<StreamEvent, void, unknown>) {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const params = { model: 'mistral-large-latest', messages: [{ role: 'user' as const, content: 'hi' }] };

describe('MistralProvider.chat', () => {
  it('returns plain text content and usage', async () => {
    const provider = providerWith({
      chat: {
        complete: async () => ({
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello there' }, finishReason: 'stop' }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
      },
    });

    const result = await provider.chat(params);

    expect(result.content).toBe('Hello there');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(result.finishReason).toBe('stop');
  });

  it('extracts tool calls and parses stringified arguments', async () => {
    const provider = providerWith({
      chat: {
        complete: async () => ({
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                toolCalls: [
                  { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
                ],
              },
              finishReason: 'tool_calls',
            },
          ],
          usage: { promptTokens: 8, completionTokens: 4, totalTokens: 12 },
        }),
      },
    });

    const result = await provider.chat(params);

    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'get_weather', input: { city: 'Paris' } }]);
    expect(result.contentBlocks).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Paris' } },
    ]);
  });

  it('fans a tool_result content block out into a separate role:tool message', async () => {
    let capturedMessages: any[] = [];
    const provider = providerWith({
      chat: {
        complete: async (req: any) => {
          capturedMessages = req.messages;
          return {
            choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finishReason: 'stop' }],
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          };
        },
      },
    });

    await provider.chat({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'call_1', name: 'get_weather', content: '{"temp":20}' }],
        },
      ],
    });

    expect(capturedMessages).toEqual([
      { role: 'tool', content: '{"temp":20}', toolCallId: 'call_1', name: 'get_weather' },
    ]);
  });

  it('throws a clear error when the provider is not configured', async () => {
    const provider = new MistralProvider();
    (provider as any).client = null;
    await expect(provider.chat(params)).rejects.toThrow(/not configured/i);
  });
});

describe('MistralProvider.chatStream', () => {
  function fakeStream(events: { content?: string; usage?: any; finishReason?: string }[]) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const e of events) {
          yield {
            data: {
              id: 'x',
              model: 'mistral-large-latest',
              usage: e.usage,
              choices: [{ index: 0, delta: { content: e.content }, finishReason: e.finishReason ?? null }],
            },
          };
        }
      },
    };
  }

  it('maps text deltas to text events, in order', async () => {
    const provider = providerWith({
      chat: { stream: async () => fakeStream([{ content: 'Hello' }, { content: ' world' }]) },
    });

    const events = await collect(provider.chatStream(params));
    expect(events.filter((e) => e.type === 'text')).toEqual([
      { type: 'text', delta: 'Hello' },
      { type: 'text', delta: ' world' },
    ]);
  });

  it('ends with a done event carrying the last-seen usage totals', async () => {
    const provider = providerWith({
      chat: {
        stream: async () =>
          fakeStream([
            { content: 'x', usage: { promptTokens: 100, completionTokens: 1 } },
            { content: 'y', finishReason: 'stop', usage: { promptTokens: 100, completionTokens: 250 } },
          ]),
      },
    });

    const events = await collect(provider.chatStream(params));
    const last = events[events.length - 1];

    expect(last).toEqual({
      type: 'done',
      usage: { inputTokens: 100, outputTokens: 250, totalTokens: 350 },
      finishReason: 'stop',
    });
  });

  it('still emits done when the model produced no content', async () => {
    const provider = providerWith({ chat: { stream: async () => fakeStream([]) } });
    const events = await collect(provider.chatStream(params));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });

  it('throws a clear error when the provider is not configured', async () => {
    const provider = new MistralProvider();
    (provider as any).client = null;
    await expect(collect(provider.chatStream(params))).rejects.toThrow(/not configured/i);
  });
});

describe('MistralProvider.estimateCredits', () => {
  it('bills an unrecognized model at the highest known rate, not a guessed default', () => {
    const provider = new MistralProvider();
    const highest = Math.max(...provider.models.map((m) => m.creditsPerThousandTokens));

    const credits = provider.estimateCredits(1000, 'mistral-unreleased-model');

    expect(credits).toBe(Math.max(1, Math.ceil(highest)));
  });
});
