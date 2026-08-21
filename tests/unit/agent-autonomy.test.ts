import { describe, it, expect } from 'vitest';
import {
  parseAgentType,
  sensitiveToolsInPlan,
  narrowApprovals,
  CLASSIFIABLE_TYPES,
  AUTONOMY_DEFAULTS,
} from '@/lib/agent/autonomy';
import { SENSITIVE_TOOLS } from '@/lib/agent/approval';
import type { ExecutionPlan, ExecutionStep } from '@/lib/agent/types';

function step(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 's1',
    stepNumber: 1,
    action: 'browser.extract',
    description: 'Read the page',
    tool: 'browser.extract',
    params: {},
    ...overrides,
  };
}

function plan(steps: ExecutionStep[]): ExecutionPlan {
  return {
    taskId: 't1',
    steps,
    totalSteps: steps.length,
    estimatedCredits: 100,
    estimatedDuration: 60_000,
    createdAt: new Date('2026-08-21T00:00:00Z'),
  };
}

describe('parseAgentType', () => {
  it('accepts every classifiable type verbatim', () => {
    for (const type of CLASSIFIABLE_TYPES) {
      expect(parseAgentType(type)).toBe(type);
    }
  });

  it('normalizes case and stray punctuation from the model', () => {
    expect(parseAgentType('  RESEARCH.  ')).toBe('research');
    expect(parseAgentType('"email_campaign"')).toBe('email_campaign');
  });

  it('falls back to custom rather than throwing on anything unexpected', () => {
    expect(parseAgentType('teleportation')).toBe('custom');
    expect(parseAgentType('')).toBe('custom');
    expect(parseAgentType(undefined as unknown as string)).toBe('custom');
  });
});

describe('sensitiveToolsInPlan', () => {
  it('finds server-defined sensitive tools', () => {
    const found = sensitiveToolsInPlan(
      plan([step(), step({ id: 's2', stepNumber: 2, tool: 'email.send' })])
    );

    expect(found).toEqual(['email.send']);
  });

  it('honours the planner\'s own requiresApproval flag on an otherwise safe tool', () => {
    const found = sensitiveToolsInPlan(
      plan([step({ tool: 'http.get', requiresApproval: true })])
    );

    expect(found).toEqual(['http.get']);
  });

  it('returns nothing for a wholly read-only plan', () => {
    const found = sensitiveToolsInPlan(
      plan([step({ tool: 'browser.extract' }), step({ id: 's2', stepNumber: 2, tool: 'http.get' })])
    );

    expect(found).toEqual([]);
  });

  it('de-duplicates a tool used across several steps', () => {
    const found = sensitiveToolsInPlan(
      plan([
        step({ tool: 'email.send' }),
        step({ id: 's2', stepNumber: 2, tool: 'email.send' }),
        step({ id: 's3', stepNumber: 3, tool: 'drive.share' }),
      ])
    );

    expect(found).toEqual(['drive.share', 'email.send']);
  });

  it('agrees with the executor\'s own sensitivity set', () => {
    // If SENSITIVE_TOOLS grows, a plan using the new tool must still be
    // surfaced to the user — otherwise the run would stall on a step the
    // proposal never mentioned.
    for (const tool of SENSITIVE_TOOLS) {
      expect(sensitiveToolsInPlan(plan([step({ tool })]))).toEqual([tool]);
    }
  });
});

describe('narrowApprovals', () => {
  it('grants a tool the plan actually asked for', () => {
    expect(narrowApprovals(['email.send'], ['email.send'])).toEqual(['email.send']);
  });

  it('refuses to grant tools the proposal never showed the user', () => {
    // The security property: a client sending every tool name it knows must
    // not thereby pre-authorize anything beyond the plan.
    expect(narrowApprovals(['email.send', 'drive.share', 'http.post'], ['email.send'])).toEqual([
      'email.send',
    ]);
  });

  it('grants nothing when the plan is read-only', () => {
    expect(narrowApprovals(['email.send'], [])).toEqual([]);
  });

  it('grants nothing when the user approves nothing', () => {
    expect(narrowApprovals([], ['email.send'])).toEqual([]);
  });

  it('de-duplicates a repeated grant', () => {
    expect(narrowApprovals(['email.send', 'email.send'], ['email.send'])).toEqual(['email.send']);
  });
});

describe('AUTONOMY_DEFAULTS', () => {
  it('bounds an unattended run in both steps and wall-clock time', () => {
    // A user who has walked away cannot stop the run, so these ceilings are
    // the only thing that will.
    expect(AUTONOMY_DEFAULTS.maxSteps).toBeGreaterThan(0);
    expect(AUTONOMY_DEFAULTS.timeout).toBeGreaterThan(0);
    expect(AUTONOMY_DEFAULTS.timeout).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
