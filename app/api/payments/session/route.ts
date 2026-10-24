import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, attachOrderPaymentSession, getSettings } from '@/lib/db/store';
import { verifyOrderAccessAsync } from '@/lib/auth';
import { getPaymentProvider } from '@/lib/payments';

/**
 * Creates or retrieves a server-side payment gateway session for an existing internal order.
 * - Authenticates the request via customer Firebase token, guest access token, or admin credentials.
 * - Derives the amount strictly from server-trusted order records; ignores any client amounts.
 * - Prevents duplicate gateway orders by reusing valid active sessions for the order.
 * - Binds the provider order ID to the order record before returning to the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const order = await getOrderById(orderId.trim());
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // 1. Authorize order access
    const access = await verifyOrderAccessAsync(req, order);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || 'Unauthorized: You cannot access or initiate payment for this order.' },
        { status: 403 }
      );
    }

    // 2. Validate order state
    if (order.paymentMethod?.toLowerCase() === 'cod') {
      return NextResponse.json(
        { error: 'Cannot initiate online payment session for a Cash on Delivery order.' },
        { status: 400 }
      );
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json(
        { error: 'Order is already paid.' },
        { status: 400 }
      );
    }

    if (order.orderStatus === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot pay for a cancelled order.' },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const settings = await getSettings();
    const isTestMode = !isProduction && Boolean(settings.isPaymentTestMode || process.env.PAYMENT_TEST_MODE === 'true');
    const expectedAmountPaise = (!isProduction && order.testPaymentPaise) ? 100 : order.totalPaise;

    // 3. Concurrency & duplicate prevention: reuse existing active gateway order if safe
    const existingGatewayOrderId = order.providerOrderId || order.razorpayOrderId;
    const keyId = process.env.RAZORPAY_KEY_ID || (process.env.PAYMENT_TEST_MOCK === 'true' ? 'rzp_test_mock_key' : '');

    if (existingGatewayOrderId && keyId) {
      return NextResponse.json({
        success: true,
        session: {
          provider: order.paymentProvider || 'razorpay',
          providerOrderId: existingGatewayOrderId,
          amountPaise: expectedAmountPaise,
          currency: 'INR',
          keyId,
          orderId: order.id,
          reused: true,
        },
      });
    }

    // 4. Create session via provider adapter
    const provider = getPaymentProvider(order.paymentProvider || 'razorpay');
    const session = await provider.createSession({
      order,
      customer: {
        name: order.customer.customerName || order.customer.recipientName || 'Customer',
        phone: order.customer.phone || '',
      },
      isTestMode,
    });

    // 5. Securely bind provider order ID to internal order
    await attachOrderPaymentSession(order.id, {
      provider: session.provider,
      providerOrderId: session.providerOrderId,
      razorpayOrderId: session.providerOrderId,
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error('Payment session creation error:', error);
    const message = error?.message || 'Server error creating payment session.';
    if (message.includes('not configured')) {
      return NextResponse.json(
        { error: 'Online payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
