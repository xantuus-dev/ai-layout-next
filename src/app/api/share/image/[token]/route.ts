/**
 * GET /api/share/image/[token]
 * Fetch a publicly shared image
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: {
    token: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = params;

    // Find the share link
    const shareLink = await prisma.imageShareLink.findUnique({
      where: { shareToken: token },
      include: {
        image: {
          select: {
            id: true,
            imageUrl: true,
            prompt: true,
            width: true,
            height: true,
            createdAt: true,
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Check if link has expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json(
        { error: 'This share link has expired' },
        { status: 410 } // Gone
      );
    }

    // Check if max views exceeded
    if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
      return NextResponse.json(
        { error: 'This share link has reached its view limit' },
        { status: 410 } // Gone
      );
    }

    // Increment view count
    await prisma.imageShareLink.update({
      where: { id: shareLink.id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    // Return image data
    return NextResponse.json(
      {
        success: true,
        image: {
          imageUrl: shareLink.image.imageUrl,
          prompt: shareLink.image.prompt,
          width: shareLink.image.width,
          height: shareLink.image.height,
          title: shareLink.title,
          message: shareLink.message,
          createdAt: shareLink.image.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching shared image:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch shared image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
