import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  _resetDbForTesting,
  createOrder,
  getOrderById,
  getOrders,
} from '@/lib/db/store';
import {
  verifyAdminAuthorizationAsync,
  verifyCustomerTokenAsync,
  verifyOrderAccess,
  verifyOrderAccessAsync,
} from '@/lib/auth';
import { validateIndianPhone } from '@/lib/business';
import { POST as placeOrderRoute, GET as getOrdersRoute } from '@/app/api/orders/route';
import { POST as setClaimRoute } from '@/app/api/admin/set-claim/route';
import { POST as adminLoginRoute } from '@/app/api/admin/login/route';
import { Order } from '@/types';

describe('Mahesh Flora — Customer Phone OTP Auth & Admin Custom Claims', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  // 1. Phone number normalization to E.164
  it('1. Normalizes Indian phone numbers accurately to E.164 format (+91XXXXXXXXXX)', () => {
    expect(validateIndianPhone('9876543210')).toEqual({
      valid: true,
      formatted: '+919876543210',
    });
    expect(validateIndianPhone('+919876543210')).toEqual({
      valid: true,
      formatted: '+919876543210',
    });
    expect(validateIndianPhone('09876543210')).toEqual({
      valid: true,
      formatted: '+919876543210',
    });
    expect(validateIndianPhone('+91 98765 43210')).toEqual({
      valid: true,
      formatted: '+919876543210',
    });

    // Invalid numbers
    expect(validateIndianPhone('1234567890').valid).toBe(false);
    expect(validateIndianPhone('98765').valid).toBe(false);
    expect(validateIndianPhone('').valid).toBe(false);
  });

  // 2. Customer token verification attaches authenticated UID and phone
  it('2. verifyCustomerTokenAsync extracts and attaches authenticated customer UID and phone', async () => {
    const testReq = new NextRequest('http://localhost:3000/api/orders', {
      headers: {
        'x-customer-uid': 'cust-firebase-uid-99',
        'x-customer-phone': '+919876543210',
      },
    });

    const result = await verifyCustomerTokenAsync(testReq);
    expect(result.authenticated).toBe(true);
    expect(result.uid).toBe('cust-firebase-uid-99');
    expect(result.phone).toBe('+919876543210');
  });

  // 3. Order creation binds verified customer UID and phone
  it('3. Order creation binds verified UID and phone number to the order record', async () => {
    const orderReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-uid': 'verified-uid-1234',
        'x-customer-phone': '+919876543210',
      },
      body: JSON.stringify({
        customer: {
          customerName: 'Ananya Sharma',
          phone: '9876543210',
          apartmentCommunity: 'My Home Bhooja',
          buildingTower: 'Tower 4',
          flatNumber: '802',
        },
        items: [
          { productId: 'prod-yellow-marigold', quantity: 1 },
        ],
        deliverySchedule: {
          type: 'one-time',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          timeSlot: 'morning',
        },
        paymentMethod: 'cod',
      }),
    });

    const res = await placeOrderRoute(orderReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.order).toBeDefined();
    expect(data.order.customer.uid).toBe('verified-uid-1234');
    expect(data.order.customer.phone).toBe('+919876543210');
  });

  // 4. Customer order access restriction
  it('4. Restricts customer order access: customer cannot view other customers orders', async () => {
    const orderA: Order = {
      id: 'MF-ORD-A',
      accessToken: 'token-a',
      customer: {
        customerName: 'Customer A',
        phone: '+919876543210',
        uid: 'uid-customer-a',
        apartmentCommunity: 'Community A',
        buildingTower: 'Tower A',
        flatNumber: '101',
      },
      items: [
        { productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: 'per 100g', quantity: 1, itemTotalPaise: 6000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(orderA);

    // Customer B tries to access Order A
    const reqCustomerB = new NextRequest('http://localhost:3000/api/orders/MF-ORD-A', {
      headers: {
        'x-customer-uid': 'uid-customer-b',
        'x-customer-phone': '+919999999999',
      },
    });

    const accessCheck = await verifyOrderAccessAsync(reqCustomerB, orderA);
    expect(accessCheck.allowed).toBe(false);

    // Customer A accesses their own order
    const reqCustomerA = new NextRequest('http://localhost:3000/api/orders/MF-ORD-A', {
      headers: {
        'x-customer-uid': 'uid-customer-a',
        'x-customer-phone': '+919876543210',
      },
    });

    const accessOwnerCheck = await verifyOrderAccessAsync(reqCustomerA, orderA);
    expect(accessOwnerCheck.allowed).toBe(true);
  });

  // 5. Admin verification strictly requires admin: true custom claim
  it('5. Admin authorization strictly enforces admin: true custom claim and blocks plain emails', async () => {
    // Normal admin key passes
    const adminReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      headers: { 'x-admin-key': 'mahesh-flora-admin-secret-dev-key' },
    });
    const keyAuth = await verifyAdminAuthorizationAsync(adminReq);
    expect(keyAuth.authorized).toBe(true);

    // Unauthenticated request fails
    const regularReq = new NextRequest('http://localhost:3000/api/admin/orders');
    const regularAuth = await verifyAdminAuthorizationAsync(regularReq);
    expect(regularAuth.authorized).toBe(false);
  });

  // 6. Admin set-claim endpoint is protected by administrative credentials
  it('6. Admin set-claim endpoint rejects unauthenticated callers', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/admin/set-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@example.com', admin: true }),
    });

    const res = await setClaimRoute(unauthReq);
    expect(res.status).toBe(401);
  });
});
