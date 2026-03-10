/**
 * GET /api/image-templates
 * List available image generation templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let where: any = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const templates = await prisma.imageTemplate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        prompt: true,
        defaultWidth: true,
        defaultHeight: true,
        icon: true,
        thumbnail: true,
        usageCount: true,
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    // Get unique categories
    const allCategories = await prisma.imageTemplate.findMany({
      where: { isPublic: true },
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json(
      {
        success: true,
        templates,
        categories: allCategories.map((t) => t.category),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch templates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
