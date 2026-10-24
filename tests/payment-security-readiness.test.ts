import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { _resetDbForTesting, createOrder, getOrderById } from '@/lib/db/store';
import { POST as verifyPaymentRoute } from '@/app/api/payments/verify/route';
import { POST as razorpayWebhookRoute } from '@/app/api/webhooks/razorpay/route';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Order } from '@/types';

const TEST_KEY_SECRET = 'test_razorpay_secret_key_98765';
const TEST_WEBHOOK_SECRET = 'test_webhook_secret_key_12345';

function generatePaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, secret: string = TEST_KEY_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

function generateWebhookSignature(rawBody: string, secret: string = TEST_WEBHOOK_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
}

describe('Payment Gateway Readiness & Security Verification Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetDbForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // -------------------------------------------------------------
  // PART 1: Client Verification Endpoint (/api/payments/verify)
  // -------------------------------------------------------------
  describe('POST /api/payments/verify', () => {
    it('1. Returns 503 Service Unavailable when RAZORPAY_KEY_SECRET is not configured', async () => {
      delete process.env.RAZORPAY_KEY_SECRET;

      const order: Order = {
        id: 'MF-SEC-001',
        customer: { customerName: 'Ravi Teja', phone: '+919876543210', flatNumber: '101', apartmentCommunity: 'PBEL City' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 5000,
        deliveryFeePaise: 0,
        totalPaise: 5000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-SEC-001',
          razorpayPaymentId: 'pay_12345',
          razorpayOrderId: 'order_12345',
          razorpaySignature: 'sig_12345',
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('temporarily unavailable');

      // Order must remain unpaid
      const orderInDb = await getOrderById('MF-SEC-001');
      expect(orderInDb?.paymentStatus).toBe('unpaid');
    });

    it('2. Rejects forged or invalid signature without marking order as failed (prevents denial-of-service)', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-SEC-002',
        customer: { customerName: 'Sita M', phone: '+919876543211', flatNumber: '202', apartmentCommunity: 'My Home Bhooja' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 10000,
        deliveryFeePaise: 0,
        totalPaise: 10000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-SEC-002',
          razorpayPaymentId: 'pay_tampered_001',
          razorpayOrderId: 'order_tampered_001',
          razorpaySignature: '0000000000000000000000000000000000000000000000000000000000000000',
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid payment signature');

      // Crucial: The order must NOT be mutated to 'failed' by an invalid client request
      const orderInDb = await getOrderById('MF-SEC-002');
      expect(orderInDb?.paymentStatus).toBe('unpaid');
    });

    it('3. Rejects payment verification on mismatched gateway order IDs (anti-tampering)', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-SEC-003',
        customer: { customerName: 'Lakshmi G', phone: '+919876543212', flatNumber: '303', apartmentCommunity: 'Rainbow Vistas' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 6000,
        deliveryFeePaise: 0,
        totalPaise: 6000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        razorpayOrderId: 'order_bound_official_999',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      // Client supplies a valid signature for a DIFFERENT razorpay order
      const attackerOrderId = 'order_attacker_111';
      const paymentId = 'pay_real_222';
      const sig = generatePaymentSignature(attackerOrderId, paymentId);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-SEC-003',
          razorpayPaymentId: paymentId,
          razorpayOrderId: attackerOrderId,
          razorpaySignature: sig,
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Payment order does not match this order');

      const orderInDb = await getOrderById('MF-SEC-003');
      expect(orderInDb?.paymentStatus).toBe('unpaid');
    });

    it('4. Successfully verifies valid HMAC-SHA256 signature and transitions order to paid', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const order: Order = {
        id: 'MF-SEC-004',
        customer: { customerName: 'Praveen K', phone: '+919876543213', flatNumber: '404', apartmentCommunity: 'Lanco Hills' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 8000,
        deliveryFeePaise: 0,
        totalPaise: 8000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        razorpayOrderId: 'order_legit_555',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const paymentId = 'pay_legit_777';
      const signature = generatePaymentSignature('order_legit_555', paymentId);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-SEC-004',
          razorpayPaymentId: paymentId,
          razorpayOrderId: 'order_legit_555',
          razorpaySignature: signature,
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const updated = await getOrderById('MF-SEC-004');
      expect(updated?.paymentStatus).toBe('paid');
      expect(updated?.orderStatus).toBe('confirmed');
      expect(updated?.paidAt).toBeDefined();
      expect(updated?.razorpayPaymentId).toBe(paymentId);
      expect(updated?.razorpayOrderId).toBe('order_legit_555');
    });

    it('5. Idempotent verification: already paid order returns success and avoids redundant updates or downgrades', async () => {
      process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

      const paidOrder: Order = {
        id: 'MF-SEC-005',
        customer: { customerName: 'Anita B', phone: '+919876543214', flatNumber: '505', apartmentCommunity: 'Jayabheri' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 5000,
        deliveryFeePaise: 0,
        totalPaise: 5000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'confirmed',
        paymentStatus: 'paid',
        paidAt: '2026-10-24T10:00:00.000Z',
        paymentMethod: 'whatsapp_upi',
        razorpayPaymentId: 'pay_existing_111',
        razorpayOrderId: 'order_existing_111',
        createdAt: '2026-10-24T09:30:00.000Z',
        updatedAt: '2026-10-24T10:00:00.000Z',
      };
      await createOrder(paidOrder);

      // Re-submitting verification for already paid order
      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'MF-SEC-005',
          razorpayPaymentId: 'pay_existing_111',
          razorpayOrderId: 'order_existing_111',
          razorpaySignature: 'any_signature',
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('already marked as paid');

      // Even a failed simulation attempt must NOT downgrade a paid order
      const simReq = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          orderId: 'MF-SEC-005',
          isSimulation: true,
          simulationResult: 'failed',
        }),
      });

      const simRes = await verifyPaymentRoute(simReq);
      expect(simRes.status).toBe(200);
      const postSimOrder = await getOrderById('MF-SEC-005');
      expect(postSimOrder?.paymentStatus).toBe('paid');
    });

    it('6. Blocks payment simulation in production mode (NODE_ENV === "production")', async () => {
      process.env.NODE_ENV = 'production';

      const order: Order = {
        id: 'MF-SEC-006',
        customer: { customerName: 'Dev Check', phone: '+919876543215', flatNumber: '606', apartmentCommunity: 'Aparna Towers' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 4000,
        deliveryFeePaise: 0,
        totalPaise: 4000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const req = new NextRequest('http://localhost:3000/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          orderId: 'MF-SEC-006',
          isSimulation: true,
          simulationResult: 'success',
        }),
      });

      const res = await verifyPaymentRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('disabled in production');

      const orderInDb = await getOrderById('MF-SEC-006');
      expect(orderInDb?.paymentStatus).toBe('unpaid');
    });
  });

  // -------------------------------------------------------------
  // PART 2: Razorpay Webhook Endpoint (/api/webhooks/razorpay)
  // -------------------------------------------------------------
  describe('POST /api/webhooks/razorpay', () => {
    it('1. Returns 503 when RAZORPAY_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'sig_dummy',
        },
        body: rawBody,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('not configured');
    });

    it('2. Returns 400 when x-razorpay-signature header is missing', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing webhook signature');
    });

    it('3. Rejects invalid or forged webhook signature with 400', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_hacker_999',
              order_id: 'order_hacker_999',
              notes: { orderId: 'MF-SEC-WH-001' },
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'bad_forged_hex_signature_abcdef1234567890abcdef1234567890abcdef12',
        },
        body: rawBody,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid webhook signature');
    });

    it('4. Successfully processes payment.captured event and marks order paid', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const order: Order = {
        id: 'MF-SEC-WH-001',
        customer: { customerName: 'Kiran R', phone: '+919876543216', flatNumber: '701', apartmentCommunity: 'Jayabheri' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 7500,
        deliveryFeePaise: 0,
        totalPaise: 7500,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        razorpayOrderId: 'order_rzp_wh_001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_captured_001',
              order_id: 'order_rzp_wh_001',
              amount: 7500,
              currency: 'INR',
              status: 'captured',
              notes: { orderId: 'MF-SEC-WH-001' },
            },
          },
        },
      });

      const sig = generateWebhookSignature(rawPayload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body: rawPayload,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.processedEvent).toBe('payment.captured');

      const updated = await getOrderById('MF-SEC-WH-001');
      expect(updated?.paymentStatus).toBe('paid');
      expect(updated?.orderStatus).toBe('confirmed');
      expect(updated?.paidAt).toBeDefined();
      expect(updated?.razorpayPaymentId).toBe('pay_rzp_captured_001');
    });

    it('5. Idempotent webhook processing: Duplicate payment.captured does not duplicate or corrupt order', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const order: Order = {
        id: 'MF-SEC-WH-002',
        customer: { customerName: 'Sunita P', phone: '+919876543217', flatNumber: '802', apartmentCommunity: 'My Home Bhooja' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 9000,
        deliveryFeePaise: 0,
        totalPaise: 9000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        razorpayOrderId: 'order_rzp_wh_002',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_captured_002',
              order_id: 'order_rzp_wh_002',
              amount: 9000,
              notes: { orderId: 'MF-SEC-WH-002' },
            },
          },
        },
      });

      const sig = generateWebhookSignature(rawPayload);

      // First webhook delivery
      const req1 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: rawPayload,
      });
      const res1 = await razorpayWebhookRoute(req1);
      expect(res1.status).toBe(200);

      const afterFirstDelivery = await getOrderById('MF-SEC-WH-002');
      const paidAtTime = afterFirstDelivery?.paidAt;
      expect(afterFirstDelivery?.paymentStatus).toBe('paid');

      // Duplicate delivery of same event
      const req2 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: rawPayload,
      });
      const res2 = await razorpayWebhookRoute(req2);
      expect(res2.status).toBe(200);

      const afterSecondDelivery = await getOrderById('MF-SEC-WH-002');
      expect(afterSecondDelivery?.paymentStatus).toBe('paid');
      expect(afterSecondDelivery?.paidAt).toBe(paidAtTime);
    });

    it('6. Never lets a late payment.failed webhook event downgrade an already paid order', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      // Order is already paid
      const paidOrder: Order = {
        id: 'MF-SEC-WH-003',
        customer: { customerName: 'Mohan V', phone: '+919876543218', flatNumber: '903', apartmentCommunity: 'Rainbow Vistas' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 4500,
        deliveryFeePaise: 0,
        totalPaise: 4500,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'confirmed',
        paymentStatus: 'paid',
        paidAt: '2026-10-24T11:00:00.000Z',
        paymentMethod: 'whatsapp_upi',
        razorpayPaymentId: 'pay_success_initial',
        razorpayOrderId: 'order_rzp_wh_003',
        createdAt: '2026-10-24T10:30:00.000Z',
        updatedAt: '2026-10-24T11:00:00.000Z',
      };
      await createOrder(paidOrder);

      // Razorpay sends a late payment.failed webhook (e.g. from an earlier abandoned UPI intent)
      const lateFailPayload = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_earlier_attempt',
              order_id: 'order_rzp_wh_003',
              notes: { orderId: 'MF-SEC-WH-003' },
            },
          },
        },
      });

      const sig = generateWebhookSignature(lateFailFailPayload(lateFailPayload));

      function lateFailFailPayload(payloadStr: string) {
        return payloadStr;
      }

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': generateWebhookSignature(lateFailPayload),
        },
        body: lateFailPayload,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);

      // CRITICAL SECURITY ASSERTION: Order MUST remain paid
      const orderInDb = await getOrderById('MF-SEC-WH-003');
      expect(orderInDb?.paymentStatus).toBe('paid');
      expect(orderInDb?.orderStatus).toBe('confirmed');
      expect(orderInDb?.razorpayPaymentId).toBe('pay_success_initial');
    });

    it('7. Safely acknowledges unrelated gateway events (e.g. refund.processed, payment.authorized) without changing order state', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const order: Order = {
        id: 'MF-SEC-WH-004',
        customer: { customerName: 'Geetha M', phone: '+919876543219', flatNumber: '1004', apartmentCommunity: 'PBEL City' },
        items: [],
        orderType: 'one-time',
        subtotalPaise: 3000,
        deliveryFeePaise: 0,
        totalPaise: 3000,
        deliverySchedule: { type: 'one-time' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
        razorpayOrderId: 'order_rzp_wh_004',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createOrder(order);

      const unrelatedPayload = JSON.stringify({
        event: 'payment.authorized',
        payload: {
          payment: {
            entity: {
              id: 'pay_auth_only',
              order_id: 'order_rzp_wh_004',
              notes: { orderId: 'MF-SEC-WH-004' },
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': generateWebhookSignature(unrelatedPayload),
        },
        body: unrelatedPayload,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.ignoredEvent).toBe('payment.authorized');

      // Order must remain untouched (unpaid)
      const orderInDb = await getOrderById('MF-SEC-WH-004');
      expect(orderInDb?.paymentStatus).toBe('unpaid');
    });
  });
});
