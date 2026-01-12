import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGmailClient, EmailMessage } from '@/lib/google-gmail';

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

    // Get user with Gmail credentials
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
        googleGmailEnabled: true,
      },
    });

    if (!user?.googleGmailEnabled || !user.googleAccessToken) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 403 }
      );
    }

    // Parse request body
    const emailData: EmailMessage = await req.json();

    if (!emailData.to || !emailData.subject || !emailData.body) {
      return NextResponse.json(
        { error: 'To, subject, and body are required' },
        { status: 400 }
      );
    }

    // Initialize Gmail client
    const gmailClient = new GoogleGmailClient(
      user.googleAccessToken,
      user.googleRefreshToken,
      user.googleTokenExpiry
    );

    // Send email
    const result = await gmailClient.sendEmail(emailData);

    return NextResponse.json({
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
