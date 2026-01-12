import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/templates/[id] - Get single template
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.promptTemplate.findUnique({
      where: {
        id: params.id,
        isPublic: true,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// POST /api/templates/[id] - Increment usage count when template is used
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.promptTemplate.update({
      where: {
        id: params.id,
      },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ success: true, usageCount: template.usageCount });
  } catch (error) {
    console.error('Error updating template usage:', error);
    return NextResponse.json(
      { error: 'Failed to update template usage' },
      { status: 500 }
    );
  }
}
