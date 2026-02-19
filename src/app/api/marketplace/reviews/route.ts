/**
 * Skill Reviews API
 *
 * POST /api/marketplace/reviews - Submit a review
 * GET /api/marketplace/reviews - Get reviews for a skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/reviews
 *
 * Query params:
 *   - skillId: string (required)
 *   - limit: number (default: 20)
 *   - offset: number (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const skillId = searchParams.get('skillId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!skillId) {
      return NextResponse.json(
        { error: 'skillId is required' },
        { status: 400 }
      );
    }

    const [reviews, totalCount] = await Promise.all([
      prisma.skillReview.findMany({
        where: {
          skillId,
          isVerified: true, // Only show verified reviews
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.skillReview.count({
        where: { skillId, isVerified: true },
      }),
    ]);

    return NextResponse.json({
      reviews,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    captureAPIError(error as Error, '/api/marketplace/reviews', 'GET');

    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/reviews
 *
 * Submit a review for a skill.
 *
 * Request body:
 *   {
 *     skillId: string;
 *     rating: number; // 1-5 stars
 *     title?: string;
 *     comment?: string;
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { skillId, rating, title, comment } = body;

    // Validate required fields
    if (!skillId || rating === undefined) {
      return NextResponse.json(
        { error: 'skillId and rating are required' },
        { status: 400 }
      );
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if user has installed the skill
    const installation = await prisma.skillInstallation.findFirst({
      where: {
        userId: session.user.id,
        skillId,
      },
    });

    if (!installation) {
      return NextResponse.json(
        { error: 'You must install the skill before reviewing it' },
        { status: 400 }
      );
    }

    // Check if user has already reviewed this skill
    const existingReview = await prisma.skillReview.findFirst({
      where: {
        userId: session.user.id,
        skillId,
      },
    });

    if (existingReview) {
      // Update existing review
      const updatedReview = await prisma.skillReview.update({
        where: { id: existingReview.id },
        data: {
          rating,
          title,
          comment,
          isVerified: true, // Auto-verify since user has installed
        },
      });

      // Recalculate skill average rating
      await recalculateSkillRating(skillId);

      return NextResponse.json({
        success: true,
        review: updatedReview,
        message: 'Review updated successfully',
      });
    }

    // Create new review
    const review = await prisma.skillReview.create({
      data: {
        userId: session.user.id,
        skillId,
        rating,
        title,
        comment,
        isVerified: true, // Auto-verify since user has installed
      },
    });

    // Recalculate skill average rating
    await recalculateSkillRating(skillId);

    console.log(
      `[Marketplace] Review submitted for skill ${skillId} by ${session.user.email}: ${rating} stars`
    );

    return NextResponse.json({
      success: true,
      review,
      message: 'Review submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    captureAPIError(error as Error, '/api/marketplace/reviews', 'POST');

    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}

/**
 * Recalculate skill average rating
 */
async function recalculateSkillRating(skillId: string): Promise<void> {
  const reviews = await prisma.skillReview.findMany({
    where: { skillId, isVerified: true },
    select: { rating: true },
  });

  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = totalRating / reviews.length;

  await prisma.customSkill.update({
    where: { id: skillId },
    data: {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviewCount: reviews.length,
    },
  });
}
