/**
 * Slack OAuth Callback API
 *
 * Handles the OAuth callback from Slack after user authorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSlackTokensFromCode, testSlackToken } from '@/lib/slack-oauth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    // Get authorization code, state, and error from query params
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('Slack OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=no_code', req.url)
      );
    }

    // Decode and validate state
    let stateData: {
      userId: string;
      returnUrl: string;
      timestamp: number;
    };
    try {
      stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());

      // Validate state isn't too old (10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        throw new Error('State expired');
      }

      // Validate user ID matches
      if (stateData.userId !== session.user.id) {
        throw new Error('User ID mismatch');
      }
    } catch (err) {
      console.error('Invalid state:', err);
      return NextResponse.redirect(
        new URL('/settings/integrations?error=invalid_state', req.url)
      );
    }

    // Exchange code for tokens
    const tokens = await getSlackTokensFromCode(code);

    if (!tokens.access_token) {
      throw new Error('No access token received from Slack');
    }

    // Test the token to get workspace info
    const authTest = await testSlackToken(tokens.access_token);

    if (!authTest.ok) {
      throw new Error(`Slack auth test failed: ${authTest.error}`);
    }

    // Upsert Integration record
    await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'slack',
        },
      },
      create: {
        userId: session.user.id,
        provider: 'slack',
        name: `Slack - ${authTest.team || 'Workspace'}`,
        accessToken: tokens.access_token,
        refreshToken: tokens.authed_user?.access_token, // User token (if any)
        scopes: tokens.scope.split(','),
        config: {
          teamId: authTest.team_id,
          teamName: authTest.team,
          userId: authTest.user_id,
          botUserId: tokens.bot_user_id,
          appId: tokens.app_id,
          url: authTest.url,
        },
        isActive: true,
      },
      update: {
        name: `Slack - ${authTest.team || 'Workspace'}`,
        accessToken: tokens.access_token,
        refreshToken: tokens.authed_user?.access_token,
        scopes: tokens.scope.split(','),
        config: {
          teamId: authTest.team_id,
          teamName: authTest.team,
          userId: authTest.user_id,
          botUserId: tokens.bot_user_id,
          appId: tokens.app_id,
          url: authTest.url,
        },
        isActive: true,
        lastSyncAt: new Date(),
      },
    });

    // Redirect to return URL with success message
    const returnUrl = stateData.returnUrl || '/settings/integrations';
    return NextResponse.redirect(
      new URL(
        `${returnUrl}?success=true&service=Slack&workspace=${encodeURIComponent(authTest.team || 'Unknown')}`,
        req.url
      )
    );
  } catch (error) {
    console.error('Error handling Slack OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=callback_failed&details=${encodeURIComponent((error as Error).message)}`, req.url)
    );
  }
}
