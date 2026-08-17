/**
 * Document Generation Task Runner
 *
 * The single entrypoint used both by the queued worker path
 * (src/lib/queue/agent-worker.ts) and the synchronous API-route fallback
 * (src/app/api/documents/generate/route.ts) when no queue is available —
 * mirrors how src/app/api/agent/execute/route.ts falls back to running
 * AgentExecutor inline when `body.async` isn't set.
 */

import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';
import type { AgentContext, AgentState } from '../agent/types';
import { DocumentOrchestrator } from './orchestrator';
import type { DocumentFormat, DocumentSpec } from './types';

/** context.state is unused by every registered tool (verified via grep) — a
 * placeholder satisfies AgentContext's type without carrying real ReAct
 * step-loop semantics, which don't apply to this phase-based pipeline. */
function placeholderState(taskId: string): AgentState {
  return {
    taskId,
    status: 'executing',
    currentStep: 0,
    totalSteps: 0,
    progress: 0,
    creditsUsed: 0,
    tokensUsed: 0,
    executionTime: 0,
    context: {},
    trace: [],
  };
}

export async function runDocumentGenerationTask(taskId: string, userId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.userId !== userId) throw new Error(`Task ${taskId} does not belong to user ${userId}`);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'executing', startedAt: new Date() },
  });

  const goal = task.description || task.title;
  const requestedFormats = (task.requestedFormats || []) as DocumentFormat[];
  const theme = ((task.agentConfig as any)?.theme || 'default') as DocumentSpec['theme'];

  const orchestrator = new DocumentOrchestrator(taskId, userId, (spec) => buildContext(taskId, userId, spec));

  try {
    const spec = await orchestrator.run(goal, requestedFormats, theme);

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: { outputs: spec.outputs, qaIssues: spec.qaIssues || [] } as any,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'failed', error: message, failedAt: new Date() },
    });
    throw error;
  }
}

function buildContext(taskId: string, userId: string, spec: DocumentSpec): AgentContext {
  return {
    userId,
    taskId,
    stepNumber: spec.phaseLog.length,
    state: placeholderState(taskId),
    prisma,
    aiRouter,
    memory: {},
  };
}
