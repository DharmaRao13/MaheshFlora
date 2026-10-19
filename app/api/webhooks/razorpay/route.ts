import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrders, updateOrderPaymentStatus } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_mock_secret';

    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Invalid Razorpay webhook signature attempt.');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload?.payment?.entity;

    if (!payload) {
      return NextResponse.json({ message: 'Unhandled event payload' });
    }

    // Extract notes or order reference
    const orderId = payload.notes?.orderId || payload.order_id;
    if (!orderId) {
      return NextResponse.json({ message: 'No internal orderId attached to event' });
    }

    // Idempotent processing
    const orders = await getOrders();
    const targetOrder = orders.find((o) => o.id === orderId || o.razorpayOrderId === orderId);

    if (!targetOrder) {
      return NextResponse.json({ message: `Order ${orderId} not found in database` });
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (targetOrder.paymentStatus !== 'paid') {
        await updateOrderPaymentStatus(targetOrder.id, 'paid', {
          razorpayPaymentId: payload.id,
          razorpayOrderId: payload.order_id,
        });
      }
    } else if (eventType === 'payment.failed') {
      if (targetOrder.paymentStatus !== 'paid') {
        await updateOrderPaymentStatus(targetOrder.id, 'failed');
      }
    }

    return NextResponse.json({ success: true, processedEvent: eventType });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
