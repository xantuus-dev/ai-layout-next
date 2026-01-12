import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to check if user is admin
async function isAdmin(session: any) {
  return session?.user?.email === process.env.ADMIN_EMAIL;
}

// PUT /api/admin/templates/[id] - Update template
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updatedTemplate = await prisma.promptTemplate.update({
      where: {
        id: params.id,
      },
      data: {
        title,
        description,
        template,
        categoryId,
        tags,
        variables,
        isPublic,
        isActive,
        isFeatured,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/templates/[id] - Delete template
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await isAdmin(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.promptTemplate.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
