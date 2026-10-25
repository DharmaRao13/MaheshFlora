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

    // Validate deliveryPromotion if present in updates
    if (updates.deliveryPromotion) {
      const dp = updates.deliveryPromotion;
      if (typeof dp.minOrderAmountPaise === 'number' && (isNaN(dp.minOrderAmountPaise) || dp.minOrderAmountPaise < 0)) {
        return NextResponse.json(
          { error: 'Minimum purchase amount must be a non-negative number.' },
          { status: 400 }
        );
      }
      if (dp.type && !['all_orders', 'first_time_customers', 'first_n_orders', 'first_time_and_first_n_orders'].includes(dp.type)) {
        return NextResponse.json(
          { error: 'Invalid promotion eligibility type.' },
          { status: 400 }
        );
      }
    }

    const updated = await updateSettings(updates);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const PUT = PATCH;
