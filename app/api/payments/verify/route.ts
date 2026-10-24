import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderPaymentStatus } from '@/lib/db/store';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getPaymentProvider } from '@/lib/payments';

/**
 * Server-side payment verification endpoint.
 * Delegates signature and gateway state validation to the configured PaymentProvider adapter.
 * Payment simulation is available only to an authorized administrator in non-production environments.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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

    const order = await getOrderById(orderId.trim());
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.paymentMethod?.toLowerCase() === 'cod') {
      return NextResponse.json(
        { error: 'Online payment verification is not available for a Cash on Delivery order.' },
        { status: 400 }
      );
    }

    // Idempotent guard: if order is already paid, do not re-mutate or allow downgrade
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Order is already marked as paid.',
        order,
      });
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
          paymentProvider: 'simulation',
          providerPaymentId: fakePaymentId,
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

    // Delegate verification to provider adapter (validates cryptographic signature & gateway state)
    const provider = getPaymentProvider(order.paymentProvider || 'razorpay');
    const verification = await provider.verifyPayment({
      order,
      params: {
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        signature: razorpaySignature,
      },
    });

    if (!verification.success) {
      // Do not mutate order on an invalid verification request
      return NextResponse.json(
        { error: verification.error || 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderPaymentStatus(orderId, 'paid', {
      paymentProvider: verification.provider,
      providerOrderId: verification.providerOrderId,
      providerPaymentId: verification.providerPaymentId,
      razorpayPaymentId: verification.providerPaymentId,
      razorpayOrderId: verification.providerOrderId,
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
