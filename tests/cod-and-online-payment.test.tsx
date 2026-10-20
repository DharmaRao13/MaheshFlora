import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NextRequest } from 'next/server';
import { _resetDbForTesting, createOrder, getOrderById } from '@/lib/db/store';
import { POST as placeOrderRoute } from '@/app/api/orders/route';
import { POST as verifyPaymentRoute } from '@/app/api/payments/verify/route';
import { PATCH as updateAdminOrderRoute } from '@/app/api/admin/orders/route';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { generateWhatsAppOrderLink } from '@/lib/business';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { Order } from '@/types';
import OrderDetailsClient from '@/app/orders/[id]/OrderDetailsClient';

describe('COD and Online Payment Flow Tests', () => {
  beforeEach(() => {
    _resetDbForTesting();
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Cash on Delivery (COD) order creation sets paymentMethod: cod, paymentStatus: payment_due, and no testPaymentPaise', async () => {
    const codOrderReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-uid': 'cust_suresh',
        'x-customer-phone': '9848012345',
      },
      body: JSON.stringify({
        customer: {
          customerName: 'Suresh Varma',
          phone: '9848012345',
          apartmentCommunity: 'My Home Bhooja',
          buildingTower: 'Block B',
          flatNumber: '401',
        },
        items: [{ productId: 'prod-yellow-marigold', quantity: 2 }],
        deliverySchedule: {
          type: 'one-time',
          date: '2026-10-25',
          timeSlot: 'morning',
        },
        paymentMethod: 'cod',
      }),
    });

    const res = await placeOrderRoute(codOrderReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const order: Order = data.order;
    expect(order.paymentMethod).toBe('cod');
    expect(order.paymentStatus).toBe('payment_due');
    expect(order.testPaymentPaise).toBeUndefined(); // Never ₹1 test mode on COD
    expect(order.orderStatus).toBe('pending_confirmation');

    // Verify WhatsApp prefilled message for COD
    expect(order.whatsappLink).toContain(encodeURIComponent('Payment Method: Cash on Delivery (COD)'));
    expect(order.whatsappLink).toContain(encodeURIComponent('Pay cash when your flowers are delivered.'));
    expect(order.whatsappLink).not.toContain(encodeURIComponent('TEST PAYMENT MODE'));
    expect(order.whatsappLink).not.toContain(encodeURIComponent('UPI ID'));
  });

  it('2. COD order UI: No online payment panel, no QR code, no UPI buttons, and shows "Pay cash when your flowers are delivered."', () => {
    const codOrder: Order = {
      id: 'MF-TEST-COD-01',
      customer: {
        customerName: 'Ananya Rao',
        phone: '+919876543210',
        apartmentCommunity: 'Aparna Serene Park',
        buildingTower: 'Tower 2',
        flatNumber: '302',
      },
      items: [
        {
          productId: 'prod-yellow-marigold',
          name: 'Yellow Marigold',
          pricePaise: 4000,
          unit: 'per 250g',
          quantity: 1,
          itemTotalPaise: 4000,
        },
      ],
      orderType: 'one-time',
      subtotalPaise: 4000,
      deliveryFeePaise: 3000,
      totalPaise: 7000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { queryByText, queryByAltText, getAllByText } = render(
      <OrderDetailsClient initialOrder={codOrder} paymentTestMode={true} />
    );

    // 1. Must display "Pay cash when your flowers are delivered."
    expect(getAllByText(/Pay cash when your flowers are delivered\./i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/CASH ON DELIVERY • PAYMENT DUE/i).length).toBeGreaterThanOrEqual(1);

    // 2. Must NOT display online payment elements
    expect(queryByText(/Complete Payment via WhatsApp UPI/i)).toBeNull();
    expect(queryByAltText(/UPI Payment QR Code/i)).toBeNull();
    expect(queryByText(/PhonePe/i)).toBeNull();
    expect(queryByText(/Google Pay/i)).toBeNull();
    expect(queryByText(/Paytm/i)).toBeNull();
    expect(queryByText(/TEST PAYMENT MODE ACTIVE/i)).toBeNull();
  });

  it('3. Online payment order UI: Correctly shows online payment panel, QR code, and UPI payment buttons', () => {
    const onlineOrder: Order = {
      id: 'MF-TEST-ONLINE-01',
      customer: {
        customerName: 'Kavitha S',
        phone: '+919876543211',
        apartmentCommunity: 'Jayabheri Silicon County',
        buildingTower: 'Block C',
        flatNumber: '1104',
      },
      items: [
        {
          productId: 'prod-jasmine',
          name: 'Jasmine',
          pricePaise: 6000,
          unit: 'per 100g',
          quantity: 1,
          itemTotalPaise: 6000,
        },
      ],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { getByText, getByAltText, queryByText, getAllByText } = render(
      <OrderDetailsClient initialOrder={onlineOrder} paymentTestMode={false} />
    );

    // Online panel and QR code should be visible
    expect(getByText(/Complete Payment via WhatsApp UPI/i)).toBeInTheDocument();
    expect(getByAltText(/UPI Payment QR Code/i)).toBeInTheDocument();
    expect(getAllByText(/PhonePe/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Google Pay/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Paytm/i).length).toBeGreaterThanOrEqual(1);

    // Should NOT show COD message
    expect(queryByText(/Pay cash when your flowers are delivered\./i)).toBeNull();
  });

  it('4. Test payment tools are restricted to authorized admins; unauthorized customers cannot mark order as paid', async () => {
    // 1. Create pending online order
    const onlineOrder: Order = {
      id: 'MF-TEST-UNAUTH-01',
      customer: {
        customerName: 'Test Customer',
        phone: '+919876543212',
        apartmentCommunity: 'Lanco Hills',
        buildingTower: 'Tower 9',
        flatNumber: '901',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createOrder(onlineOrder);

    // 2. Customer attempts to call verify simulation without admin credentials
    const unauthReq = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'MF-TEST-UNAUTH-01',
        isSimulation: true,
        simulationResult: 'success',
      }),
    });

    const unauthRes = await verifyPaymentRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Verify order remains unpaid in the database
    const orderInDb = await getOrderById('MF-TEST-UNAUTH-01');
    expect(orderInDb?.paymentStatus).toBe('unpaid');
  });

  it('5. Online payment verification is rejected on Cash on Delivery orders', async () => {
    const codOrder: Order = {
      id: 'MF-TEST-COD-GUARD-01',
      customer: {
        customerName: 'Naveen Kumar',
        phone: '+919876543213',
        apartmentCommunity: 'PBEL City',
        buildingTower: 'Tower A',
        flatNumber: '502',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 5000,
      deliveryFeePaise: 3000,
      totalPaise: 8000,
      deliverySchedule: { type: 'one-time' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createOrder(codOrder);

    // Attempting online payment verification on a COD order
    const req = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: 'MF-TEST-COD-GUARD-01',
        isSimulation: true,
        simulationResult: 'success',
      }),
    });

    const res = await verifyPaymentRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Cash on Delivery');

    // Confirm status remains unchanged
    const orderInDb = await getOrderById('MF-TEST-COD-GUARD-01');
    expect(orderInDb?.paymentStatus).toBe('payment_due');
  });

  it('6. Admin can record COD cash collection via existing admin workflow', async () => {
    const codOrder: Order = {
      id: 'MF-TEST-COD-ADMIN-01',
      customer: {
        customerName: 'Vikram Seth',
        phone: '+919876543214',
        apartmentCommunity: 'Prestige High Fields',
        buildingTower: 'Tower 5',
        flatNumber: '1402',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 10000,
      deliveryFeePaise: 0,
      totalPaise: 10000,
      deliverySchedule: { type: 'one-time' },
      orderStatus: 'out_for_delivery',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createOrder(codOrder);

    // Admin records COD cash collection
    const adminReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      method: 'PATCH',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: 'MF-TEST-COD-ADMIN-01',
        recordCodCollection: true,
      }),
    });

    const adminRes = await updateAdminOrderRoute(adminReq);
    expect(adminRes.status).toBe(200);
    const data = await adminRes.json();
    expect(data.success).toBe(true);
    expect(data.order.paymentStatus).toBe('paid');

    // Order in DB is now paid
    const updated = await getOrderById('MF-TEST-COD-ADMIN-01');
    expect(updated?.paymentStatus).toBe('paid');
  });
});
