/**
 * Document Orchestrator — composes the document generation pipeline phases.
 *
 * Deliberately does NOT extend AgentOrchestratorImpl (a cron/queue poller —
 * wrong shape for a synchronously-triggered multi-phase run) or reuse
 * AgentExecutor.plan() (which authors one flat tool-call list up front,
 * before any research results exist — structurally wrong for "gather facts,
 * then draft based on facts, then let QA send drafting back"). Instead each
 * phase is a small function that internally does what
 * AgentExecutor.executeStep() does — pull tools from the shared
 * toolRegistry, call the model, record a trace — via lib/documents/phase-utils.ts.
 *
 * research -> drafting -> data_chart -> images -> qa (loop back, max 2x) -> assembly
 */

import type { AgentContext } from '../agent/types';
import type { DocumentSpec, DocumentPhaseName, DocumentFormat } from './types';
import { initDocumentSpec } from './types';
import { persistPhaseResult } from './persist';
import { runResearchPhase } from './phases/research';
import { runDraftingPhase } from './phases/drafting';
import { runDataChartPhase } from './phases/data-chart';
import { runImagePhase } from './phases/images';
import { runQaPhase } from './phases/qa';
import { runAssemblyPhase } from './phases/assembly';

const MAX_REVISIONS = 2;

type PhaseRunner = (
  spec: DocumentSpec,
  context: AgentContext,
  startStepNumber: number
) => Promise<{ spec: DocumentSpec; traces: import('../agent/types').ExecutionTrace[] }>;

const PHASE_RUNNERS: Record<DocumentPhaseName, PhaseRunner> = {
  research: runResearchPhase,
  drafting: runDraftingPhase,
  data_chart: runDataChartPhase,
  images: runImagePhase,
  qa: runQaPhase,
  assembly: runAssemblyPhase,
};

export class DocumentOrchestrator {
  constructor(
    private taskId: string,
    private userId: string,
    private buildContext: (spec: DocumentSpec) => AgentContext
  ) {}

  async run(goal: string, requestedFormats: DocumentFormat[], theme: DocumentSpec['theme'] = 'default'): Promise<DocumentSpec> {
    let spec = initDocumentSpec(goal, requestedFormats, theme);
    let stepNumber = 1;

    for (const phase of ['research', 'drafting', 'data_chart', 'images'] as const) {
      const result = await this.runPhase(phase, spec, stepNumber);
      spec = result.spec;
      stepNumber = result.nextStep;
    }

    // QA loop: re-run whichever phase QA flags as the source of a blocking
    // issue, then re-QA. Capped at MAX_REVISIONS so a persistently unhappy
    // QA pass can't run forever — it assembles with whatever it has and
    // leaves qaIssues on the spec for the UI to surface.
    for (let revision = 0; ; revision++) {
      const qaResult = await this.runPhase('qa', spec, stepNumber);
      spec = qaResult.spec;
      stepNumber = qaResult.nextStep;

      const blocker = spec.qaIssues?.find((i) => i.severity === 'blocker');
      if (!blocker || revision >= MAX_REVISIONS) break;

      spec = { ...spec, revisionCount: spec.revisionCount + 1 };
      const target = blocker.targetPhase;
      const retryResult = await this.runPhase(target, spec, stepNumber, { revisionOf: 'qa' });
      spec = retryResult.spec;
      stepNumber = retryResult.nextStep;

      // A revision to drafting invalidates any charts/tables/images keyed to
      // the sections it rewrote, so re-run the phases downstream of it too —
      // otherwise stale chart/table ids could point at content that changed.
      if (target === 'drafting') {
        const dc = await this.runPhase('data_chart', spec, stepNumber);
        spec = dc.spec;
        stepNumber = dc.nextStep;
        const img = await this.runPhase('images', spec, stepNumber);
        spec = img.spec;
        stepNumber = img.nextStep;
      }
    }

    const assemblyResult = await this.runPhase('assembly', spec, stepNumber);
    spec = assemblyResult.spec;

    return spec;
  }

  private async runPhase(
    name: DocumentPhaseName,
    spec: DocumentSpec,
    startStepNumber: number,
    logExtra: { revisionOf?: DocumentPhaseName } = {}
  ): Promise<{ spec: DocumentSpec; nextStep: number }> {
    const startedAt = new Date().toISOString();
    const context = this.buildContext(spec);
    const runner = PHASE_RUNNERS[name];

    try {
      const { spec: phaseSpec, traces } = await runner(spec, context, startStepNumber);
      const nextStep = startStepNumber + traces.length;

      const nextSpec: DocumentSpec = {
        ...phaseSpec,
        currentPhase: name,
        phaseLog: [
          ...phaseSpec.phaseLog,
          { phase: name, startedAt, completedAt: new Date().toISOString(), status: 'completed', ...logExtra },
        ],
      };

      await persistPhaseResult(this.taskId, this.userId, name, nextSpec, traces);
      return { spec: nextSpec, nextStep };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedSpec: DocumentSpec = {
        ...spec,
        currentPhase: name,
        phaseLog: [
          ...spec.phaseLog,
          { phase: name, startedAt, completedAt: new Date().toISOString(), status: 'failed', error: message, ...logExtra },
        ],
      };
      await persistPhaseResult(this.taskId, this.userId, name, failedSpec, []);
      throw error;
    }
  }
}
