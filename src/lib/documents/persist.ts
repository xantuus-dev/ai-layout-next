/**
 * Trace + spec persistence for the document generation pipeline.
 *
 * Mirrors what AgentExecutor.saveResult() writes (one TaskExecution row per
 * trace entry, credits deducted from the user) but is called once per PHASE
 * rather than once at the end of a whole run, so Task.documentSpec/
 * documentPhase stay fresh for the UI's polling view while a run is still in
 * progress. Uses deductCredits() from lib/credits.ts (team-billing-aware)
 * rather than AgentExecutor's direct prisma.user.update — that's the
 * documented canonical pattern (see CLAUDE.md) and the more correct choice
 * for a new code path, even though it means this doesn't literally share
 * AgentExecutor's write, which uses an older direct-increment approach.
 */

import { prisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';
import type { ExecutionTrace } from '../agent/types';
import type { DocumentSpec, DocumentPhaseName } from './types';

export async function persistPhaseResult(
  taskId: string,
  userId: string,
  phase: DocumentPhaseName,
  spec: DocumentSpec,
  traces: ExecutionTrace[]
): Promise<void> {
  const credits = traces.reduce((sum, t) => sum + (t.credits || 0), 0);
  const tokens = traces.reduce((sum, t) => sum + (t.tokens || 0), 0);

  if (traces.length) {
    await prisma.taskExecution.createMany({
      data: traces.map((t) => ({
        taskId,
        step: t.stepNumber,
        action: t.action,
        tool: t.tool,
        input: t.input ?? {},
        output: t.output,
        reasoning: t.reasoning,
        status: t.status,
        error: t.error,
        tokens: t.tokens,
        credits: t.credits,
        duration: t.duration,
        createdAt: t.timestamp,
        completedAt: t.status === 'completed' ? t.timestamp : null,
      })),
    });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      documentSpec: spec as any,
      documentPhase: phase,
      currentStep: spec.phaseLog.length,
      totalCredits: { increment: credits },
      totalTokens: { increment: tokens },
      lastRunAt: new Date(),
    },
  });

  if (credits > 0) {
    await deductCredits(userId, credits, {
      type: 'document-generation',
      description: `Document generation — ${phase} phase`,
    });
  }
}
