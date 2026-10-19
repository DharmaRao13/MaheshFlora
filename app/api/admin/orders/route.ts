import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync, verifyOrderAccessAsync } from '@/lib/auth';
import { getOrders, updateOrderStatus, updateOrderPaymentStatus, getOrderById } from '@/lib/db/store';
import { OrderStatus, PaymentStatus } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Support both Admin updates and customer isolation checks
  const body = await req.json();
  const { orderId, orderStatus, paymentStatus, recordCodCollection } = body;

  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const existingOrder = await getOrderById(orderId);
  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check admin authorization
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    // If not admin, check if customer is attempting to modify someone else's order
    const access = await verifyOrderAccessAsync(req, existingOrder.customer.phone);
    if (!access.allowed) {
      return NextResponse.json(
        { error: 'Unauthorized: You cannot modify another customer’s order.' },
        { status: 403 }
      );
    }

    // Customers cannot arbitrarily mark orders as paid or delivered
    return NextResponse.json(
      { error: 'Unauthorized: Administrative rights required to modify order status.' },
      { status: 403 }
    );
  }

  try {
    let updated = existingOrder;
    if (orderStatus) {
      updated = await updateOrderStatus(orderId, orderStatus as OrderStatus);
    }
    if (paymentStatus) {
      updated = await updateOrderPaymentStatus(orderId, paymentStatus as PaymentStatus);
    }
    if (recordCodCollection) {
      // Mark as paid and delivered or confirmed
      updated = await updateOrderPaymentStatus(orderId, 'paid');
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
