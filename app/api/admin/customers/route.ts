import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getAdminCustomersList } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Admin authorization required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const customers = await getAdminCustomersList(search);
    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch customer list' }, { status: 500 });
  }
}
