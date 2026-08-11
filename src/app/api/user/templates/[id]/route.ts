/**
 * A single user-authored prompt template.
 *
 * GET    /api/user/templates/[id] - Read one of the signed-in user's templates
 * PATCH  /api/user/templates/[id] - Update it
 * DELETE /api/user/templates/[id] - Delete it
 *
 * Ownership is expressed as `userId` inside the where clause of every query
 * rather than as a fetch-then-compare. A template belonging to someone else is
 * therefore indistinguishable from one that does not exist, and there is no
 * window between the check and the write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';
import { parseUpdateInput } from '@/lib/templates/user-template-input';

export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json({ error: 'Template not found' }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.promptTemplate.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { category: true },
    });

    if (!template) return notFound();

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching user template:', error);
    captureAPIError(error as Error, '/api/user/templates/[id]', 'GET');

    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseUpdateInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.value;

    if (input.categoryId) {
      const category = await prisma.promptTemplateCategory.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json(
          { error: 'Unknown category' },
          { status: 400 }
        );
      }
    }

    const data: Prisma.PromptTemplateUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.template !== undefined) data.template = input.template;
    if (input.description !== undefined) data.description = input.description;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.variables !== undefined) {
      data.variables = input.variables as unknown as Prisma.InputJsonValue;
    }
    if (input.categoryId !== undefined) {
      data.category = input.categoryId
        ? { connect: { id: input.categoryId } }
        : { disconnect: true };
    }

    try {
      const template = await prisma.promptTemplate.update({
        where: { id: params.id, userId: session.user.id },
        data,
        include: { category: true },
      });

      return NextResponse.json(template);
    } catch (error) {
      // P2025 is "record to update not found", which here means the id is
      // unknown or belongs to another user. Both are a 404.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return notFound();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating user template:', error);
    captureAPIError(error as Error, '/api/user/templates/[id]', 'PATCH');

    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // deleteMany rather than delete: a count of zero is the natural "not yours
    // or not there" signal, with no exception to unpick.
    const result = await prisma.promptTemplate.deleteMany({
      where: { id: params.id, userId: session.user.id },
    });

    if (result.count === 0) return notFound();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user template:', error);
    captureAPIError(error as Error, '/api/user/templates/[id]', 'DELETE');

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
