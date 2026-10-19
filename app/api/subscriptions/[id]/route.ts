import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  skipSubscriptionDate,
  cancelSubscription
} from '@/lib/db/store';

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
