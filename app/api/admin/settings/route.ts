import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorization } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const updates = await req.json();
    const updated = await updateSettings(updates);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
