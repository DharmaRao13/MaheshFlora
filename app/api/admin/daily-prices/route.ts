import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorization } from '@/lib/auth';
import {
  getDailyPricesRecord,
  saveDailyPricesDraft,
  publishDailyPrices,
  getDailyPriceHistory,
  DAILY_PRICE_PRODUCT_IDS,
} from '@/lib/db/store';
import { DailyPriceItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const record = await getDailyPricesRecord();
    const history = await getDailyPriceHistory();
    return NextResponse.json({
      success: true,
      record,
      history,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch daily prices' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      action,
      items,
      adminName,
    }: {
      action: 'draft' | 'publish';
      items: Record<string, DailyPriceItem>;
      adminName?: string;
    } = body;

    if (action !== 'draft' && action !== 'publish') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "draft" or "publish".' },
        { status: 400 }
      );
    }

    if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty daily price items.' },
        { status: 400 }
      );
    }

    // Validate prices for each item
    for (const [id, item] of Object.entries(items)) {
      if (typeof item.pricePaise !== 'number' || isNaN(item.pricePaise)) {
        return NextResponse.json(
          { error: `Price for "${item.name || id}" must be a valid number.` },
          { status: 400 }
        );
      }
      if (item.pricePaise < 0) {
        return NextResponse.json(
          { error: `Price for "${item.name || id}" cannot be negative.` },
          { status: 400 }
        );
      }
    }

    if (action === 'draft') {
      const record = await saveDailyPricesDraft(items, adminName);
      return NextResponse.json({
        success: true,
        action: 'draft',
        record,
      });
    }

    // action === 'publish'
    // Ensure all 6 standard flowers are covered
    for (const flowerId of DAILY_PRICE_PRODUCT_IDS) {
      if (!items[flowerId]) {
        return NextResponse.json(
          { error: `Cannot publish: missing price for flower product ID "${flowerId}".` },
          { status: 400 }
        );
      }
    }

    const record = await publishDailyPrices(items, adminName);
    return NextResponse.json({
      success: true,
      action: 'publish',
      record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update daily prices' },
      { status: 500 }
    );
  }
}
