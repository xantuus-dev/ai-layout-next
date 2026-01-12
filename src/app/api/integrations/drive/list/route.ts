import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleDriveClient } from '@/lib/google-drive';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with Drive credentials
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
        googleDriveEnabled: true,
      },
    });

    if (!user?.googleDriveEnabled || !user.googleAccessToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const folderId = searchParams.get('folderId') || undefined;
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const query = searchParams.get('query') || undefined;

    // Initialize Drive client
    const driveClient = new GoogleDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
      user.googleTokenExpiry
    );

    // List files
    const files = await driveClient.listFiles({
      folderId,
      pageSize,
      query,
    });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return NextResponse.json(
      { error: 'Failed to list Drive files' },
      { status: 500 }
    );
  }
}
