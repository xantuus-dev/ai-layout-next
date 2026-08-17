/**
 * Document Generation API Endpoint
 *
 * POST /api/documents/generate
 * Kicks off the multi-agent document generation pipeline (see
 * src/lib/documents/orchestrator.ts) for one or more output formats.
 *
 * Follows the same auth/task-creation shape as /api/agent/execute, but
 * always prefers the queue when available — a full pipeline run (research +
 * drafting + charts + assembly across multiple formats) regularly takes
 * 30-90s, which risks exceeding a serverless function's execution limit if
 * run inline. Synchronous fallback only kicks in when no queue is
 * configured (e.g. local dev without Redis), mirroring how
 * /api/agent/execute falls back to inline execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasEnoughCredits } from '@/lib/credits';
import { isQueueAvailable, queueAgentTask } from '@/lib/queue/agent-queue';
import { runDocumentGenerationTask } from '@/lib/documents/run';
import { initDocumentSpec, type DocumentFormat } from '@/lib/documents/types';

const VALID_FORMATS: DocumentFormat[] = ['docx', 'pdf', 'pptx', 'xlsx'];

/** Conservative flat estimate (research + drafting LLM calls, plus one
 * assembly tool call per format) used only for the up-front credit gate —
 * actual usage is metered per-phase by lib/documents/persist.ts as the
 * pipeline runs. */
function estimateCredits(formats: DocumentFormat[]): number {
  const BASE = 40; // research + drafting + qa LLM calls
  const PER_FORMAT: Record<DocumentFormat, number> = { pdf: 3, docx: 3, pptx: 5, xlsx: 3 };
  return BASE + formats.reduce((sum, f) => sum + PER_FORMAT[f], 0);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
    const formats: DocumentFormat[] = Array.isArray(body.formats) ? body.formats : [];
    const theme = ['default', 'investor', 'minimal'].includes(body.theme) ? body.theme : 'default';

    if (!goal || goal.length < 10) {
      return NextResponse.json({ error: 'goal is required (at least 10 characters)' }, { status: 400 });
    }
    if (goal.length > 4000) {
      return NextResponse.json({ error: 'goal exceeds 4000 characters' }, { status: 400 });
    }
    if (!formats.length || !formats.every((f) => VALID_FORMATS.includes(f))) {
      return NextResponse.json(
        { error: `formats must be a non-empty array from: ${VALID_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    const creditsNeeded = estimateCredits(formats);
    if (!(await hasEnoughCredits(user.id, creditsNeeded))) {
      return NextResponse.json(
        { error: 'Insufficient credits', needed: creditsNeeded, available: user.monthlyCredits - user.creditsUsed },
        { status: 402 }
      );
    }

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: goal.slice(0, 100),
        description: goal,
        agentType: 'document_generation',
        agentConfig: { theme },
        requestedFormats: formats,
        documentSpec: initDocumentSpec(goal, formats, theme) as any,
        status: 'pending',
        priority: 'medium',
      },
    });

    if (isQueueAvailable()) {
      const jobId = await queueAgentTask(task.id, user.id, {});
      return NextResponse.json({ success: true, taskId: task.id, jobId, status: 'pending', queued: true });
    }

    // No queue configured — run inline and await completion (local dev path).
    await runDocumentGenerationTask(task.id, user.id);
    const finished = await prisma.task.findUnique({ where: { id: task.id } });

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: finished?.status,
      queued: false,
      result: finished?.result,
    });
  } catch (error: any) {
    console.error('Error starting document generation:', error);
    return NextResponse.json({ error: 'Failed to start document generation', message: error.message }, { status: 500 });
  }
}
