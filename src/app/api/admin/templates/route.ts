import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to check if user is admin
async function isAdmin(session: any) {
  // TODO: Add proper admin role check
  // For now, you can check email or add an isAdmin field to User model
  return session?.user?.email === process.env.ADMIN_EMAIL;
}

// GET /api/admin/templates - List all templates (including inactive)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await isAdmin(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.promptTemplate.findMany({
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
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

// POST /api/admin/templates - Create new template
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await isAdmin(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      template,
      categoryId,
      tags,
      variables,
      isPublic,
      isActive,
      isFeatured,
    } = body;

    const newTemplate = await prisma.promptTemplate.create({
      data: {
        title,
        description,
        template,
        categoryId,
        tags: tags || [],
        variables: variables || [],
        isPublic: isPublic ?? true,
        isActive: isActive ?? true,
        isFeatured: isFeatured ?? false,
        createdBy: session.user?.email || undefined,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
