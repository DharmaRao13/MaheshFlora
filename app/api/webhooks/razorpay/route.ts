import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrders, updateOrderPaymentStatus } from '@/lib/db/store';

function signaturesMatch(expectedHex: string, receivedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(receivedHex) || receivedHex.length !== expectedHex.length) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function POST(req: NextRequest) {
  try {
    // Read the unmodified body: gateway webhook signatures are calculated over raw bytes/text.
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured.');
      return NextResponse.json({ error: 'Webhook endpoint is not configured.' }, { status: 503 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature.' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!signaturesMatch(expectedSignature, signature)) {
      console.warn('Rejected webhook with invalid signature.');
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook JSON.' }, { status: 400 });
    }

    const eventType = event?.event;
    const payload = event?.payload?.payment?.entity;

    // Acknowledge unrelated but valid gateway events without changing order state.
    if (!payload || !['payment.captured', 'order.paid', 'payment.failed'].includes(eventType)) {
      return NextResponse.json({ success: true, ignoredEvent: eventType ?? 'unknown' });
    }

    const internalOrderId = payload.notes?.orderId;
    const gatewayOrderId = payload.order_id;

    if (!internalOrderId && !gatewayOrderId) {
      // Return a failure so the gateway can retry after an order/reference issue is fixed.
      return NextResponse.json({ error: 'Webhook has no order reference.' }, { status: 400 });
    }

    const orders = await getOrders();
    const targetOrder = orders.find(
      (order) =>
        (internalOrderId && order.id === internalOrderId) ||
        (gatewayOrderId && order.razorpayOrderId === gatewayOrderId)
    );

    if (!targetOrder) {
      console.warn('Verified webhook references an unknown internal order.');
      return NextResponse.json({ error: 'Referenced order was not found.' }, { status: 404 });
    }

    // Ignore duplicate delivery and never let a late failure event downgrade a paid order.
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (targetOrder.paymentStatus !== 'paid') {
        await updateOrderPaymentStatus(targetOrder.id, 'paid', {
          razorpayPaymentId: payload.id,
          razorpayOrderId: gatewayOrderId,
        });
      }
    } else if (eventType === 'payment.failed' && targetOrder.paymentStatus !== 'paid') {
      await updateOrderPaymentStatus(targetOrder.id, 'failed');
    }

    return NextResponse.json({ success: true, processedEvent: eventType });
  } catch (error: unknown) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
