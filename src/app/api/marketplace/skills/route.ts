/**
 * Skill Marketplace API - Browse Skills
 *
 * GET /api/marketplace/skills - List/search skills
 * POST /api/marketplace/skills - Create/publish new skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/skills
 *
 * Query params:
 *   - category: Filter by category
 *   - search: Search by name/description
 *   - pricing: Filter by pricing model (free, one-time, subscription)
 *   - featured: Show only featured skills
 *   - sort: Sort by (popular, newest, rating, price)
 *   - limit: Results per page (default: 20)
 *   - offset: Pagination offset
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const pricingModel = searchParams.get('pricing');
    const featured = searchParams.get('featured') === 'true';
    const sort = searchParams.get('sort') || 'popular';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      status: 'approved', // Only show approved skills
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    if (pricingModel) {
      where.pricingModel = pricingModel;
    }

    if (featured) {
      where.featured = true;
    }

    // Build orderBy clause
    let orderBy: any = {};
    switch (sort) {
      case 'popular':
        orderBy = { downloads: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'price':
        orderBy = { price: 'asc' };
        break;
      default:
        orderBy = { downloads: 'desc' };
    }

    // Fetch skills
    const [skills, totalCount] = await Promise.all([
      prisma.customSkill.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          icon: true,
          pricingModel: true,
          price: true,
          downloads: true,
          rating: true,
          reviewCount: true,
          featured: true,
          tags: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              installations: true,
            },
          },
        },
      }),
      prisma.customSkill.count({ where }),
    ]);

    // Check if user has installed each skill
    let userInstallations: string[] = [];
    if (session?.user?.id) {
      const installations = await prisma.skillInstallation.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        select: { skillId: true },
      });
      userInstallations = installations.map((i) => i.skillId);
    }

    // Enrich skills with installation status
    const enrichedSkills = skills.map((skill) => ({
      ...skill,
      isInstalled: userInstallations.includes(skill.id),
      installCount: skill._count.installations,
    }));

    return NextResponse.json({
      skills: enrichedSkills,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching marketplace skills:', error);
    captureAPIError(error as Error, '/api/marketplace/skills', 'GET');

    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/skills
 *
 * Create and publish a new skill to the marketplace.
 *
 * Request body:
 *   {
 *     name: string;
 *     description: string;
 *     category: string;
 *     icon?: string;
 *     pricingModel: 'free' | 'one-time' | 'subscription';
 *     price?: number;
 *     skillType: 'config' | 'javascript' | 'python';
 *     skillDefinition: object;
 *     requiredTools: string[];
 *     requiredIntegrations: string[];
 *     estimatedCreditCost: number;
 *     tags?: string[];
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate required fields
    const {
      name,
      description,
      category,
      pricingModel,
      skillType,
      skillDefinition,
      requiredTools,
      estimatedCreditCost,
    } = body;

    if (
      !name ||
      !description ||
      !category ||
      !pricingModel ||
      !skillType ||
      !skillDefinition ||
      !requiredTools ||
      estimatedCreditCost === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate pricing
    if (pricingModel !== 'free' && !body.price) {
      return NextResponse.json(
        { error: 'Price required for paid skills' },
        { status: 400 }
      );
    }

    // Validate skill definition structure
    if (skillType === 'config') {
      if (!skillDefinition.steps || !Array.isArray(skillDefinition.steps)) {
        return NextResponse.json(
          { error: 'Config skills must have steps array' },
          { status: 400 }
        );
      }
    }

    // Create skill
    const skill = await prisma.customSkill.create({
      data: {
        creatorId: session.user.id,
        name,
        description,
        category,
        icon: body.icon || '🔧',
        pricingModel,
        price: body.price || 0,
        skillType,
        skillDefinition,
        requiredTools,
        requiredIntegrations: body.requiredIntegrations || [],
        estimatedCreditCost,
        tags: body.tags || [],
        status: 'pending_review', // Requires approval before going live
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(
      `[Marketplace] New skill submitted: ${skill.name} by ${session.user.email}`
    );

    return NextResponse.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        status: skill.status,
        createdAt: skill.createdAt,
      },
      message:
        'Skill submitted for review. You will be notified once it is approved.',
    });
  } catch (error) {
    console.error('Error creating skill:', error);
    captureAPIError(error as Error, '/api/marketplace/skills', 'POST');

    return NextResponse.json(
      { error: 'Failed to create skill' },
      { status: 500 }
    );
  }
}
