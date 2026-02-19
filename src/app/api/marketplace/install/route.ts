/**
 * Skill Installation API
 *
 * POST /api/marketplace/install - Install a skill
 * DELETE /api/marketplace/install - Uninstall a skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/install
 *
 * Install a skill for the current user.
 *
 * Request body:
 *   {
 *     skillId: string;
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { skillId } = body;

    if (!skillId) {
      return NextResponse.json(
        { error: 'skillId is required' },
        { status: 400 }
      );
    }

    // Fetch skill details
    const skill = await prisma.customSkill.findUnique({
      where: { id: skillId },
      select: {
        id: true,
        name: true,
        status: true,
        pricingModel: true,
        price: true,
        creatorId: true,
        estimatedCreditCost: true,
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    if (skill.status !== 'approved') {
      return NextResponse.json(
        { error: 'Skill is not available for installation' },
        { status: 400 }
      );
    }

    // Check if already installed
    const existingInstallation = await prisma.skillInstallation.findFirst({
      where: {
        userId: session.user.id,
        skillId,
      },
    });

    if (existingInstallation) {
      if (existingInstallation.isActive) {
        return NextResponse.json(
          { error: 'Skill already installed' },
          { status: 400 }
        );
      }

      // Reactivate previous installation
      const installation = await prisma.skillInstallation.update({
        where: { id: existingInstallation.id },
        data: { isActive: true },
      });

      return NextResponse.json({
        success: true,
        installation: {
          id: installation.id,
          skillId: installation.skillId,
          installedAt: installation.createdAt,
        },
        message: 'Skill reinstalled successfully',
      });
    }

    // Handle payment for paid skills
    if (skill.pricingModel !== 'free') {
      // TODO: Implement payment processing with Stripe
      // For now, return error
      return NextResponse.json(
        { error: 'Paid skills not yet supported. Coming soon!' },
        { status: 400 }
      );
    }

    // Create installation
    const installation = await prisma.skillInstallation.create({
      data: {
        userId: session.user.id,
        skillId,
        purchaseType: 'free',
        amountPaid: 0,
        isActive: true,
      },
    });

    // Increment download count
    await prisma.customSkill.update({
      where: { id: skillId },
      data: { downloads: { increment: 1 } },
    });

    // Track revenue for creator (if paid)
    if (skill.price > 0) {
      const creatorRevenue = Math.floor(skill.price * 0.7); // 70% to creator, 30% platform fee

      await prisma.customSkill.update({
        where: { id: skillId },
        data: {
          totalRevenue: { increment: creatorRevenue },
        },
      });
    }

    console.log(
      `[Marketplace] Skill installed: ${skill.name} by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      installation: {
        id: installation.id,
        skillId: installation.skillId,
        installedAt: installation.createdAt,
      },
      message: 'Skill installed successfully',
    });
  } catch (error) {
    console.error('Error installing skill:', error);
    captureAPIError(error as Error, '/api/marketplace/install', 'POST');

    return NextResponse.json(
      { error: 'Failed to install skill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marketplace/install
 *
 * Uninstall a skill.
 *
 * Query params:
 *   - skillId: string
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const skillId = req.nextUrl.searchParams.get('skillId');

    if (!skillId) {
      return NextResponse.json(
        { error: 'skillId is required' },
        { status: 400 }
      );
    }

    // Find installation
    const installation = await prisma.skillInstallation.findFirst({
      where: {
        userId: session.user.id,
        skillId,
        isActive: true,
      },
    });

    if (!installation) {
      return NextResponse.json(
        { error: 'Skill not installed' },
        { status: 404 }
      );
    }

    // Soft delete - deactivate installation
    await prisma.skillInstallation.update({
      where: { id: installation.id },
      data: { isActive: false },
    });

    console.log(
      `[Marketplace] Skill uninstalled: ${skillId} by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      message: 'Skill uninstalled successfully',
    });
  } catch (error) {
    console.error('Error uninstalling skill:', error);
    captureAPIError(error as Error, '/api/marketplace/install', 'DELETE');

    return NextResponse.json(
      { error: 'Failed to uninstall skill' },
      { status: 500 }
    );
  }
}
