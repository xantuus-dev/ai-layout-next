import { describe, it, expect } from 'vitest';
import {
  SENSITIVE_TOOLS,
  stepNeedsApproval,
  ApprovalRequiredError,
} from '@/lib/agent/approval';
import type { ExecutionStep, AgentConfig } from '@/lib/agent/types';

function step(tool: string, overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 's1',
    stepNumber: 1,
    action: tool,
    description: 'test step',
    tool,
    params: {},
    ...overrides,
  };
}

describe('stepNeedsApproval', () => {
  it('requires approval for sensitive tools regardless of the planner flag', () => {
    // The model marked it not-requiring-approval; the server overrides.
    expect(
      stepNeedsApproval(step('email.send', { requiresApproval: false }), {})
    ).toBe(true);
    expect(stepNeedsApproval(step('drive.share'), {})).toBe(true);
    expect(stepNeedsApproval(step('http.post'), {})).toBe(true);
  });

  it('does not require approval for read-only tools', () => {
    expect(stepNeedsApproval(step('drive.list'), {})).toBe(false);
    expect(stepNeedsApproval(step('http.get'), {})).toBe(false);
    expect(stepNeedsApproval(step('ai.summarize'), {})).toBe(false);
  });

  it('still honors the planner flag as added friction on a non-sensitive tool', () => {
    expect(
      stepNeedsApproval(step('browser.extract', { requiresApproval: true }), {})
    ).toBe(true);
  });

  it('allows a sensitive tool only when the user pre-approved it for the task', () => {
    const config: AgentConfig = { autoApprovedTools: ['email.send'] };
    expect(stepNeedsApproval(step('email.send'), config)).toBe(false);
    // Pre-approving one tool does not pre-approve another.
    expect(stepNeedsApproval(step('drive.share'), config)).toBe(true);
  });
});

describe('ApprovalRequiredError', () => {
  it('carries the tool and step and identifies via instanceof', () => {
    const err = new ApprovalRequiredError('email.send', 3);
    expect(err).toBeInstanceOf(ApprovalRequiredError);
    expect(err.tool).toBe('email.send');
    expect(err.stepNumber).toBe(3);
  });
});

describe('SENSITIVE_TOOLS', () => {
  it('covers the known outward-facing mutating tools', () => {
    for (const t of [
      'email.send',
      'email.sendBatch',
      'drive.upload',
      'drive.share',
      'calendar.deleteEvent',
      'http.post',
    ]) {
      expect(SENSITIVE_TOOLS.has(t)).toBe(true);
    }
  });
});
