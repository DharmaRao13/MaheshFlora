import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, cancelOrder } from '@/lib/db/store';
import { verifyOrderAccess, verifyOrderAccessAsync } from '@/lib/auth';
import { canCancelOrder } from '@/lib/business';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const access = await verifyOrderAccessAsync(req, order);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || 'Unauthorized access to order' },
        { status: 403 }
      );
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const access = await verifyOrderAccessAsync(req, order);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || 'Unauthorized access to order' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, reason } = body;

    // Customer cancellation
    if (action === 'cancel') {
      const cancelCheck = canCancelOrder(order);
      if (!cancelCheck.allowed) {
        return NextResponse.json(
          { error: cancelCheck.reason || 'Order cannot be cancelled at this stage' },
          { status: 400 }
        );
      }

      const updated = await cancelOrder(id, reason || 'Customer requested cancellation');
      return NextResponse.json({ success: true, order: updated });
    }

    // Customers cannot modify paymentStatus, delivery status, items, or totals
    return NextResponse.json(
      { error: 'Unauthorized: Customers cannot modify order status or mark orders as paid.' },
      { status: 403 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
