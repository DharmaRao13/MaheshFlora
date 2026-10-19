import { NextRequest, NextResponse } from 'next/server';
import {
  getFestivalById,
  getProducts,
  getSettings,
  createFestivalBooking
} from '@/lib/db/store';
import { validateIndianPhone, calculateOrderTotals, generateWhatsAppOrderLink } from '@/lib/business';
import { FestivalBooking, FestivalBookingStatus, OrderItem, Address } from '@/types';
import { formatINR } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      festivalId,
      customer,
      items,
      specialGarlandNotes,
      preferredSlot,
    } = body;

    // Validate festival exists
    const festival = await getFestivalById(festivalId);
    if (!festival) {
      return NextResponse.json({ error: 'Selected festival not found' }, { status: 404 });
    }

    // Validate customer
    if (!customer?.customerName?.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const phoneVal = validateIndianPhone(customer?.phone);
    if (!phoneVal.valid) {
      return NextResponse.json({ error: phoneVal.error }, { status: 400 });
    }

    if (!customer?.apartmentCommunity?.trim()) {
      return NextResponse.json({ error: 'Apartment community is required' }, { status: 400 });
    }

    if (!customer?.flatNumber?.trim()) {
      return NextResponse.json({ error: 'Flat number is required' }, { status: 400 });
    }

    // Validate products & pricing
    const products = await getProducts();
    const settings = await getSettings();
    const calc = calculateOrderTotals(items, products, settings);
    if (calc.error) {
      return NextResponse.json({ error: calc.error }, { status: 400 });
    }

    const bookingId = `FEST-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;

    const validatedCustomer: Address = {
      ...customer,
      phone: phoneVal.formatted,
    };

    // Construct WhatsApp message
    const itemsSummary = calc.orderItems
      .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
      .join(', ');

    const slotLabel =
      preferredSlot === 'early_morning'
        ? 'Brahma Muhurtham (5:00 AM – 6:30 AM)'
        : preferredSlot === 'morning'
        ? 'Morning Puja (6:30 AM – 8:30 AM)'
        : 'Evening Sandhya (5:00 PM – 7:30 PM)';

    const whatsappLines = [
      'Hello Mahesh Flora!',
      '',
      `I would like to place an advance FESTIVAL booking for: ${festival.name}`,
      '',
      `Booking ID: ${bookingId}`,
      `Festival Date: ${festival.festivalDate}`,
      `Flowers: ${itemsSummary}`,
      specialGarlandNotes ? `Special Requirements / Garland: ${specialGarlandNotes}` : '',
      `Preferred Slot: ${slotLabel}`,
      `Apartment: ${validatedCustomer.flatNumber}, ${validatedCustomer.buildingTower}, ${validatedCustomer.apartmentCommunity}`,
      `Estimated Total: ${formatINR(calc.totalPaise)}`,
      '',
      'Please confirm booking availability.',
    ].filter(Boolean);

    const whatsappLink = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
      whatsappLines.join('\n')
    )}`;

    const newBooking: FestivalBooking = {
      id: bookingId,
      festivalId: festival.id,
      festivalName: festival.name,
      festivalDate: festival.festivalDate,
      customer: validatedCustomer,
      items: calc.orderItems,
      specialGarlandNotes: specialGarlandNotes?.trim() || undefined,
      preferredSlot: preferredSlot || 'morning',
      subtotalPaise: calc.subtotalPaise,
      deliveryFeePaise: calc.deliveryFeePaise,
      totalPaise: calc.totalPaise,
      status: 'requested',
      paymentStatus: 'pending',
      paymentMethod: 'whatsapp_upi',
      whatsappLink,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedBooking = await createFestivalBooking(newBooking);

    return NextResponse.json({
      success: true,
      booking: savedBooking,
    });
  } catch (error: any) {
    console.error('Festival booking error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
