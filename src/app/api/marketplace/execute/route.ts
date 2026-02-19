/**
 * Skill Execution API
 *
 * POST /api/marketplace/execute - Execute an installed skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSkillExecutor } from '@/lib/skills/skill-executor';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/execute
 *
 * Execute an installed skill.
 *
 * Request body:
 *   {
 *     skillId: string;
 *     input: Record<string, any>; // Input parameters for the skill
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { skillId, input } = body;

    if (!skillId) {
      return NextResponse.json(
        { error: 'skillId is required' },
        { status: 400 }
      );
    }

    if (!input || typeof input !== 'object') {
      return NextResponse.json(
        { error: 'input must be an object' },
        { status: 400 }
      );
    }

    // Get skill executor
    const executor = getSkillExecutor();

    // Execute skill
    const result = await executor.execute({
      skillId,
      userId: session.user.id,
      input,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          metadata: result.metadata,
        },
        { status: 400 }
      );
    }

    console.log(
      `[Marketplace] Skill executed: ${result.metadata.skillName} by ${session.user.email} (${result.metadata.creditsUsed} credits)`
    );

    return NextResponse.json({
      success: true,
      output: result.output,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Error executing skill:', error);
    captureAPIError(error as Error, '/api/marketplace/execute', 'POST');

    return NextResponse.json(
      { error: 'Failed to execute skill' },
      { status: 500 }
    );
  }
}
