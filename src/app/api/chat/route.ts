import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { aiRouter } from '@/lib/ai-providers';
import { secureChat } from '@/lib/ai-security/guard';
import { checkAndResetCredits, getCreditStatus, estimateTurnCredits } from '@/lib/credits';
import { assertCanSpend, spendCredits } from '@/lib/billing/gate';
import { buildSystemPrompt } from '@/lib/personalization';
import { getMemoryContext, extractAndStoreFacts, shouldExtractFacts } from '@/lib/memory/facts';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Check authentication (session or API key)
    const userId = await getAuthenticatedUserId(request, session);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in or provide a valid API key' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check rate limit (use user ID for consistency)
    const rateLimitResult = await checkRateLimit(
      `chat:${user.id}`,
      RATE_LIMITS.CHAT
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { message, files, pastedContent, model, isThinkingEnabled, history = [] } = body;

    // Validate input
    if (!message && (!files || files.length === 0) && (!pastedContent || pastedContent.length === 0)) {
      return NextResponse.json(
        { error: 'Message, files, or pasted content is required' },
        { status: 400 }
      );
    }

    // Reset credits if the monthly window has rolled over.
    // (transparently resolves to the team billing pool if this user is a team member)
    await checkAndResetCredits(user.id);

    // Map legacy model IDs to new full model names for backward compatibility
    const modelMap: Record<string, string> = {
      'opus-4.5': 'claude-opus-4-5-20251101',
      'sonnet-4.5': 'claude-sonnet-4-5-20250929',
      'haiku-4.5': 'claude-haiku-4-5-20250529',
    };

    // Use full model ID or map from legacy ID
    const modelId = modelMap[model] || model || 'claude-sonnet-4-5-20250929';

    // Gate on what this turn is expected to cost, not on zero.
    //
    // This previously called hasEnoughCredits(user.id, 0), which evaluates
    // `used + 0 <= monthly` — true at exactly the limit. An account with no
    // credits left was served anyway, and only a user already overdrawn was
    // ever refused. Estimating per model also means an Opus turn is refused
    // sooner than a Haiku one, which is the point of tiered pricing.
    const estimatedCredits = estimateTurnCredits(
      aiRouter.getModel(modelId)?.creditsPerThousandTokens ?? 1
    );

    // Routed through the billing gate rather than hasEnoughCredits: the gate
    // applies canAfford (which refuses an exactly-exhausted balance) and
    // reports the billing owner's remaining balance for team members, rather
    // than the acting user's.
    const decision = await assertCanSpend(user.id, estimatedCredits);

    if (!decision.allowed) {
      const status = await getCreditStatus(user.id);
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          message:
            decision.reason === 'viewer_cannot_spend'
              ? 'Viewers cannot spend the team credit pool. Ask an admin for access.'
              : 'You have used all your monthly credits. Upgrade your plan or wait for them to reset.',
          creditsNeeded: estimatedCredits,
          creditsRemaining: Math.max(0, decision.remaining),
          creditsResetAt: status?.creditsResetAt ?? null,
        },
        { status: 402 }
      );
    }

    // Verify model exists
    const modelInfo = aiRouter.getModel(modelId);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model "${modelId}" not found or not configured` },
        { status: 400 }
      );
    }

    // Build message content with support for images and text
    const contentBlocks: any[] = [];

    // Add text message if provided
    if (message) {
      contentBlocks.push({
        type: 'text',
        text: message,
      });
    }

    // Add pasted content if provided
    if (pastedContent && pastedContent.length > 0) {
      for (const content of pastedContent) {
        contentBlocks.push({
          type: 'text',
          text: `\n\nPasted Content:\n${content}`,
        });
      }
    }

    // Add files if provided (images as base64)
    if (files && files.length > 0) {
      for (const file of files) {
        // Check if it's an image
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (imageTypes.includes(file.type)) {
          // File should be in base64 format from the client
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: file.data, // Base64 string without the data:image prefix
            },
          });
        } else {
          // For non-image files, add as text description
          contentBlocks.push({
            type: 'text',
            text: `\n\n[File attached: ${file.name} (${file.type})]`,
          });
        }
      }
    }

    // Determine max tokens and extended thinking based on settings
    const maxTokens = isThinkingEnabled ? 8192 : 4096;

    // Prepare thinking config (only for Anthropic models that support it)
    const thinkingConfig = isThinkingEnabled && modelInfo.capabilities.includes('thinking')
      ? { type: 'enabled' as const, budget_tokens: 2048 }
      : undefined;

    // Format history if present
    const historyMessages = Array.isArray(history) ? history.map((msg: any) => ({
      role: msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user',
      content: msg.content
    })) : [];

    // Pull anything we already know about this user that bears on the message.
    // Returns null (never throws) when memory is empty or unavailable.
    const memoryContext = message
      ? await getMemoryContext(user.id, message)
      : null;

    // Personalization + memory in one system message. The personalization
    // fields had a settings page and an API but were never sent to a model.
    const systemPrompt = buildSystemPrompt(user, memoryContext);

    // Call the model through the security chokepoint: outbound PII is redacted
    // before it reaches the provider and restored in the response. secureChat
    // preserves aiRouter.chat's shape and adds a `redaction` summary.
    const response = await secureChat(
      modelId,
      {
        messages: [
          { role: 'system' as const, content: systemPrompt },
          ...historyMessages,
          {
            role: 'user',
            content: contentBlocks.length === 1 && contentBlocks[0].type === 'text'
              ? contentBlocks[0].text
              : contentBlocks,
          },
        ],
        maxTokens,
        thinking: thinkingConfig,
      },
      { surface: 'chat', userId: user.id }
    );

    if (!response.content) {
      console.error('No text content in AI response');
      throw new Error('Unable to generate response - no text content received');
    }

    // Calculate credits based on usage
    const { inputTokens, outputTokens, totalTokens } = response.usage;
    const creditsUsed = aiRouter.estimateCredits(modelId, totalTokens);

    // Record usage and deduct from the (possibly team-pooled) credit balance
    await spendCredits(user.id, creditsUsed, {
      type: 'chat',
      model: modelId,
      tokens: totalTokens,
      extra: {
        inputTokens,
        outputTokens,
        modelRequested: model,
        provider: response.provider,
      },
    });

    // Learn durable facts from the exchange. Next 14 has no `after()`, so this
    // runs inline — hence the cadence check, which keeps most turns free of it.
    // extractAndStoreFacts swallows its own errors: a memory failure must never
    // cost the user a reply they have already paid credits for.
    const totalMessages = historyMessages.length + 2;
    if (message && shouldExtractFacts(totalMessages)) {
      await extractAndStoreFacts({
        userId: user.id,
        messages: [
          ...historyMessages.map((msg) => ({
            role: String(msg.role),
            content: String(msg.content),
          })),
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
        ],
      });
    }

    const creditStatus = await getCreditStatus(user.id);

    return NextResponse.json(
      {
        success: true,
        response: response.content,
        model: modelId,
        provider: response.provider,
        timestamp: new Date().toISOString(),
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          creditsUsed,
          creditsRemaining: creditStatus?.creditsRemaining ?? null,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    );

  } catch (error) {
    console.error('Error in chat API:', error);

    // Sanitize error messages for production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment && error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
