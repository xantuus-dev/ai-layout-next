/**
 * QA Phase — deterministic structural checks over the assembled DocumentSpec.
 *
 * Deliberately does NOT make an LLM call: the checks below (empty sections,
 * outline items that requested a chart/table/image but didn't get one,
 * citation markers referencing an id that doesn't exist) are all mechanical
 * comparisons that are more reliable — and don't add another JSON-parsing
 * failure point — than asking a model to "review this document." A
 * model-based content-quality pass is a reasonable future addition but isn't
 * required for the loop-back mechanism to work.
 */

import type { AgentContext, ExecutionTrace } from '../../agent/types';
import type { DocumentSpec, QaIssue } from '../types';

const MIN_SECTION_CHARS = 80;

export async function runQaPhase(
  spec: DocumentSpec,
  _context: AgentContext,
  startStepNumber: number
): Promise<{ spec: DocumentSpec; traces: ExecutionTrace[] }> {
  const issues: QaIssue[] = [];

  for (const item of spec.outline) {
    const section = spec.sections.find((s) => s.id === item.id);
    if (!section || section.content.trim().length < MIN_SECTION_CHARS) {
      issues.push({
        severity: 'blocker',
        message: `Section "${item.heading}" is missing or too short.`,
        targetPhase: 'drafting',
      });
      continue;
    }

    if (item.needsChart && !(section.chartIds && section.chartIds.length)) {
      issues.push({
        severity: 'blocker',
        message: `Section "${item.heading}" was flagged as needing a chart but has none.`,
        targetPhase: 'data_chart',
      });
    }
    if (item.needsTable && !(section.tableIds && section.tableIds.length)) {
      issues.push({
        severity: 'blocker',
        message: `Section "${item.heading}" was flagged as needing a table but has none.`,
        targetPhase: 'data_chart',
      });
    }
    if (item.needsImage && !(section.imageIds && section.imageIds.length)) {
      // Image generation being unavailable/unconfigured is an accepted
      // degradation (see phases/images.ts), so this is a warning, not a
      // blocker — it never triggers a loop-back on its own.
      issues.push({
        severity: 'warning',
        message: `Section "${item.heading}" was flagged as needing an image but has none.`,
        targetPhase: 'images',
      });
    }

    const citedIds = Array.from(section.content.matchAll(/\[(c\d+)\]/g)).map((m) => m[1]);
    for (const id of citedIds) {
      if (!spec.citations.some((c) => c.id === id)) {
        issues.push({
          severity: 'warning',
          message: `Section "${item.heading}" cites [${id}], which isn't in the citations list.`,
          targetPhase: 'drafting',
        });
      }
    }
  }

  // Purely structural — no tool/model calls — but still recorded as a trace
  // entry so the phase's pass/fail is visible in the task's execution log.
  const trace: ExecutionTrace = {
    stepNumber: startStepNumber,
    timestamp: new Date(),
    action: 'qa.review',
    tool: 'qa.structuralCheck',
    input: { sections: spec.sections.length, outline: spec.outline.length },
    output: { issues: issues.length, blockers: issues.filter((i) => i.severity === 'blocker').length },
    status: 'completed',
    duration: 0,
    credits: 0,
    tokens: 0,
  };

  return { spec: { ...spec, qaIssues: issues }, traces: [trace] };
}
