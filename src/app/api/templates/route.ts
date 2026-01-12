import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/templates - List all public active templates
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured') === 'true';

    const where: any = {
      isPublic: true,
      isActive: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tag) {
      where.tags = {
        has: tag,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (featured) {
      where.isFeatured = true;
    }

    const templates = await prisma.promptTemplate.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
