import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getOrderById, updateOrderPaymentStatus } from '@/lib/db/store';
import { getPaymentProvider } from '@/lib/payments';

export async function POST(req: NextRequest) {
  try {
    // Read the unmodified body: gateway webhook signatures are calculated over raw bytes/text.
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    const provider = getPaymentProvider('razorpay');
    const result = await provider.verifyWebhook(rawBody, signature || '');

    if (!result.isValid) {
      if (result.error?.includes('missing RAZORPAY_WEBHOOK_SECRET')) {
        return NextResponse.json({ error: 'Webhook endpoint is not configured.' }, { status: 503 });
      }
      return NextResponse.json({ error: result.error || 'Invalid webhook signature.' }, { status: 400 });
    }

    // Acknowledge unrelated but valid gateway events without changing order state
    if (result.status === 'ignored') {
      return NextResponse.json({ success: true, ignoredEvent: result.event ?? 'unknown' });
    }

    const { internalOrderId, providerOrderId, providerPaymentId } = result;
    if (!internalOrderId && !providerOrderId) {
      return NextResponse.json({ error: 'Webhook has no order reference.' }, { status: 400 });
    }

    let targetOrder = internalOrderId ? await getOrderById(internalOrderId) : null;
    if (!targetOrder && providerOrderId) {
      const orders = await getOrders();
      targetOrder = orders.find(
        (order) => order.providerOrderId === providerOrderId || order.razorpayOrderId === providerOrderId
      ) || null;
    }

    if (!targetOrder) {
      console.warn('Verified webhook references an unknown internal order.');
      return NextResponse.json({ error: 'Referenced order was not found.' }, { status: 404 });
    }

    // Ignore duplicate delivery and never let a late failure event downgrade a paid order.
    // If persistence fails, error will bubble to catch block returning HTTP 500 so gateway retries.
    if (result.status === 'captured') {
      if (targetOrder.paymentStatus !== 'paid') {
        await updateOrderPaymentStatus(targetOrder.id, 'paid', {
          paymentProvider: result.provider,
          providerOrderId,
          providerPaymentId,
          razorpayPaymentId: providerPaymentId,
          razorpayOrderId: providerOrderId,
        });
      }
    } else if (result.status === 'failed' && targetOrder.paymentStatus !== 'paid') {
      await updateOrderPaymentStatus(targetOrder.id, 'failed');
    }

    return NextResponse.json({ success: true, processedEvent: result.event });
  } catch (error: unknown) {
    console.error('Webhook processing error:', error);
    // Returning 500 signals Razorpay to retry the webhook delivery
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
