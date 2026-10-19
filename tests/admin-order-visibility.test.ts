import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as placeOrderRoute } from '@/app/api/orders/route';
import { POST as verifyPaymentRoute } from '@/app/api/payments/verify/route';
import { GET as getAdminOrdersRoute } from '@/app/api/admin/orders/route';
import { GET as getAdminMetricsRoute } from '@/app/api/admin/metrics/route';
import { getFestivals, _resetDbForTesting } from '@/lib/db/store';
import { ADMIN_SECRET_KEY } from '@/lib/auth';

describe('Admin Confirmed Order Visibility & Hindu Calendar Tests', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  it('Flow: Place test order -> confirm payment -> immediately visible in admin orders and metrics', async () => {
    // 1. Place a new order with custom typed apartment name
    const orderPayload = {
      customer: {
        customerName: 'Srinivas Murthy',
        phone: '9876543210',
        apartmentCommunity: 'Aparna Serene Park',
        buildingTower: 'Tower 5',
        flatNumber: 'Flat 1104',
        deliveryInstructions: 'Ring doorbell after 6:30 AM',
      },
      items: [
        { productId: 'prod-jasmine', quantity: 2 },
        { productId: 'prod-yellow-marigold', quantity: 1 },
      ],
      deliverySchedule: {
        type: 'one-time',
        date: '2026-10-25',
        timeSlot: 'morning',
      },
      paymentMethod: 'whatsapp_upi',
    };

    const orderReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    const orderRes = await placeOrderRoute(orderReq);
    expect(orderRes.status).toBe(200);
    const orderData = await orderRes.json();
    expect(orderData.success).toBe(true);
    const orderId = orderData.order.id;
    expect(orderId).toBeDefined();

    // 2. Simulate payment confirmation (Customer pays or florist verifies)
    const paymentReq = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        isSimulation: true,
        simulationResult: 'success',
      }),
    });

    const paymentRes = await verifyPaymentRoute(paymentReq);
    expect(paymentRes.status).toBe(200);
    const paymentData = await paymentRes.json();
    expect(paymentData.success).toBe(true);
    expect(paymentData.order.paymentStatus).toBe('paid');
    expect(paymentData.order.orderStatus).toBe('confirmed');

    // 3. Admin queries all orders via GET /api/admin/orders
    const adminOrdersReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
      },
    });

    const adminOrdersRes = await getAdminOrdersRoute(adminOrdersReq);
    expect(adminOrdersRes.status).toBe(200);
    const adminOrdersData = await adminOrdersRes.json();
    expect(adminOrdersData.orders).toBeDefined();

    // Verify the confirmed order is clearly present in admin orders
    const foundOrder = adminOrdersData.orders.find((o: any) => o.id === orderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.orderStatus).toBe('confirmed');
    expect(foundOrder.paymentStatus).toBe('paid');
    expect(foundOrder.customer.customerName).toBe('Srinivas Murthy');
    expect(foundOrder.customer.apartmentCommunity).toBe('Aparna Serene Park');

    // 4. Admin queries metrics
    const metricsReq = new NextRequest('http://localhost:3000/api/admin/metrics', {
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
      },
    });
    const metricsRes = await getAdminMetricsRoute(metricsReq);
    const metricsData = await metricsRes.json();
    expect(metricsData.metrics.paidOrdersCount).toBeGreaterThanOrEqual(1);
    expect(metricsData.metrics.totalOrdersCount).toBeGreaterThanOrEqual(1);
  });

  it('Only upcoming Hindu calendar festivals (Ekadashis, Deepavali, etc.) are returned', async () => {
    const festivals = await getFestivals();
    const todayStr = new Date().toISOString().split('T')[0];

    // Verify list is not empty
    expect(festivals.length).toBeGreaterThan(0);

    // Verify every festival is in the future
    for (const fest of festivals) {
      expect(fest.festivalDate >= todayStr).toBe(true);
    }

    // Verify presence of Ekadashis and key Hindu calendar holy days
    const names = festivals.map((f) => f.name.toLowerCase());
    const hasEkadashi = names.some((n) => n.includes('ekadashi'));
    expect(hasEkadashi).toBe(true);
  });
});
