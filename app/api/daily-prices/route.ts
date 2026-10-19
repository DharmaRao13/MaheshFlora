import { NextResponse } from 'next/server';
import { getDailyPricesRecord } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const record = await getDailyPricesRecord();
    return NextResponse.json({
      success: true,
      dailyPrices: record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch daily prices' },
      { status: 500 }
    );
  }
}
