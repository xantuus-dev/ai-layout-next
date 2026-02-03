/**
 * User Personalization API
 *
 * GET /api/user/personalization - Fetch user's personalization data
 * POST /api/user/personalization - Update user's personalization data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET - Fetch current user's personalization data
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        nickname: true,
        occupation: true,
        bio: true,
        customInstructions: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        nickname: user.nickname || '',
        occupation: user.occupation || '',
        bio: user.bio || '',
        customInstructions: user.customInstructions || '',
      },
    });
  } catch (error: any) {
    console.error('Personalization GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personalization data', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Update user's personalization data
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { nickname, occupation, bio, customInstructions } = body;

    // Validate character limits
    const validationErrors: string[] = [];

    if (nickname && nickname.length > 50) {
      validationErrors.push('Nickname must be 50 characters or less');
    }

    if (occupation && occupation.length > 100) {
      validationErrors.push('Occupation must be 100 characters or less');
    }

    if (bio && bio.length > 2000) {
      validationErrors.push('Bio must be 2000 characters or less');
    }

    if (customInstructions && customInstructions.length > 3000) {
      validationErrors.push('Custom instructions must be 3000 characters or less');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validationErrors },
        { status: 400 }
      );
    }

    // Convert empty strings to null for database
    const nicknameValue = nickname && nickname.trim() !== '' ? nickname.trim() : null;
    const occupationValue = occupation && occupation.trim() !== '' ? occupation.trim() : null;
    const bioValue = bio && bio.trim() !== '' ? bio.trim() : null;
    const customInstructionsValue =
      customInstructions && customInstructions.trim() !== '' ? customInstructions.trim() : null;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        nickname: nicknameValue,
        occupation: occupationValue,
        bio: bioValue,
        customInstructions: customInstructionsValue,
      },
      select: {
        nickname: true,
        occupation: true,
        bio: true,
        customInstructions: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Personalization updated successfully',
      data: {
        nickname: updatedUser.nickname || '',
        occupation: updatedUser.occupation || '',
        bio: updatedUser.bio || '',
        customInstructions: updatedUser.customInstructions || '',
      },
    });
  } catch (error: any) {
    console.error('Personalization POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update personalization data', message: error.message },
      { status: 500 }
    );
  }
}
