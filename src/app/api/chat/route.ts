import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api-auth';

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
    const rateLimitResult = checkRateLimit(
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
    const { message, files, pastedContent, model, isThinkingEnabled } = body;

    // Validate input
    if (!message && (!files || files.length === 0) && (!pastedContent || pastedContent.length === 0)) {
      return NextResponse.json(
        { error: 'Message, files, or pasted content is required' },
        { status: 400 }
      );
    }

    // Check if user has enough credits
    if (user.creditsUsed >= user.monthlyCredits) {
      return NextResponse.json(
        {
          error: 'Credit limit reached',
          message: 'You have used all your monthly credits. Please upgrade your plan or wait for your credits to reset.',
          creditsUsed: user.creditsUsed,
          monthlyCredits: user.monthlyCredits,
        },
        { status: 429 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Map model IDs to Anthropic model names
    const modelMap: Record<string, string> = {
      'opus-4.5': 'claude-opus-4-5-20251101',
      'sonnet-4.5': 'claude-sonnet-4-5-20250929',
      'haiku-4.5': 'claude-haiku-4-5-20250529',
    };

    const anthropicModel = modelMap[model] || 'claude-sonnet-4-5-20250929';

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

    // Call Anthropic API with content blocks
    const apiParams: any = {
      model: anthropicModel,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: contentBlocks.length === 1 && contentBlocks[0].type === 'text'
            ? contentBlocks[0].text
            : contentBlocks,
        },
      ],
    };

    // Add extended thinking if enabled
    if (isThinkingEnabled) {
      apiParams.thinking = {
        type: 'enabled',
        budget_tokens: 2048,
      };
    }

    const response = await anthropic.messages.create(apiParams);

    // Extract text content from response
    let responseText = '';
    if (response.content && response.content.length > 0) {
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }
    }

    if (!responseText) {
      console.error('No text content in Anthropic response:', JSON.stringify(response.content));
      throw new Error('Unable to generate response - no text content received');
    }

    // Calculate credits based on usage (input + output tokens)
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    // Credit calculation: 1 credit per 1000 tokens (adjust as needed)
    const creditsUsed = Math.max(1, Math.ceil(totalTokens / 1000));

    // Record usage in database
    await prisma.usageRecord.create({
      data: {
        userId: user.id,
        type: 'chat',
        model: anthropicModel,
        tokens: totalTokens,
        credits: creditsUsed,
        metadata: {
          inputTokens,
          outputTokens,
          modelRequested: model,
        },
      },
    });

    // Update user's credit usage
    await prisma.user.update({
      where: { id: user.id },
      data: {
        creditsUsed: {
          increment: creditsUsed,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        response: responseText,
        model: model,
        timestamp: new Date().toISOString(),
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          creditsUsed,
          creditsRemaining: user.monthlyCredits - (user.creditsUsed + creditsUsed),
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
