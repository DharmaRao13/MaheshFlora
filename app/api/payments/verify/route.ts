import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderById, updateOrderPaymentStatus } from '@/lib/db/store';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';

/**
 * Verifies Razorpay checkout signatures on the server.
 * Payment simulation is available only to an authorized administrator.
 * Never configure fallback/mock secrets in production.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      isSimulation,
      simulationResult,
    } = body;

    if (typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.paymentMethod?.toLowerCase() === 'cod') {
      return NextResponse.json(
        { error: 'Online payment verification is not available for a Cash on Delivery order.' },
        { status: 400 }
      );
    }

    if (isSimulation) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Payment simulation is disabled in production.' }, { status: 403 });
      }

      const auth = await verifyAdminAuthorizationAsync(req);
      if (!auth.authorized) {
        return NextResponse.json({ error: 'Administrative authorization required.' }, { status: 401 });
      }

      if (simulationResult === 'success') {
        const fakePaymentId = `pay_sim_${Date.now()}`;
        const updated = await updateOrderPaymentStatus(orderId, 'paid', {
          razorpayPaymentId: fakePaymentId,
        });
        return NextResponse.json({
          success: true,
          message: 'Payment simulation succeeded (development only).',
          order: updated,
        });
      }

      const updated = await updateOrderPaymentStatus(orderId, 'failed');
      return NextResponse.json({
        success: false,
        message: 'Payment simulation marked as failed (development only).',
        order: updated,
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('RAZORPAY_KEY_SECRET is not configured.');
      return NextResponse.json(
        { error: 'Online payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    if (
      typeof razorpayPaymentId !== 'string' ||
      typeof razorpayOrderId !== 'string' ||
      typeof razorpaySignature !== 'string' ||
      !razorpayPaymentId ||
      !razorpayOrderId ||
      !razorpaySignature
    ) {
      return NextResponse.json(
        { error: 'Missing payment signature verification parameters.' },
        { status: 400 }
      );
    }

    // Bind the gateway order to this internal order to prevent cross-order verification.
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: 'Payment order does not match this order.' }, { status: 400 });
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const received = Buffer.from(razorpaySignature, 'utf8');
    const expected = Buffer.from(generatedSignature, 'utf8');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      // Do not mutate the order on an invalid client request; otherwise a forged request
      // could mark a legitimate order as failed.
      return NextResponse.json(
        { error: 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderPaymentStatus(orderId, 'paid', {
      razorpayPaymentId,
      razorpayOrderId,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully.',
      order: updatedOrder,
    });
  } catch (error: unknown) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Server error verifying payment.' },
      { status: 500 }
    );
  }
}
