/**
 * Human-in-the-loop approval policy for agent tool execution.
 *
 * OWASP LLM06 (Excessive Agency): a plan authored by the planning model must
 * not be able to auto-execute irreversible, outward-facing actions (sending
 * email, uploading/sharing files, mutating a calendar, POSTing to the web).
 * The decision about which tools are sensitive lives HERE, server-side — not in
 * the model-authored `requiresApproval` flag, which can only ADD friction,
 * never remove it.
 *
 * Enforcement is fail-closed: a sensitive step that has not been explicitly
 * pre-approved for the task halts execution instead of running.
 */

import type { AgentConfig, ExecutionStep } from './types';

/**
 * Tools with external, state-changing, or irreversible side effects. Keep this
 * conservative and explicit — adding a new mutating tool means adding it here.
 * Read-only tools (browser.extract, drive.list, calendar.listEvents, http.get,
 * ai.*) are intentionally absent.
 */
export const SENSITIVE_TOOLS: ReadonlySet<string> = new Set([
  'email.send',
  'email.sendBatch',
  'drive.upload',
  'drive.createDoc',
  'drive.createSheet',
  'drive.share',
  'calendar.createEvent',
  'calendar.updateEvent',
  'calendar.deleteEvent',
  'http.post',
]);

/** Thrown when a step needs approval that has not been granted. Not retryable. */
export class ApprovalRequiredError extends Error {
  readonly tool: string;
  readonly stepNumber: number;

  constructor(tool: string, stepNumber: number) {
    super(
      `Step ${stepNumber} uses "${tool}", which requires human approval before it can run.`
    );
    this.name = 'ApprovalRequiredError';
    this.tool = tool;
    this.stepNumber = stepNumber;
  }
}

/**
 * Whether a step must be approved before running. True when the tool is
 * sensitive (server-defined) OR the planner flagged it, UNLESS the user
 * pre-authorized that tool for this task via config.autoApprovedTools.
 */
export function stepNeedsApproval(step: ExecutionStep, config: AgentConfig): boolean {
  const needs = SENSITIVE_TOOLS.has(step.tool) || step.requiresApproval === true;
  if (!needs) return false;

  const preApproved = config.autoApprovedTools?.includes(step.tool) ?? false;
  return !preApproved;
}
