/**
 * Secure model-interaction chokepoint.
 *
 * Every model call should flow through secureChat / secureChatStream rather
 * than calling aiRouter directly. This is the single control point where
 * outbound PII is redacted before it reaches a provider and the provider's
 * response is rehydrated before it reaches the user — the OWASP-recommended
 * "one audited chokepoint" pattern. It is also where the audit log and future
 * output guardrails hook in, so those concerns live in one place instead of
 * being re-implemented at each of the ~9 call sites.
 *
 * The wrapper is deliberately thin and preserves aiRouter's interface, so
 * adopting it at a call site is a near drop-in replacement.
 */

import { aiRouter } from '@/lib/ai-providers';
import type { AIMessage, ChatParams, ChatResponse, StreamEvent } from '@/lib/ai-providers/types';
import {
  createRedactionContext,
  redactMessages,
  rehydrateText,
  createStreamRehydrator,
  redactionSummary,
  type RedactionOptions,
} from './redaction';
import { getProviderPolicy } from './provider-policy';
import { logAiInteraction } from './audit';

/** Flatten message text for a prompt digest (hashed, never stored raw). */
function promptDigest(messages: AIMessage[]): string {
  return messages
    .map((m) =>
      typeof m.content === 'string'
        ? m.content
        : m.content.map((b) => (b.type === 'text' ? b.text ?? '' : `[${b.type}]`)).join('')
    )
    .join('\n');
}

/**
 * Record one audit-log entry for a completed model call. Best-effort and
 * fire-and-forget: never delays or breaks the response. Skipped when there is
 * no user to attribute the call to.
 */
function recordAudit(params: {
  options: SecureChatOptions;
  modelId: string;
  messages: AIMessage[];
  responseText: string;
  usage?: { inputTokens: number; outputTokens: number };
  redaction: RedactionSummary;
}): void {
  const { options } = params;
  if (!options.userId) return;

  const provider = aiRouter.getProviderForModel(params.modelId)?.id;
  const policy = getProviderPolicy(provider);

  void logAiInteraction({
    userId: options.userId,
    surface: options.surface ?? 'unknown',
    provider,
    model: params.modelId,
    inputTokens: params.usage?.inputTokens ?? 0,
    outputTokens: params.usage?.outputTokens ?? 0,
    redactionCount: params.redaction.total,
    redactionTypes: params.redaction.byType,
    zdr: policy.zeroDataRetention,
    promptText: promptDigest(params.messages),
    responseText: params.responseText,
  });
}

export interface RedactionSummary {
  total: number;
  byType: Record<string, number>;
}

export interface SecureChatOptions {
  /**
   * Outbound PII redaction. `true` (default) uses the low-false-positive
   * standard tier; pass `{ strict: true }` for untrusted surfaces (agent tool
   * output, scraped pages). `false` disables redaction — only for surfaces that
   * genuinely need the raw text (e.g. fact extraction that must read the real
   * content).
   */
  redact?: boolean | RedactionOptions;
  /** Logical surface name, for audit/telemetry (e.g. 'chat', 'agent'). */
  surface?: string;
  /** Owning user, for audit/telemetry. */
  userId?: string;
  /**
   * Invoked once, immediately after outbound redaction, with what was redacted.
   * Lets a route surface a "N items redacted" indicator to the client without
   * waiting for the full response. Never receives original values.
   */
  onRedaction?: (summary: RedactionSummary) => void;
}

function resolveRedactionOptions(
  redact: SecureChatOptions['redact']
): RedactionOptions | null {
  if (redact === false) return null;
  if (redact === undefined || redact === true) return {};
  return redact;
}

export interface SecureChatResponse extends ChatResponse {
  redaction: RedactionSummary;
}

/**
 * Non-streaming secured chat. Redacts the prompt, calls the model, and restores
 * redacted values in the response text.
 */
export async function secureChat(
  modelId: string,
  params: Omit<ChatParams, 'model'>,
  options: SecureChatOptions = {}
): Promise<SecureChatResponse> {
  const redactionOptions = resolveRedactionOptions(options.redact);
  const ctx = createRedactionContext();

  const messages = redactionOptions
    ? redactMessages(params.messages, ctx, redactionOptions)
    : params.messages;

  const summary = redactionSummary(ctx);
  options.onRedaction?.(summary);

  const response = await aiRouter.chat(modelId, { ...params, messages });
  const content = redactionOptions ? rehydrateText(response.content, ctx) : response.content;

  recordAudit({
    options,
    modelId,
    messages: params.messages,
    responseText: content,
    usage: response.usage,
    redaction: summary,
  });

  return { ...response, content, redaction: summary };
}

/**
 * Streaming secured chat. Redacts the prompt, then rehydrates placeholders in
 * the streamed text/thinking deltas as they arrive — buffering only enough to
 * reassemble a placeholder that was split across deltas.
 */
export async function* secureChatStream(
  modelId: string,
  params: Omit<ChatParams, 'model'>,
  options: SecureChatOptions = {}
): AsyncGenerator<StreamEvent, void, unknown> {
  const redactionOptions = resolveRedactionOptions(options.redact);
  const ctx = createRedactionContext();

  const messages = redactionOptions
    ? redactMessages(params.messages, ctx, redactionOptions)
    : params.messages;

  const summary = redactionSummary(ctx);
  options.onRedaction?.(summary);

  // Rehydration is only needed when something was actually redacted; otherwise
  // we avoid the buffering cost. Either way we accumulate the answer text and
  // final usage to feed the audit log once the stream completes.
  const needsRehydrate = !!redactionOptions && ctx.restore.size > 0;
  const textRehydrator = needsRehydrate ? createStreamRehydrator(ctx) : null;
  const thinkingRehydrator = needsRehydrate ? createStreamRehydrator(ctx) : null;

  let answer = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const event of aiRouter.chatStream(modelId, { ...params, messages })) {
    if (event.type === 'text') {
      const out = textRehydrator ? textRehydrator.push(event.delta) : event.delta;
      if (out) {
        answer += out;
        yield { type: 'text', delta: out };
      }
    } else if (event.type === 'thinking') {
      const out = thinkingRehydrator ? thinkingRehydrator.push(event.delta) : event.delta;
      if (out) yield { type: 'thinking', delta: out };
    } else {
      // 'done': flush any held-back tail before the terminal event.
      if (textRehydrator) {
        const text = textRehydrator.flush();
        if (text) {
          answer += text;
          yield { type: 'text', delta: text };
        }
      }
      if (thinkingRehydrator) {
        const thinking = thinkingRehydrator.flush();
        if (thinking) yield { type: 'thinking', delta: thinking };
      }
      usage = event.usage;
      yield event;
    }
  }

  recordAudit({ options, modelId, messages: params.messages, responseText: answer, usage, redaction: summary });
}
