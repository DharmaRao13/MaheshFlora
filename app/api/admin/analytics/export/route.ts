import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';
import { computeAnalyticsSummary, generateAnalyticsCSV } from '@/lib/analytics';
import {
  getOrders,
  getSubscriptions,
  getFestivals,
  getFestivalBookings,
  getExpenses,
  getProducts,
} from '@/lib/db/store';
import { DatePreset } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Verify administrative authorization
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const preset = (searchParams.get('preset') || 'last_7_days') as DatePreset;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    // 2. Compute date range in Asia/Kolkata
    const dateRange = calculateDateRange(preset, from, to);

    // 3. Fetch source records
    const [orders, subscriptions, festivals, festivalBookings, expenses, products] = await Promise.all([
      getOrders(),
      getSubscriptions(),
      getFestivals(),
      getFestivalBookings(),
      getExpenses(),
      getProducts(),
    ]);

    // 4. Compute analytics
    const summary = computeAnalyticsSummary({
      orders,
      subscriptions,
      festivals,
      festivalBookings,
      expenses,
      products,
      dateRange,
    });

    // 5. Generate sanitized CSV report
    const csvContent = generateAnalyticsCSV({
      summary,
      orders,
      expenses,
    });

    const filename = `mahesh-flora-financial-report-${dateRange.fromDate}-to-${dateRange.toDate}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('CSV export generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate financial export' },
      { status: 500 }
    );
  }
}
