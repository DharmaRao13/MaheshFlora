import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getDashboardMetrics } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json({ metrics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
