import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/templates/categories - List all categories
export async function GET(req: NextRequest) {
  try {
    const categories = await prisma.promptTemplateCategory.findMany({
      include: {
        _count: {
          select: {
            templates: {
              where: {
                isPublic: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
