/**
 * Tool definitions for the Xantuus MCP server.
 *
 * Every tool is scoped to the API key's owner: the user id comes from the
 * verified bearer token via `ctx.http.authInfo`, never from tool arguments, so
 * a client cannot read another account's rows by passing a different id.
 */

import { z } from 'zod';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { prisma } from '@/lib/prisma';
import { getCreditStatus } from '@/lib/credits';
import { userIdFromAuthInfo } from '@/lib/mcp/auth';

/** Serialises a tool result as the JSON text block MCP clients expect. */
function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Marks a tool result as failed without throwing past the transport. */
function failure(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/**
 * `withMcpAuth` already rejects unauthenticated requests, so reaching a handler
 * without a user id means the route was mounted without the auth wrapper.
 */
function requireUserId(ctx: ServerContext): string {
  const userId = userIdFromAuthInfo(ctx.http?.authInfo);
  if (!userId) {
    throw new Error('Unauthenticated: the MCP handler must be wrapped in withMcpAuth');
  }
  return userId;
}

export function registerXantuusTools(server: McpServer): void {
  server.registerTool(
    'get_credit_status',
    {
      title: 'Get credit status',
      description:
        'Current plan, monthly credit allowance, credits used and remaining, and the next reset date for the authenticated account.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async (_args, ctx) => {
      const status = await getCreditStatus(requireUserId(ctx));
      if (!status) return failure('No account found for this API key.');
      return json(status);
    }
  );

  server.registerTool(
    'get_usage_summary',
    {
      title: 'Get usage summary',
      description:
        'Aggregate token and credit usage over a recent window, broken down by usage type (chat, api, automation, ...).',
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .default(30)
          .describe('Size of the lookback window in days.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }, ctx) => {
      const userId = requireUserId(ctx);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const grouped = await prisma.usageRecord.groupBy({
        by: ['type'],
        where: { userId, createdAt: { gte: since } },
        _sum: { tokens: true, credits: true },
        _count: { _all: true },
      });

      const byType = grouped.map((row) => ({
        type: row.type,
        requests: row._count._all,
        tokens: row._sum.tokens ?? 0,
        credits: row._sum.credits ?? 0,
      }));

      return json({
        windowDays: days,
        since: since.toISOString(),
        totals: {
          requests: byType.reduce((sum, r) => sum + r.requests, 0),
          tokens: byType.reduce((sum, r) => sum + r.tokens, 0),
          credits: byType.reduce((sum, r) => sum + r.credits, 0),
        },
        byType,
      });
    }
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List prompt templates',
      description:
        'List prompt templates visible to this account — the public gallery plus the user’s own private templates. Returns metadata only; call get_template for the prompt body.',
      inputSchema: z.object({
        query: z.string().optional().describe('Case-insensitive match on title and description.'),
        tier: z.enum(['free', 'pro', 'enterprise']).optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, tier, limit }, ctx) => {
      const userId = requireUserId(ctx);

      const templates = await prisma.promptTemplate.findMany({
        where: {
          isActive: true,
          // Either listed in the gallery, or owned by the caller.
          OR: [{ visibility: 'public', isPublic: true }, { userId }],
          ...(tier ? { tier } : {}),
          ...(query
            ? {
                AND: [
                  {
                    OR: [
                      { title: { contains: query, mode: 'insensitive' as const } },
                      { description: { contains: query, mode: 'insensitive' as const } },
                    ],
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          tier: true,
          tags: true,
          visibility: true,
          usageCount: true,
          userId: true,
          category: { select: { name: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { usageCount: 'desc' }],
        take: limit,
      });

      return json(
        templates.map(({ userId: ownerId, category, ...rest }) => ({
          ...rest,
          category: category?.name ?? null,
          owned: ownerId === userId,
        }))
      );
    }
  );

  server.registerTool(
    'get_template',
    {
      title: 'Get prompt template',
      description:
        'Fetch one prompt template in full, including the {{variable}} prompt body and its variable configuration.',
      inputSchema: z.object({
        templateId: z.string().describe('Template id from list_templates.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ templateId }, ctx) => {
      const userId = requireUserId(ctx);

      const template = await prisma.promptTemplate.findFirst({
        where: {
          id: templateId,
          isActive: true,
          OR: [{ visibility: 'public', isPublic: true }, { userId }],
        },
        select: {
          id: true,
          title: true,
          description: true,
          template: true,
          variables: true,
          tier: true,
          tags: true,
          requiresGoogleDrive: true,
          requiresGmail: true,
          requiresCalendar: true,
          supportsImageGen: true,
          category: { select: { name: true } },
        },
      });

      // Same response whether the row is missing or merely invisible, so this
      // cannot be used to probe for the existence of other users' templates.
      if (!template) return failure(`No accessible template with id "${templateId}".`);

      return json({ ...template, category: template.category?.name ?? null });
    }
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List the workspace projects owned by the authenticated account, with task counts.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ limit }, ctx) => {
      const projects = await prisma.project.findMany({
        where: { userId: requireUserId(ctx) },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return json(
        projects.map(({ _count, ...rest }) => ({ ...rest, taskCount: _count.tasks }))
      );
    }
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'List agent tasks for the authenticated account, optionally filtered by status or project.',
      inputSchema: z.object({
        status: z
          .enum(['pending', 'planning', 'executing', 'paused', 'completed', 'failed', 'cancelled'])
          .optional(),
        projectId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ status, projectId, limit }, ctx) => {
      const tasks = await prisma.task.findMany({
        where: {
          userId: requireUserId(ctx),
          ...(status ? { status } : {}),
          ...(projectId ? { projectId } : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          projectId: true,
          agentType: true,
          currentStep: true,
          totalSteps: true,
          totalCredits: true,
          dueDate: true,
          error: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return json(tasks);
    }
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Create a task for the authenticated account. The task is created in "pending" status and is not executed by this tool.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        projectId: z.string().optional().describe('Must be a project owned by this account.'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        dueDate: z.string().datetime().optional().describe('ISO 8601 timestamp.'),
        tags: z.array(z.string()).max(20).default([]),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ title, description, projectId, priority, dueDate, tags }, ctx) => {
      const userId = requireUserId(ctx);

      // Verify ownership rather than trusting the id, so a task cannot be
      // attached to someone else's project.
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId },
          select: { id: true },
        });
        if (!project) return failure(`No project with id "${projectId}" on this account.`);
      }

      const task = await prisma.task.create({
        data: {
          userId,
          title,
          description,
          projectId,
          priority,
          tags,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
        select: { id: true, title: true, status: true, priority: true, projectId: true, createdAt: true },
      });

      return json(task);
    }
  );
}
