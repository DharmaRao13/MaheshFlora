import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderById, updateOrderPaymentStatus } from '@/lib/db/store';
import { verifyAdminAuthorization } from '@/lib/auth';

/**
 * Server-side payment verification endpoint.
 * Supports Razorpay signature verification or safe dev simulator.
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

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Cash on Delivery orders should not have online payment verification
    if (order.paymentMethod?.toLowerCase() === 'cod') {
      return NextResponse.json(
        { error: 'Cannot process online payment verification for a Cash on Delivery (COD) order.' },
        { status: 400 }
      );
    }

    // Handle Safe Development Simulator (Restricted to authorized admin/developers)
    if (isSimulation) {
      const auth = verifyAdminAuthorization(req);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: 'Unauthorized: Administrative credentials required for payment simulation.' },
          { status: 401 }
        );
      }
      if (simulationResult === 'success') {
        const fakePaymentId = `pay_sim_${Date.now()}`;
        const updated = await updateOrderPaymentStatus(orderId, 'paid', {
          razorpayPaymentId: fakePaymentId,
        });
        return NextResponse.json({
          success: true,
          message: 'Payment simulation succeeded (DEV MODE)',
          order: updated,
        });
      } else {
        const updated = await updateOrderPaymentStatus(orderId, 'failed');
        return NextResponse.json({
          success: false,
          message: 'Payment simulation marked as failed (DEV MODE)',
          order: updated,
        });
      }
    }

    // Production / Test Razorpay Signature Verification
    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_devmock_secret';
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'Missing payment signature verification parameters' },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      await updateOrderPaymentStatus(orderId, 'failed');
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
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error verifying payment' },
      { status: 500 }
    );
  }
}
