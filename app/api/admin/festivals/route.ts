import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorization } from '@/lib/auth';
import { getFestivals, getFestivalBookings, updateFestivalBookingStatus, addFestival } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const festivals = await getFestivals();
  const bookings = await getFestivalBookings();
  return NextResponse.json({ festivals, bookings });
}

export async function PATCH(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const { bookingId, status } = await req.json();
    if (!bookingId || !status) {
      return NextResponse.json({ error: 'bookingId and status are required' }, { status: 400 });
    }

    const updated = await updateFestivalBookingStatus(bookingId, status);
    return NextResponse.json({ success: true, booking: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
