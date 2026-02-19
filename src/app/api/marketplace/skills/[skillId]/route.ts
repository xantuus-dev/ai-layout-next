/**
 * Skill Detail API
 *
 * GET /api/marketplace/skills/[skillId] - Get skill details
 * PATCH /api/marketplace/skills/[skillId] - Update skill (creator only)
 * DELETE /api/marketplace/skills/[skillId] - Delete skill (creator only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/skills/[skillId]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { skillId } = params;

    const skill = await prisma.customSkill.findUnique({
      where: { id: skillId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        installations: {
          select: {
            id: true,
            userId: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          where: { isVerified: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            installations: true,
            reviews: true,
          },
        },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Check if skill is public or user is creator
    if (skill.status !== 'approved' && skill.creatorId !== session?.user?.id) {
      return NextResponse.json(
        { error: 'Skill not available' },
        { status: 403 }
      );
    }

    // Check if user has installed this skill
    let userInstallation = null;
    if (session?.user?.id) {
      userInstallation = await prisma.skillInstallation.findFirst({
        where: {
          userId: session.user.id,
          skillId,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      skill: {
        ...skill,
        isInstalled: !!userInstallation,
        installCount: skill._count.installations,
        reviewCount: skill._count.reviews,
        recentInstalls: skill.installations.length,
        recentReviews: skill.reviews,
      },
    });
  } catch (error) {
    console.error('Error fetching skill details:', error);
    captureAPIError(error as Error, '/api/marketplace/skills/[id]', 'GET');

    return NextResponse.json(
      { error: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/marketplace/skills/[skillId]
 *
 * Update skill (creator only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { skillId } = params;
    const body = await req.json();

    // Verify skill exists and user is creator
    const existingSkill = await prisma.customSkill.findUnique({
      where: { id: skillId },
      select: { id: true, creatorId: true, status: true },
    });

    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    if (existingSkill.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name) updateData.name = body.name;
    if (body.description) updateData.description = body.description;
    if (body.category) updateData.category = body.category;
    if (body.icon) updateData.icon = body.icon;
    if (body.skillDefinition) updateData.skillDefinition = body.skillDefinition;
    if (body.requiredTools) updateData.requiredTools = body.requiredTools;
    if (body.requiredIntegrations)
      updateData.requiredIntegrations = body.requiredIntegrations;
    if (body.estimatedCreditCost !== undefined)
      updateData.estimatedCreditCost = body.estimatedCreditCost;
    if (body.tags) updateData.tags = body.tags;

    // If skill was approved and significant changes made, require re-approval
    if (
      existingSkill.status === 'approved' &&
      (body.skillDefinition || body.requiredTools)
    ) {
      updateData.status = 'pending_review';
    }

    // Update skill
    const updatedSkill = await prisma.customSkill.update({
      where: { id: skillId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      skill: updatedSkill,
      message:
        updatedSkill.status === 'pending_review'
          ? 'Skill updated and submitted for re-approval'
          : 'Skill updated successfully',
    });
  } catch (error) {
    console.error('Error updating skill:', error);
    captureAPIError(error as Error, '/api/marketplace/skills/[id]', 'PATCH');

    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marketplace/skills/[skillId]
 *
 * Delete skill (creator only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { skillId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { skillId } = params;

    // Verify skill exists and user is creator
    const skill = await prisma.customSkill.findUnique({
      where: { id: skillId },
      select: {
        id: true,
        creatorId: true,
        name: true,
        _count: {
          select: { installations: true },
        },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    if (skill.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If skill has installations, soft delete (mark as deleted)
    if (skill._count.installations > 0) {
      await prisma.customSkill.update({
        where: { id: skillId },
        data: {
          status: 'deleted',
        },
      });

      return NextResponse.json({
        success: true,
        message:
          'Skill marked as deleted. Existing installations will continue to work.',
      });
    }

    // No installations - hard delete
    await prisma.customSkill.delete({
      where: { id: skillId },
    });

    return NextResponse.json({
      success: true,
      message: 'Skill deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting skill:', error);
    captureAPIError(error as Error, '/api/marketplace/skills/[id]', 'DELETE');

    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
