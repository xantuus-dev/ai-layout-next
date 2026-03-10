/**
 * GET /api/images/[id]
 * Fetch a single generated image
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Fetch the image
    const image = await prisma.generatedImage.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        prompt: true,
        imageUrl: true,
        width: true,
        height: true,
        creditsUsed: true,
        model: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Check if image exists
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // 5. Check if user owns the image
    if (image.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - you do not own this image' },
        { status: 403 }
      );
    }

    // 6. Return the image
    return NextResponse.json(
      {
        success: true,
        image,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/images/[id]
 * Delete a generated image
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Fetch the image to verify ownership
    const image = await prisma.generatedImage.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // 4. Check if user owns the image
    if (image.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - you do not own this image' },
        { status: 403 }
      );
    }

    // 5. Delete the image
    await prisma.generatedImage.delete({
      where: { id },
    });

    // 6. Return success
    return NextResponse.json(
      {
        success: true,
        message: 'Image deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
