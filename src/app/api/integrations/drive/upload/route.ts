import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleDriveClient } from '@/lib/google-drive';

export async function POST(req: NextRequest) {
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

    // Parse request body
    const { name, content, mimeType, folderId } = await req.json();

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    // Initialize Drive client
    const driveClient = new GoogleDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
      user.googleTokenExpiry
    );

    // Upload file
    const file = await driveClient.uploadFile({
      name,
      content,
      mimeType: mimeType || 'text/plain',
      folderId,
    });

    return NextResponse.json({
      success: true,
      file,
    });
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to Drive' },
      { status: 500 }
    );
  }
}
