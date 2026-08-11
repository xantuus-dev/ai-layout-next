/**
 * User-authored prompt templates.
 *
 * GET  /api/user/templates - List the signed-in user's own templates
 * POST /api/user/templates - Create a template owned by the signed-in user
 *
 * These are private to their owner: they are written with visibility 'private'
 * and isPublic false so the public gallery query in /api/templates cannot pick
 * them up. Publishing to the gallery is deliberately not exposed here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { captureAPIError } from '@/lib/sentry';
import { parseCreateInput } from '@/lib/templates/user-template-input';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const templates = await prisma.promptTemplate.findMany({
      where: {
        userId: session.user.id,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                {
                  description: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching user templates:', error);
    captureAPIError(error as Error, '/api/user/templates', 'GET');

    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const parsed = parseCreateInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.value;

    // Checked explicitly so an unknown category is a 400 rather than a foreign
    // key violation surfacing as a 500.
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

    const template = await prisma.promptTemplate.create({
      data: {
        title: input.title,
        description: input.description,
        template: input.template,
        categoryId: input.categoryId,
        tags: input.tags,
        variables: input.variables as unknown as Prisma.InputJsonValue,
        userId: session.user.id,
        // Owner-only. Curation stays with the admin tools, so none of these are
        // reachable from the request body.
        visibility: 'private',
        isPublic: false,
        isActive: true,
        isFeatured: false,
      },
      include: { category: true },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating user template:', error);
    captureAPIError(error as Error, '/api/user/templates', 'POST');

    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
