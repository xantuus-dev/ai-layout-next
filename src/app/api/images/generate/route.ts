/**
 * POST /api/images/generate
 * Generate an image from a text prompt
 * Requires authentication and sufficient credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { geminiImageService } from '@/lib/gemini-image';
import { hasEnoughCredits, deductCredits, getImageGenerationCost } from '@/lib/credits';
import { checkAndResetCredits } from '@/lib/credits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        creditsUsed: true,
        monthlyCredits: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Check rate limit (max 10 images per hour)
    const rateLimitKey = `image-generation:${user.id}`;
    const isRateLimited = await checkRateLimit(rateLimitKey, 10, 3600); // 10 per hour
    if (isRateLimited) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Maximum 10 images per hour.',
          retryAfter: 3600,
        },
        { status: 429 }
      );
    }

    // 4. Reset credits if needed
    await checkAndResetCredits(user.id);

    // 5. Parse request body
    const body = await request.json();
    const { prompt, width = 1024, height = 1024 } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (typeof width !== 'number' || typeof height !== 'number') {
      return NextResponse.json({ error: 'Width and height must be numbers' }, { status: 400 });
    }

    // 6. Calculate credits needed
    const creditsNeeded = getImageGenerationCost(width, height);

    // 7. Check if user has enough credits
    const hasCredits = await hasEnoughCredits(user.id, creditsNeeded);
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          creditsNeeded,
          creditsAvailable: user.monthlyCredits - user.creditsUsed,
        },
        { status: 402 } // Payment Required
      );
    }

    // 8. Generate image using Gemini
    let imageUrl: string;
    try {
      const result = await geminiImageService.generateImage({
        prompt,
        width,
        height,
      });
      imageUrl = result.imageUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: 'Image generation failed',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // 9. Save generated image to database
    const generatedImage = await prisma.generatedImage.create({
      data: {
        userId: user.id,
        prompt,
        width,
        height,
        imageUrl,
        creditsUsed: creditsNeeded,
        model: 'gemini-2.0-flash-exp',
        metadata: {
          userAgent: request.headers.get('user-agent'),
        },
      },
    });

    // 10. Deduct credits and create usage record
    await deductCredits(user.id, creditsNeeded, {
      type: 'image-generation',
      model: 'gemini-2.0-flash-exp',
      description: `Image generation: ${prompt.substring(0, 50)}...`,
    });

    // 11. Return success response
    return NextResponse.json(
      {
        success: true,
        image: {
          id: generatedImage.id,
          imageUrl: generatedImage.imageUrl,
          prompt: generatedImage.prompt,
          dimensions: {
            width: generatedImage.width,
            height: generatedImage.height,
          },
          creditsUsed: generatedImage.creditsUsed,
          createdAt: generatedImage.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
