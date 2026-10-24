import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getStallEntryById, saveStallEntry, deleteStallEntry } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const entry = await getStallEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: `Stall entry ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch stall entry' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await getStallEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: `Stall entry ${id} not found` }, { status: 404 });
    }

    const body = await req.json();
    const adminUser = auth.email || 'Administrator';
    const reason = body.reason || body.correctionReason || 'Updated stall daily entry';

    const updated = await saveStallEntry(
      {
        ...body,
        stallId: existing.stallId,
        date: existing.date,
        expectedVersion: body.expectedVersion ?? existing.version,
      },
      adminUser,
      reason
    );

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update stall entry' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const success = await deleteStallEntry(id);
    if (!success) {
      return NextResponse.json({ error: `Stall entry ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Stall entry ${id} deleted` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete stall entry' }, { status: 500 });
  }
}
