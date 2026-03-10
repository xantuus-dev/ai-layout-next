/**
 * POST /api/images/[id]/share
 * Create a shareable link for an image
 *
 * GET /api/images/[id]/share
 * Get share link details
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

// Create share link
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check image exists and user owns it
    const image = await prisma.generatedImage.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (image.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { title, message, expiresAt, maxViews, allowDownload, allowShare } = body;

    // Create share link
    const shareLink = await prisma.imageShareLink.create({
      data: {
        imageId: id,
        userId: user.id,
        title,
        message,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxViews,
        allowDownload: allowDownload ?? true,
        allowShare: allowShare ?? true,
      },
      select: {
        id: true,
        shareToken: true,
        title: true,
        message: true,
        expiresAt: true,
        maxViews: true,
        allowDownload: true,
        allowShare: true,
        createdAt: true,
      },
    });

    // Generate shareable URL
    const shareUrl = `${process.env.NEXTAUTH_URL}/share/image/${shareLink.shareToken}`;

    return NextResponse.json(
      {
        success: true,
        shareLink: {
          ...shareLink,
          shareUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json(
      {
        error: 'Failed to create share link',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Get share link details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch share links for this image (user's images only)
    const shareLinks = await prisma.imageShareLink.findMany({
      where: {
        imageId: id,
        userId: user.id,
      },
      select: {
        id: true,
        shareToken: true,
        title: true,
        message: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        allowDownload: true,
        allowShare: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate share URLs
    const shareLinksWithUrls = shareLinks.map((link) => ({
      ...link,
      shareUrl: `${process.env.NEXTAUTH_URL}/share/image/${link.shareToken}`,
    }));

    return NextResponse.json(
      {
        success: true,
        shareLinks: shareLinksWithUrls,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching share links:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch share links',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
