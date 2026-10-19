import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as placeOrderRoute, GET as getCustomerOrdersRoute } from '@/app/api/orders/route';
import { GET as getOrderByIdRoute } from '@/app/api/orders/[id]/route';
import { GET as getAdminOrdersRoute } from '@/app/api/admin/orders/route';
import { GET as getAdminMetricsRoute } from '@/app/api/admin/metrics/route';
import { POST as verifyPaymentRoute } from '@/app/api/payments/verify/route';
import {
  _resetDbForTesting,
  _setFirestoreInstanceForTesting,
  createOrder,
  sanitizeForFirestore,
  getOrdersByPhone,
  getOrdersByCustomerUid,
} from '@/lib/db/store';
import { ADMIN_SECRET_KEY } from '@/lib/auth';

describe('Order Persistence, Admin Visibility & Customer Isolation Tests', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  it('1. sanitizeForFirestore strips undefined values recursively so Firestore never rejects payloads', () => {
    const dirty = {
      id: 'MF-TEST-001',
      customer: {
        name: 'Anil Kumar',
        phone: '+919876543210',
        deliveryInstructions: undefined,
        nested: {
          present: 'yes',
          missing: undefined,
        },
      },
      items: [
        { productId: 'prod-jasmine', quantity: 1, extraNotes: undefined },
      ],
      testPaymentPaise: undefined,
    };

    const clean = sanitizeForFirestore(dirty);
    expect(clean.customer.deliveryInstructions).toBeUndefined();
    expect('deliveryInstructions' in clean.customer).toBe(false);
    expect('missing' in clean.customer.nested).toBe(false);
    expect(clean.customer.nested.present).toBe('yes');
    expect('extraNotes' in clean.items[0]).toBe(false);
    expect('testPaymentPaise' in clean).toBe(false);
    expect(clean.id).toBe('MF-TEST-001');
  });

  it('2. Failed Firestore persistence throws an error and NEVER produces a false success confirmation', async () => {
    // Setup a mock Firestore that throws an error on doc.set()
    const mockFirestoreError = {
      collection: () => ({
        doc: () => ({
          set: async () => {
            throw new Error('Firestore UNAVAILABLE: write connection timed out');
          },
        }),
      }),
    };
    _setFirestoreInstanceForTesting(mockFirestoreError);

    const orderPayload = {
      customer: {
        customerName: 'Ramesh Patel',
        phone: '9876543210',
        apartmentCommunity: 'My Home Bhooja',
        flatNumber: 'Tower 2 - 1402',
      },
      items: [{ productId: 'prod-jasmine', quantity: 1 }],
      deliverySchedule: {
        type: 'one-time',
        date: '2026-10-25',
        timeSlot: 'morning',
      },
      paymentMethod: 'COD',
    };

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    const res = await placeOrderRoute(req);
    // Crucial check: Must return 500 error, NEVER false 200 OK
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to securely save order');
    expect(body.success).toBeUndefined();
  });

  it('3. Successful order creation strictly persists to Firestore and is returned to checkout', async () => {
    const writtenDocs = new Map<string, any>();
    const mockFirestore = {
      collection: (name: string) => {
        if (name === 'orders') {
          return {
            doc: (docId: string) => ({
              set: async (data: any) => {
                writtenDocs.set(docId, data);
              },
            }),
          };
        }
        throw new Error('Fallback to local memory for other collections in test');
      },
    };
    _setFirestoreInstanceForTesting(mockFirestore);

    const orderPayload = {
      customer: {
        customerName: 'Deepak Reddy',
        phone: '9876543210',
        apartmentCommunity: 'Jayabheri The Summit',
        flatNumber: 'Flat 801',
      },
      items: [{ productId: 'prod-yellow-marigold', quantity: 2 }],
      deliverySchedule: {
        type: 'one-time',
        date: '2026-10-26',
        timeSlot: 'morning',
      },
      paymentMethod: 'COD',
    };

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    const res = await placeOrderRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.order.id).toBeDefined();

    // Confirm that the document was actually written to the mock Firestore
    const persisted = writtenDocs.get(data.order.id);
    expect(persisted).toBeDefined();
    expect(persisted.customer.phone).toBe('+919876543210');
    expect(persisted.paymentMethod).toBe('COD');
    expect(persisted.paymentStatus).toBe('payment_due');
    expect(persisted.orderStatus).toBe('pending_confirmation');
  });

  it('4. Newly created order immediately appears in Admin pending-orders list and is not excluded by filters', async () => {
    // Place a new COD order
    const placeReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: {
          customerName: 'Kavitha Rao',
          phone: '9876543210',
          apartmentCommunity: 'Lanco Hills',
          flatNumber: 'Tower 7 - 504',
        },
        items: [{ productId: 'prod-rose', quantity: 1 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-27', timeSlot: 'morning' },
        paymentMethod: 'COD',
      }),
    });
    const placeRes = await placeOrderRoute(placeReq);
    const { order } = await placeRes.json();
    expect(order.orderStatus).toBe('pending_confirmation');

    // Admin fetches orders list via GET /api/admin/orders
    const adminReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const adminRes = await getAdminOrdersRoute(adminReq);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();

    const found = adminData.orders.find((o: any) => o.id === order.id);
    expect(found).toBeDefined();
    expect(found.orderStatus).toBe('pending_confirmation');
    expect(found.paymentStatus).toBe('payment_due');

    // Verify Admin Metrics include this pending order
    const metricsReq = new NextRequest('http://localhost:3000/api/admin/metrics', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const metricsRes = await getAdminMetricsRoute(metricsReq);
    expect(metricsRes.status).toBe(200);
    const metricsData = await metricsRes.json();
    expect(metricsData.metrics.pendingOrdersCount).toBeGreaterThanOrEqual(1);
    expect(metricsData.metrics.unpaidOrdersCount).toBeGreaterThanOrEqual(1);
  });

  it('5. The rightful customer sees the order in My Orders via verified phone number or UID', async () => {
    const customerPhone = '9876543210';
    const customerUid = 'firebase-user-uid-999';

    // Place order with customer UID attached (as done when user is logged in via Firebase Auth)
    const placeReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-customer-uid': customerUid,
        'x-customer-phone': customerPhone,
      },
      body: JSON.stringify({
        customer: {
          customerName: 'Praveen V',
          phone: customerPhone,
          apartmentCommunity: 'My Home Bhooja',
          flatNumber: 'Tower 4 - 302',
          uid: customerUid,
        },
        items: [{ productId: 'prod-jasmine', quantity: 1 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-28', timeSlot: 'morning' },
        paymentMethod: 'COD',
      }),
    });
    const placeRes = await placeOrderRoute(placeReq);
    const { order } = await placeRes.json();

    // Customer queries My Orders with phone number and matching phone header
    const customerReq = new NextRequest(`http://localhost:3000/api/orders?phone=${customerPhone}`, {
      headers: {
        'x-customer-phone': customerPhone,
        'x-customer-uid': customerUid,
      },
    });

    const customerRes = await getCustomerOrdersRoute(customerReq);
    expect(customerRes.status).toBe(200);
    const customerData = await customerRes.json();
    const found = customerData.orders.find((o: any) => o.id === order.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(order.id);
    expect(found.customer.phone).toBe('+91' + customerPhone);
  });

  it('6. A different customer is prevented from viewing another customer’s orders (Customer Isolation)', async () => {
    const rightfulPhone = '9876543210';
    const attackerPhone = '9123456780';

    // Place an order for rightful customer
    const placeReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: {
          customerName: 'Rightful Customer',
          phone: rightfulPhone,
          apartmentCommunity: 'My Home Bhooja',
          flatNumber: 'Tower 1 - 101',
        },
        items: [{ productId: 'prod-rose', quantity: 1 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-28', timeSlot: 'morning' },
        paymentMethod: 'COD',
      }),
    });
    const placeRes = await placeOrderRoute(placeReq);
    const { order } = await placeRes.json();

    // Attacker tries to query rightful customer's orders via GET /api/orders?phone=9876543210
    const attackReq = new NextRequest(`http://localhost:3000/api/orders?phone=${rightfulPhone}`, {
      headers: {
        'x-customer-phone': attackerPhone, // Attacker's verified phone
        'x-customer-uid': 'attacker-uid-456',
      },
    });
    const attackRes = await getCustomerOrdersRoute(attackReq);
    expect(attackRes.status).toBe(403);

    // Attacker tries to view single order via GET /api/orders/[id]
    const singleOrderReq = new NextRequest(`http://localhost:3000/api/orders/${order.id}`, {
      headers: {
        'x-customer-phone': attackerPhone,
        'x-customer-uid': 'attacker-uid-456',
      },
    });
    const singleOrderRes = await getOrderByIdRoute(singleOrderReq, {
      params: Promise.resolve({ id: order.id }),
    });
    expect(singleOrderRes.status).toBe(403);
  });

  it('7. Online payment is NOT marked as paid until trusted server-side payment verification', async () => {
    // Create an online payment order (e.g. WhatsApp UPI / Online)
    const placeReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: {
          customerName: 'Madhav V',
          phone: '9876543210',
          apartmentCommunity: 'Aparna Sarovar',
          flatNumber: 'Block C - 601',
        },
        items: [{ productId: 'prod-jasmine', quantity: 2 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-29', timeSlot: 'morning' },
        paymentMethod: 'whatsapp_upi',
      }),
    });
    const placeRes = await placeOrderRoute(placeReq);
    const { order } = await placeRes.json();

    // Must be unpaid initially, NOT paid
    expect(order.paymentStatus).toBe('unpaid');
    expect(order.orderStatus).toBe('pending_confirmation');

    // Untrusted/unauthorized payment verification attempt fails
    const fakeVerifyReq = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, isSimulation: true }),
    });
    const fakeRes = await verifyPaymentRoute(fakeVerifyReq);
    expect(fakeRes.status).toBe(401);

    // Trusted admin payment confirmation succeeds
    const adminVerifyReq = new NextRequest('http://localhost:3000/api/payments/verify', {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: order.id,
        isSimulation: true,
        simulationResult: 'success',
      }),
    });
    const adminVerifyRes = await verifyPaymentRoute(adminVerifyReq);
    expect(adminVerifyRes.status).toBe(200);
    const verifyData = await adminVerifyRes.json();
    expect(verifyData.order.paymentStatus).toBe('paid');
    expect(verifyData.order.orderStatus).toBe('confirmed');
  });
});
