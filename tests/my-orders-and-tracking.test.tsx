import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NextRequest } from 'next/server';
import {
  _resetDbForTesting,
  createOrder,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentStatus,
} from '@/lib/db/store';
import { GET as getOrdersRoute, POST as placeOrderRoute } from '@/app/api/orders/route';
import { GET as getOrderByIdRoute, PATCH as patchOrderByIdRoute } from '@/app/api/orders/[id]/route';
import { PATCH as updateAdminOrderRoute } from '@/app/api/admin/orders/route';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Order } from '@/types';
import MyOrdersClient from '@/app/orders/MyOrdersClient';
import OrderDetailsClient from '@/app/orders/[id]/OrderDetailsClient';
import Header from '@/components/Header';
import { canCancelOrder } from '@/lib/business';
import { CartProvider } from '@/context/CartContext';

describe('Mahesh Flora — My Orders and Order Tracking Tests', () => {
  beforeEach(() => {
    _resetDbForTesting();
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Navigation includes "My Orders" in desktop and mobile menu', () => {
    render(
      <CartProvider>
        <Header />
      </CartProvider>
    );
    // Desktop link
    const myOrdersDesktop = screen.getAllByRole('link', { name: /My Orders/i });
    expect(myOrdersDesktop.length).toBeGreaterThanOrEqual(1);

    // Mobile link text
    const mobileLinks = screen.getAllByText(/My Orders/i);
    expect(mobileLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Customer with multiple orders: sorts newest first and separates into Active Orders and Order History', async () => {
    const customerPhone = '9848011111';

    // 1. Older delivered order
    const oldDeliveredOrder: Order = {
      id: 'MF-HIST-01',
      accessToken: 'token-hist-01',
      customer: {
        customerName: 'Sita Rama',
        phone: '+919848011111',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block A',
        flatNumber: '101',
      },
      items: [
        { productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: 'per 100g', quantity: 1, itemTotalPaise: 6000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-10', timeSlot: 'morning' },
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: '2026-10-10T08:00:00.000Z',
      updatedAt: '2026-10-10T09:00:00.000Z',
    };

    // 2. Cancelled order
    const cancelledOrder: Order = {
      id: 'MF-HIST-02',
      accessToken: 'token-hist-02',
      customer: {
        customerName: 'Sita Rama',
        phone: '+919848011111',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block A',
        flatNumber: '101',
      },
      items: [
        { productId: 'prod-rose', name: 'Rose', pricePaise: 5000, unit: 'per 250g packet', quantity: 1, itemTotalPaise: 5000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time', date: '2026-10-12', timeSlot: 'morning' },
      orderStatus: 'cancelled',
      cancellationReason: 'Customer requested cancellation',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      createdAt: '2026-10-12T08:00:00.000Z',
      updatedAt: '2026-10-12T08:30:00.000Z',
    };

    // 3. Newer active order (preparing)
    const activeOrder: Order = {
      id: 'MF-ACT-01',
      accessToken: 'token-act-01',
      customer: {
        customerName: 'Sita Rama',
        phone: '+919848011111',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block A',
        flatNumber: '101',
      },
      items: [
        { productId: 'prod-yellow-marigold', name: 'Yellow Marigold', pricePaise: 4000, unit: 'per 250g packet', quantity: 2, itemTotalPaise: 8000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 8000,
      deliveryFeePaise: 3000,
      totalPaise: 11000,
      deliverySchedule: { type: 'one-time', date: '2026-10-19', timeSlot: 'morning' },
      orderStatus: 'preparing',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    };

    await createOrder(oldDeliveredOrder);
    await createOrder(cancelledOrder);
    await createOrder(activeOrder);

    // Verify API returns them newest first
    const req = new NextRequest(`http://localhost:3000/api/orders?phone=${customerPhone}`, {
      headers: { 'x-customer-phone': customerPhone },
    });
    const res = await getOrdersRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders.length).toBe(3);
    expect(data.orders[0].id).toBe('MF-ACT-01'); // Newest first

    // Check separation
    const active = data.orders.filter((o: Order) => !['delivered', 'cancelled'].includes(o.orderStatus));
    const history = data.orders.filter((o: Order) => ['delivered', 'cancelled'].includes(o.orderStatus));
    expect(active.length).toBe(1);
    expect(history.length).toBe(2);
  });

  it('3. Customer with no orders displays helpful empty state with flower catalogue link', () => {
    const { getByText, getByRole } = render(<MyOrdersClient />);
    expect(getByText(/No active orders/i)).toBeInTheDocument();
    const exploreBtn = getByRole('link', { name: /Explore Flower Catalogue/i });
    expect(exploreBtn).toHaveAttribute('href', '/flowers');
  });

  it('4. Cancelled orders: Clearly displayed without showing as delivered, with cancellation notice', () => {
    const cancelledOrder: Order = {
      id: 'MF-CANCELLED-99',
      customer: {
        customerName: 'Ramesh Babu',
        phone: '+919848099999',
        apartmentCommunity: 'Aparna Sarovar',
        buildingTower: 'Block D',
        flatNumber: '1202',
      },
      items: [
        { productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: 'per 100g', quantity: 1, itemTotalPaise: 6000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-20', timeSlot: 'morning' },
      orderStatus: 'cancelled',
      cancellationReason: 'Customer had to travel outside Hyderabad',
      cancelledAt: '2026-10-18T12:00:00.000Z',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      createdAt: '2026-10-18T09:00:00.000Z',
      updatedAt: '2026-10-18T12:00:00.000Z',
    };

    const { getByText, queryByText, getAllByText } = render(
      <OrderDetailsClient initialOrder={cancelledOrder} />
    );

    // Must show CANCELLED status
    expect(getAllByText(/CANCELLED/i).length).toBeGreaterThanOrEqual(1);
    expect(getByText(/This Order Has Been Cancelled/i)).toBeInTheDocument();
    expect(getByText(/Customer had to travel outside Hyderabad/i)).toBeInTheDocument();

    // Must NOT show Delivered step or active packing step
    expect(queryByText(/Preparing Order/i)).toBeNull();
  });

  it('5. Customer can self-cancel a pending order, but cannot cancel once preparing or out for delivery', async () => {
    const pendingOrder: Order = {
      id: 'MF-PENDING-CANCEL-01',
      accessToken: 'sec-token-1234',
      customer: {
        customerName: 'Anil Kumar',
        phone: '+919848033333',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block C',
        flatNumber: '302',
      },
      items: [{ productId: 'prod-rose', name: 'Rose', pricePaise: 5000, unit: 'per 250g packet', quantity: 1, itemTotalPaise: 5000 }],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time', date: '2026-10-22', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(pendingOrder);

    // Business check permits
    expect(canCancelOrder(pendingOrder).allowed).toBe(true);

    // Customer cancellation request
    const cancelReq = new NextRequest(`http://localhost:3000/api/orders/${pendingOrder.id}?token=sec-token-1234`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', reason: 'Change of puja plans' }),
    });

    const res = await patchOrderByIdRoute(cancelReq, { params: Promise.resolve({ id: pendingOrder.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.orderStatus).toBe('cancelled');
    expect(data.order.cancellationReason).toBe('Change of puja plans');

    // Once preparing, business rule prevents cancellation
    const preparingOrder: Order = {
      ...pendingOrder,
      id: 'MF-PREP-01',
      orderStatus: 'preparing',
    };
    expect(canCancelOrder(preparingOrder).allowed).toBe(false);
  });

  it('6. COD Payment Status remains "Payment Due" / "Pay on Delivery" until admin records cash receipt', async () => {
    const codOrder: Order = {
      id: 'MF-COD-TRACK-01',
      accessToken: 'token-cod-999',
      customer: {
        customerName: 'Gita M',
        phone: '+919848044444',
        apartmentCommunity: 'Jayabheri Silicon County',
        buildingTower: 'Block A',
        flatNumber: '501',
      },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: 'per 100g', quantity: 1, itemTotalPaise: 6000 }],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(codOrder);

    // Set verified customer phone in localStorage to authorize viewing
    localStorage.setItem('mahesh_customer_phone', '9848044444');

    // 1. Initial render shows Payment Due / Pay on Delivery
    const { getByText, queryByText } = render(
      <OrderDetailsClient initialOrder={codOrder} />
    );
    expect(getByText(/CASH ON DELIVERY • PAYMENT DUE/i)).toBeInTheDocument();
    expect(queryByText(/PAID IN CASH/i)).toBeNull();

    // 2. Admin records cash payment
    const adminReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_SECRET_KEY,
      },
      body: JSON.stringify({
        orderId: codOrder.id,
        recordCodCollection: true,
      }),
    });
    const patchRes = await updateAdminOrderRoute(adminReq);
    expect(patchRes.status).toBe(200);

    const updated = await getOrderById(codOrder.id);
    expect(updated?.paymentStatus).toBe('paid');
  });

  it('7. Verified Online Payment: Shows "Paid" only after server verification, never merely by opening an app', async () => {
    const onlineOrder: Order = {
      id: 'MF-ONLINE-TRACK-01',
      accessToken: 'token-online-01',
      customer: {
        customerName: 'Kishore K',
        phone: '+919848055555',
        apartmentCommunity: 'Lanco Hills',
        buildingTower: 'Tower 4',
        flatNumber: '402',
      },
      items: [{ productId: 'prod-chamanthi', name: 'Chamanthi', pricePaise: 6000, unit: 'per 250g packet', quantity: 1, itemTotalPaise: 6000 }],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid', // Customer opened app, but payment not verified yet
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(onlineOrder);

    // Set verified customer phone in localStorage to authorize viewing
    localStorage.setItem('mahesh_customer_phone', '9848055555');

    // Initial render shows pending
    const { getByText, queryByText } = render(
      <OrderDetailsClient initialOrder={onlineOrder} />
    );
    expect(getByText(/PAYMENT PENDING/i)).toBeInTheDocument();
    expect(queryByText(/PAYMENT CONFIRMED/i)).toBeNull();

    // Now simulate trusted server-side verification
    await updateOrderPaymentStatus(onlineOrder.id, 'paid');
    const updated = await getOrderById(onlineOrder.id);
    expect(updated?.paymentStatus).toBe('paid');
    expect(updated?.orderStatus).toBe('confirmed');
  });

  it('8. Live Admin Status Update: Updates in store and is returned with updated timestamp', async () => {
    const order: Order = {
      id: 'MF-LIVE-UPDATE-01',
      accessToken: 'live-token-111',
      customer: {
        customerName: 'Madhavi L',
        phone: '+919848066666',
        apartmentCommunity: 'Aparna Sarovar Zenith',
        buildingTower: 'Tower B',
        flatNumber: '804',
      },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: 'per 100g', quantity: 1, itemTotalPaise: 6000 }],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    };

    await createOrder(order);

    // Admin advances status to 'out_for_delivery'
    const adminReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_SECRET_KEY,
      },
      body: JSON.stringify({
        orderId: order.id,
        orderStatus: 'out_for_delivery',
      }),
    });
    const patchRes = await updateAdminOrderRoute(adminReq);
    expect(patchRes.status).toBe(200);

    // Tracking API request using customer token returns updated status
    const trackReq = new NextRequest(`http://localhost:3000/api/orders/${order.id}?token=live-token-111`);
    const trackRes = await getOrderByIdRoute(trackReq, { params: Promise.resolve({ id: order.id }) });
    expect(trackRes.status).toBe(200);
    const trackData = await trackRes.json();
    expect(trackData.order.orderStatus).toBe('out_for_delivery');
    expect(trackData.order.statusUpdatedAt).toBeDefined();
  });

  it('9. Security & Access Control: Unauthorized access to another customer’s order is blocked (403 Forbidden)', async () => {
    const victimOrder: Order = {
      id: 'MF-VICTIM-ORDER-01',
      accessToken: 'secret-token-victim',
      customer: {
        customerName: 'Private Customer',
        phone: '+919848077777',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block E',
        flatNumber: '901',
      },
      items: [{ productId: 'prod-rose', name: 'Rose', pricePaise: 5000, unit: 'per 250g packet', quantity: 1, itemTotalPaise: 5000 }],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(victimOrder);

    // Attacker tries to read victim's order with wrong token
    const attackerReq = new NextRequest(`http://localhost:3000/api/orders/${victimOrder.id}?token=wrong-token`, {
      headers: { 'x-customer-phone': '9848099999' },
    });
    const res = await getOrderByIdRoute(attackerReq, { params: Promise.resolve({ id: victimOrder.id }) });
    expect(res.status).toBe(403);

    // Public list orders without credentials is also blocked
    const anonymousReq = new NextRequest('http://localhost:3000/api/orders');
    const anonRes = await getOrdersRoute(anonymousReq);
    expect(anonRes.status).toBe(401);
  });

  it('10. Guest order UI verification barrier: requires phone verification when accessing without token, and unlocks on match', () => {
    const order: Order = {
      id: 'MF-SEC-CHECK-01',
      accessToken: 'token-strictly-private',
      customer: {
        customerName: 'Pooja Reddy',
        phone: '+919848088888',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block B',
        flatNumber: '202',
      },
      items: [{ productId: 'prod-rose', name: 'Rose', pricePaise: 5000, unit: 'per 250g packet', quantity: 1, itemTotalPaise: 5000 }],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // When rendered without token or phone in localStorage:
    const { getByText, getByPlaceholderText, queryByText } = render(
      <OrderDetailsClient initialOrder={order} />
    );

    // Shows security barrier
    expect(getByText(/Order Verification Required/i)).toBeInTheDocument();
    expect(queryByText(/Order Placed Successfully/i)).toBeNull();

    // Enter matching phone number
    const input = getByPlaceholderText(/Enter 10-digit phone/i);
    fireEvent.change(input, { target: { value: '9848088888' } });
    fireEvent.click(getByText(/Verify & View Order/i));

    // Now unlocked
    expect(getByText(/Order Placed Successfully/i)).toBeInTheDocument();
  });
});
