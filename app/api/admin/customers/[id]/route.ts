import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getAdminCustomerDetail } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Admin authorization required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const customer = await getAdminCustomerDetail(id);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch customer details' }, { status: 500 });
  }
}
