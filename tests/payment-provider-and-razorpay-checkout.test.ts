import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { _resetDbForTesting, createOrder, getOrderById } from '@/lib/db/store';
import { POST as createSessionRoute } from '@/app/api/payments/session/route';
import { POST as verifyPaymentRoute } from '@/app/api/payments/verify/route';
import { POST as razorpayWebhookRoute } from '@/app/api/webhooks/razorpay/route';
import { getPaymentProvider } from '@/lib/payments';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Order } from '@/types';

const TEST_KEY_SECRET = 'test_razorpay_secret_key_abcdef123';
const TEST_WEBHOOK_SECRET = 'test_razorpay_webhook_secret_xyz789';

function generatePaymentSignature(orderId: string, paymentId: string, secret: string = TEST_KEY_SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function generateWebhookSignature(rawBody: string, secret: string = TEST_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

describe('Provider-Independent Payment Architecture & Razorpay Checkout Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetDbForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ----------------------------------------------------------------
  // 1. PROVIDER REGISTRY & INTERFACE ABSTRACTION
  // ----------------------------------------------------------------
  describe('Provider Registry', () => {
    it('returns the Razorpay adapter by default', () => {
      const provider = getPaymentProvider('razorpay');
      expect(provider).toBeDefined();
      expect(provider.id).toBe('razorpay');
      expect(typeof provider.createSession).toBe('function');
      expect(typeof provider.verifyPayment).toBe('function');
      expect(typeof provider.verifyWebhook).toBe('function');
    });

    it('throws a descriptive error when an unknown/unsupported provider is requested', () => {
      expect(() => getPaymentProvider('stripe')).toThrow(/Unsupported payment provider: "stripe"/i);
      expect(() => getPaymentProvider('cashfree')).toThrow(/Unsupported payment provider: "cashfree"/i);
    });
  });

  // ----------------------------------------------------------------
  // 2. PAYMENT SESSION CREATION (/api/payments/session)
  // ----------------------------------------------------------------
  describe('POST /api/payments/session', () => {
    it('rejects requests with missing or empty orderId with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await createSessionRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Order ID is required');
    });

    it('rejects unauthorized access when no guest token or customer phone matches with 403', async () => {
      const order: Order = {
        id: 'MF-SESSION-001',
        accessToken: 'secret_token_12345',
        customer: { customerName: 'Suresh V', phone: '+919876543210', flatNumber: '101', apartmentCommunity: 'PBEL City' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 5000,
        deliveryFeePaise: 0,
        totalPaise: 5000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      // Caller sends no credentials
      const req = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'MF-SESSION-001' }),
      });

      const res = await createSessionRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects online payment session creation for Cash on Delivery (COD) orders with 400', async () => {
      const order: Order = {
        id: 'MF-SESSION-COD',
        accessToken: 'cod_token_123',
        customer: { customerName: 'Kiran K', phone: '+919876543211', flatNumber: '201', apartmentCommunity: 'Lanco Hills' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 6000,
        deliveryFeePaise: 0,
        totalPaise: 6000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'payment_due',
        paymentMethod: 'cod',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-order-token': 'cod_token_123',
        },
        body: JSON.stringify({ orderId: 'MF-SESSION-COD' }),
      });

      const res = await createSessionRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cash on Delivery');
    });

    it('returns 503 when gateway credentials are not configured (no silent/automatic mock payments)', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.PAYMENT_TEST_MOCK;

      const order: Order = {
        id: 'MF-SESSION-NOCRED',
        accessToken: 'token_nocred_456',
        customer: { customerName: 'Anil P', phone: '+919876543212', flatNumber: '301', apartmentCommunity: 'Rainbow Vistas' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 8000,
        deliveryFeePaise: 0,
        totalPaise: 8000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-order-token': 'token_nocred_456',
        },
        body: JSON.stringify({ orderId: 'MF-SESSION-NOCRED' }),
      });

      const res = await createSessionRoute(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('temporarily unavailable');
    });

    it('creates and binds gateway session using server-trusted order total, ignoring client amount tampering', async () => {
      process.env.PAYMENT_TEST_MOCK = 'true';
      process.env.RAZORPAY_KEY_ID = 'rzp_test_key_123';
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-SESSION-TAMPER',
        accessToken: 'token_tamper_789',
        customer: { customerName: 'Deepa R', phone: '+919876543213', flatNumber: '401', apartmentCommunity: 'Jayabheri' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 12500, // ₹125.00
        deliveryFeePaise: 2500, // ₹25.00
        totalPaise: 15000, // ₹150.00
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      // Malicious client attempts to pass amount: 100 paise (₹1.00)
      const req = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-order-token': 'token_tamper_789',
        },
        body: JSON.stringify({
          orderId: 'MF-SESSION-TAMPER',
          amount: 100, // Attempted tamper!
          amountPaise: 100,
        }),
      });

      const res = await createSessionRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Server MUST ignore client amount and enforce trusted order total (15000 paise)
      expect(data.session.amountPaise).toBe(15000);
      expect(data.session.currency).toBe('INR');
      expect(data.session.provider).toBe('razorpay');
      expect(data.session.providerOrderId).toBeDefined();

      // Check that provider order ID was securely bound to internal order in store
      const orderInDb = await getOrderById('MF-SESSION-TAMPER');
      expect(orderInDb?.providerOrderId).toBe(data.session.providerOrderId);
      expect(orderInDb?.razorpayOrderId).toBe(data.session.providerOrderId);
      expect(orderInDb?.paymentProvider).toBe('razorpay');
    });

    it('concurrency & duplicate prevention: reuses existing active gateway order without creating duplicate orders', async () => {
      process.env.PAYMENT_TEST_MOCK = 'true';
      process.env.RAZORPAY_KEY_ID = 'rzp_test_key_123';
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-SESSION-REUSE',
        accessToken: 'token_reuse_999',
        customer: { customerName: 'Ramesh N', phone: '+919876543214', flatNumber: '501', apartmentCommunity: 'My Home Bhooja' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 5000,
        deliveryFeePaise: 0,
        totalPaise: 5000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      // First call: creates session
      const req1 = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-order-token': 'token_reuse_999' },
        body: JSON.stringify({ orderId: 'MF-SESSION-REUSE' }),
      });
      const res1 = await createSessionRoute(req1);
      const data1 = await res1.json();
      const firstGatewayOrderId = data1.session.providerOrderId;
      expect(firstGatewayOrderId).toBeDefined();

      // Second call: must safely reuse the existing gateway order ID
      const req2 = new NextRequest('http://localhost:3000/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-order-token': 'token_reuse_999' },
        body: JSON.stringify({ orderId: 'MF-SESSION-REUSE' }),
      });
      const res2 = await createSessionRoute(req2);
      const data2 = await res2.json();
      expect(data2.session.providerOrderId).toBe(firstGatewayOrderId);
      expect(data2.session.reused).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 3. PAYMENT VERIFICATION VIA PROVIDER ADAPTER (/api/payments/verify)
  // ----------------------------------------------------------------
  describe('POST /api/payments/verify with Provider Layer', () => {
    it('verifies checkout callback and transitions order to paid with provider identifiers', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-VERIFY-OK-01',
        customer: { customerName: 'Pooja S', phone: '+919876543215', flatNumber: '601', apartmentCommunity: 'Aparna Serene' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 9500,
        deliveryFeePaise: 0,
        totalPaise: 9500,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        paymentProvider: 'razorpay',
        providerOrderId: 'order_bound_rzp_777',
        razorpayOrderId: 'order_bound_rzp_777',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const paymentId = 'pay_confirmed_888';
      const validSig = generatePaymentSignature('order_bound_rzp_777', paymentId);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-VERIFY-OK-01',
          razorpayPaymentId: paymentId,
          razorpayOrderId: 'order_bound_rzp_777',
          razorpaySignature: validSig,
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const updated = await getOrderById('MF-VERIFY-OK-01');
      expect(updated?.paymentStatus).toBe('paid');
      expect(updated?.orderStatus).toBe('confirmed');
      expect(updated?.paidAt).toBeDefined();
      expect(updated?.paymentProvider).toBe('razorpay');
      expect(updated?.providerPaymentId).toBe(paymentId);
      expect(updated?.providerOrderId).toBe('order_bound_rzp_777');
      expect(updated?.razorpayPaymentId).toBe(paymentId);
    });

    it('rejects invalid signature without mutating order status to failed', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-VERIFY-BADSIG',
        customer: { customerName: 'Sunil G', phone: '+919876543216', flatNumber: '701', apartmentCommunity: 'PBEL City' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 4000,
        deliveryFeePaise: 0,
        totalPaise: 4000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        providerOrderId: 'order_correct_111',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-VERIFY-BADSIG',
          razorpayPaymentId: 'pay_bad_222',
          razorpayOrderId: 'order_correct_111',
          razorpaySignature: 'bad_signature_0000000000000000000000000000000000000000000000000000000000000000',
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid payment signature');

      const orderInDb = await getOrderById('MF-VERIFY-BADSIG');
      expect(orderInDb?.paymentStatus).toBe('unpaid'); // Must remain unpaid!
    });
  });

  // ----------------------------------------------------------------
  // 4. WEBHOOKS VIA PROVIDER ADAPTER (/api/webhooks/razorpay)
  // ----------------------------------------------------------------
  describe('POST /api/webhooks/razorpay with Provider Layer', () => {
    it('processes payment.captured event via provider adapter idempotently', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const order: Order = {
        id: 'MF-WH-ADAPTER-01',
        customer: { customerName: 'Lakshmi V', phone: '+919876543217', flatNumber: '801', apartmentCommunity: 'Lanco Hills' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 6500,
        deliveryFeePaise: 0,
        totalPaise: 6500,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'razorpay',
        providerOrderId: 'order_wh_adapter_01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_adapter_captured_999',
              order_id: 'order_wh_adapter_01',
              amount: 6500,
              currency: 'INR',
              notes: { orderId: 'MF-WH-ADAPTER-01' },
            },
          },
        },
      });

      const sig = generateWebhookSignature(rawPayload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: rawPayload,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const updated = await getOrderById('MF-WH-ADAPTER-01');
      expect(updated?.paymentStatus).toBe('paid');
      expect(updated?.orderStatus).toBe('confirmed');
      expect(updated?.providerPaymentId).toBe('pay_adapter_captured_999');
      expect(updated?.razorpayPaymentId).toBe('pay_adapter_captured_999');

      // Duplicate delivery
      const dupReq = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: rawPayload,
      });
      const dupRes = await razorpayWebhookRoute(dupReq);
      expect(dupRes.status).toBe(200);
      const afterDup = await getOrderById('MF-WH-ADAPTER-01');
      expect(afterDup?.paymentStatus).toBe('paid');
    });

    it('never downgrades an already paid order when payment.failed arrives late', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const paidOrder: Order = {
        id: 'MF-WH-NODOWNGRADE',
        customer: { customerName: 'Arun M', phone: '+919876543218', flatNumber: '901', apartmentCommunity: 'PBEL City' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 5000,
        deliveryFeePaise: 0,
        totalPaise: 5000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'confirmed',
        paymentStatus: 'paid',
        paidAt: '2026-10-24T12:00:00.000Z',
        paymentMethod: 'razorpay',
        providerOrderId: 'order_late_fail_01',
        providerPaymentId: 'pay_success_111',
        createdAt: '2026-10-24T11:30:00.000Z',
        updatedAt: '2026-10-24T12:00:00.000Z',
      };
      await createOrder(paidOrder);

      const lateFailPayload = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_222',
              order_id: 'order_late_fail_01',
              notes: { orderId: 'MF-WH-NODOWNGRADE' },
            },
          },
        },
      });

      const sig = generateWebhookSignature(lateFailPayload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: lateFailPayload,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);

      // Order must strictly remain paid
      const orderInDb = await getOrderById('MF-WH-NODOWNGRADE');
      expect(orderInDb?.paymentStatus).toBe('paid');
      expect(orderInDb?.providerPaymentId).toBe('pay_success_111');
    });
  });
});
