/**
 * Browser Action Execution API
 * POST /api/browser/action - Execute browser action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { browserControl, BrowserAction } from '@/lib/browser-control';
import { prisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';

const ACTION_COSTS: Record<string, number> = {
  navigate: 10,
  click: 5,
  type: 5,
  screenshot: 15,
  extract: 10,
  evaluate: 20,
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, monthlyCredits: true, creditsUsed: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request
    const body = await req.json();
    const { sessionId, action } = body as {
      sessionId: string;
      action: BrowserAction;
    };

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Session ID and action required' },
        { status: 400 }
      );
    }

    // Validate action type
    if (!ACTION_COSTS[action.type]) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    const actionCost = ACTION_COSTS[action.type];
    const availableCredits = user.monthlyCredits - user.creditsUsed;

    // Check credits
    if (availableCredits < actionCost) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: actionCost,
          available: availableCredits,
        },
        { status: 402 }
      );
    }

    // Security: Check for prompt injection in action parameters
    const injectionTargets = [action.target, action.value, action.code].filter(Boolean);
    for (const target of injectionTargets) {
      const injectionCheck = browserControl.detectPromptInjection(target as string);
      if (injectionCheck.isInjection) {
        // Log security incident
        await prisma.usageRecord.create({
          data: {
            userId: user.id,
            type: 'security_alert',
            credits: 0,
            metadata: {
              type: 'prompt_injection',
              patterns: injectionCheck.patterns,
              sessionId,
              action: action.type,
            },
          },
        });

        return NextResponse.json(
          {
            error: 'Security violation',
            message: 'Potential prompt injection detected',
            patterns: injectionCheck.patterns,
          },
          { status: 400 }
        );
      }
    }

    // Security: Validate URL if navigate action
    if (action.type === 'navigate' && action.target) {
      const urlValidation = browserControl.validateURL(action.target);
      if (!urlValidation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid URL',
            message: urlValidation.reason,
          },
          { status: 400 }
        );
      }
    }

    // Execute action
    const result = await browserControl.executeAction(sessionId, action);

    // Deduct credits on success
    if (result.success) {
      await deductCredits(user.id, actionCost, {
        type: `browser_${action.type}`,
        description: `Browser ${action.type} action executed`,
      });
    }

    // Log security warnings
    if (result.securityWarnings && result.securityWarnings.length > 0) {
      await prisma.usageRecord.create({
        data: {
          userId: user.id,
          type: 'security_warning',
          credits: 0,
          metadata: {
            sessionId,
            warnings: result.securityWarnings,
            actionType: action.type,
          },
        },
      });
    }

    return NextResponse.json({
      ...result,
      creditsUsed: result.success ? actionCost : 0,
      creditsRemaining: result.success ? availableCredits - actionCost : availableCredits,
    });
  } catch (error: any) {
    console.error('Browser action execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action', message: error.message },
      { status: 500 }
    );
  }
}
