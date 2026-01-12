import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    // Get template
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        title: true,
        tier: true,
        requiresGoogleDrive: true,
        requiresGmail: true,
        requiresCalendar: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get user session
    const session = await getServerSession(authOptions);

    // Determine user tier (default to 'free' if not logged in)
    let userTier: 'free' | 'pro' | 'enterprise' = 'free';

    if (session?.user) {
      // Map user plan to tier
      const userPlan = session.user.plan || 'free';
      userTier = userPlan.toLowerCase() as 'free' | 'pro' | 'enterprise';
    }

    // Determine template tier
    const templateTier = (template.tier || 'free') as 'free' | 'pro' | 'enterprise';

    // Check access based on tier hierarchy
    const tierHierarchy = {
      'free': 0,
      'pro': 1,
      'enterprise': 2,
    };

    const hasAccess = tierHierarchy[userTier] >= tierHierarchy[templateTier];

    // Check integration requirements
    const missingIntegrations: string[] = [];

    // For now, we'll track what's required but not enforce until Phase 2
    if (template.requiresGoogleDrive) missingIntegrations.push('Google Drive');
    if (template.requiresGmail) missingIntegrations.push('Gmail');
    if (template.requiresCalendar) missingIntegrations.push('Google Calendar');

    return NextResponse.json({
      hasAccess,
      userTier,
      templateTier,
      templateTitle: template.title,
      requiresUpgrade: !hasAccess,
      upgradeUrl: '/pricing',
      missingIntegrations: missingIntegrations.length > 0 ? missingIntegrations : undefined,
      integrationSetupUrl: missingIntegrations.length > 0 ? '/settings/integrations' : undefined,
    });
  } catch (error) {
    console.error('Error checking template access:', error);
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    );
  }
}
