import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  skipSubscriptionDate,
  cancelSubscription,
} from '@/lib/db/store';
import { verifyAdminAuthorizationAsync, verifyCustomerTokenAsync } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, skipDate } = body;

    const sub = await getSubscriptionById(id);
    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Check authorization: Admin or Owner Customer
    const adminAuth = await verifyAdminAuthorizationAsync(req);
    if (!adminAuth.authorized) {
      const customerAuth = await verifyCustomerTokenAsync(req);
      if (!customerAuth.authenticated) {
        return NextResponse.json(
          { error: 'Unauthorized: Sign in required to modify subscriptions.' },
          { status: 401 }
        );
      }

      // Check UID or Phone match
      const subPhoneNorm = sub.customer?.phone?.replace(/\D/g, '').slice(-10);
      const authPhoneNorm = customerAuth.phone?.replace(/\D/g, '').slice(-10);
      const isOwner =
        (sub.customer?.uid && sub.customer.uid === customerAuth.uid) ||
        (subPhoneNorm && authPhoneNorm && subPhoneNorm === authPhoneNorm);

      if (!isOwner) {
        return NextResponse.json(
          { error: 'Forbidden: You can only modify your own subscriptions.' },
          { status: 403 }
        );
      }
    }

    let updated;
    switch (action) {
      case 'pause':
        updated = await pauseSubscription(id);
        break;
      case 'resume':
        updated = await resumeSubscription(id);
        break;
      case 'skip':
        if (!skipDate) {
          return NextResponse.json({ error: 'skipDate is required to skip' }, { status: 400 });
        }
        updated = await skipSubscriptionDate(id, skipDate);
        break;
      case 'cancel':
        updated = await cancelSubscription(id);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error('Subscription PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update subscription' }, { status: 500 });
  }
}
