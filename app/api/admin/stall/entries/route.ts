import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getStallEntries, saveStallEntry } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('from') || undefined;
    const toDate = searchParams.get('to') || undefined;
    const stallId = searchParams.get('stallId') || undefined;
    const status = (searchParams.get('status') as 'draft' | 'finalized') || undefined;

    const entries = await getStallEntries({ fromDate, toDate, stallId, status });
    return NextResponse.json({ success: true, entries });
  } catch (error: any) {
    console.error('Error fetching stall entries:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch stall entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const adminUser = auth.email || 'Administrator';
    const reason = body.reason || body.correctionReason;

    const record = await saveStallEntry(body, adminUser, reason);
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving stall daily entry:', error);
    return NextResponse.json({ error: error.message || 'Failed to save stall daily entry' }, { status: 400 });
  }
}
