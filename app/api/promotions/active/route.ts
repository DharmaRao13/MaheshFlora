import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db/store';

export async function GET() {
  try {
    const settings = await getSettings();
    const promo = settings.deliveryPromotion;
    if (!promo || !promo.enabled) {
      return NextResponse.json({ active: false });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (promo.startDate && todayStr < promo.startDate) {
      return NextResponse.json({ active: false, reason: 'Not started' });
    }
    if (promo.endDate && todayStr > promo.endDate) {
      return NextResponse.json({ active: false, reason: 'Expired' });
    }
    if (
      promo.maxQualifyingOrders !== undefined &&
      promo.maxQualifyingOrders > 0 &&
      (promo.currentQualifyingOrdersCount || 0) >= promo.maxQualifyingOrders
    ) {
      return NextResponse.json({ active: false, reason: 'Limit reached' });
    }

    return NextResponse.json({
      active: true,
      promotion: {
        id: promo.id,
        title: promo.title,
        type: promo.type,
        minOrderAmountPaise: promo.minOrderAmountPaise,
        bannerWording: promo.bannerWording || promo.title,
        isCombinable: promo.isCombinable,
        maxUsesPerCustomer: promo.maxUsesPerCustomer,
      },
      standardDeliveryFeePaise: settings.standardDeliveryFeePaise,
      freeDeliveryThresholdPaise: settings.freeDeliveryThresholdPaise,
    });
  } catch (err: any) {
    return NextResponse.json({ active: false, error: err.message }, { status: 500 });
  }
}
