import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-auth';
import { getMarginReport } from '@/lib/admin/margin';

// GET /api/admin/margin?days=30 - Cost vs. implied revenue by model and customer
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const daysParam = req.nextUrl.searchParams.get('days');
    const days = daysParam ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || 30)) : 30;

    const report = await getMarginReport(days);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating margin report:', error);
    return NextResponse.json({ error: 'Failed to generate margin report' }, { status: 500 });
  }
}
