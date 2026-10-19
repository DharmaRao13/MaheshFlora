import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptions, getSubscriptionsByPhone, createSubscription } from '@/lib/db/store';
import { validateIndianPhone } from '@/lib/business';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (phone) {
      const subs = await getSubscriptionsByPhone(phone);
      return NextResponse.json({ subscriptions: subs });
    }

    const allSubs = await getSubscriptions();
    return NextResponse.json({ subscriptions: allSubs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
