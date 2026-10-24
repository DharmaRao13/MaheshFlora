import crypto from 'crypto';
import {
  PaymentProvider,
  PaymentSessionRequest,
  PaymentSessionResponse,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  WebhookVerificationResult,
} from '../types';

function timingSafeSignaturesMatch(expectedHex: string, receivedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(receivedHex) || receivedHex.length !== expectedHex.length) {
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly id = 'razorpay';

  /**
   * Creates a server-side gateway order for the specified internal order.
   * Derives amount and currency strictly from server-trusted data.
   */
  async createSession(req: PaymentSessionRequest): Promise<PaymentSessionResponse> {
    const { order, customer } = req;
    const isProduction = process.env.NODE_ENV === 'production';
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Determine authoritative server-controlled payable amount
    const isTestMode = !isProduction && Boolean(req.isTestMode || order.testPaymentPaise);
    const amountPaise = isTestMode ? 100 : order.totalPaise;

    // Check credential availability
    const isExplicitTestMock = !isProduction && process.env.PAYMENT_TEST_MOCK === 'true';

    if ((!keyId || !keySecret) && !isExplicitTestMock) {
      throw new Error(
        'Online payment gateway credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured on the server.'
      );
    }

    // 1. If explicit local unit test mock mode is enabled without live API keys
    if (isExplicitTestMock && (!keyId || !keySecret)) {
      const mockOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        provider: this.id,
        providerOrderId: mockOrderId,
        amountPaise,
        currency: 'INR',
        keyId: 'rzp_test_mock_key',
        orderId: order.id,
      };
    }

    // 2. Real Razorpay Orders API call
    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const apiRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: order.id,
          notes: {
            orderId: order.id,
            customerPhone: customer.phone,
          },
        }),
      });

      if (!apiRes.ok) {
        const errorData = await apiRes.json().catch(() => ({}));
        const detail = errorData?.error?.description || `HTTP ${apiRes.status}`;
        throw new Error(`Razorpay order creation failed: ${detail}`);
      }

      const data = await apiRes.json();
      return {
        provider: this.id,
        providerOrderId: data.id,
        amountPaise,
        currency: 'INR',
        keyId: keyId!,
        orderId: order.id,
      };
    } catch (err: any) {
      // In local tests where outbound internet access to Razorpay is not present
      if (isExplicitTestMock) {
        return {
          provider: this.id,
          providerOrderId: `order_test_${Date.now()}`,
          amountPaise,
          currency: 'INR',
          keyId: keyId || 'rzp_test_mock_key',
          orderId: order.id,
        };
      }
      throw err;
    }
  }

  /**
   * Verifies the checkout HMAC signature and validates payment integrity against trusted server order data.
   */
  async verifyPayment(req: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    const { order, params } = req;
    const { providerOrderId, providerPaymentId, signature } = params;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return {
        success: false,
        provider: this.id,
        providerOrderId,
        providerPaymentId,
        error: 'Payment verification secret (RAZORPAY_KEY_SECRET) is not configured.',
      };
    }

    if (!providerOrderId || !providerPaymentId || !signature) {
      return {
        success: false,
        provider: this.id,
        providerOrderId,
        providerPaymentId,
        error: 'Missing required payment verification parameters.',
      };
    }

    // 1. Anti-tampering check: verify gateway order matches the internal order binding
    const boundGatewayOrderId = order.providerOrderId || order.razorpayOrderId;
    if (boundGatewayOrderId && boundGatewayOrderId !== providerOrderId) {
      return {
        success: false,
        provider: this.id,
        providerOrderId,
        providerPaymentId,
        error: 'Payment order does not match this order.',
      };
    }

    // 2. Cryptographic signature check: timing-safe HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    if (!timingSafeSignaturesMatch(expectedSignature, signature)) {
      return {
        success: false,
        provider: this.id,
        providerOrderId,
        providerPaymentId,
        error: 'Invalid payment signature. Verification failed.',
      };
    }

    // 3. Verify real gateway state if keys are configured and gateway is accessible
    const keyId = process.env.RAZORPAY_KEY_ID;
    const isTestMock = process.env.PAYMENT_TEST_MOCK === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    const expectedAmountPaise = (!isProduction && order.testPaymentPaise) ? 100 : order.totalPaise;

    if (keyId && keySecret && !isTestMock) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const apiRes = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}`, {
          headers: { Authorization: authHeader },
        });

        if (apiRes.ok) {
          const paymentData = await apiRes.json();
          if (paymentData.order_id && paymentData.order_id !== providerOrderId) {
            return {
              success: false,
              provider: this.id,
              providerOrderId,
              providerPaymentId,
              error: 'Gateway payment record order ID does not match checkout order ID.',
            };
          }
          if (typeof paymentData.amount === 'number' && paymentData.amount !== expectedAmountPaise) {
            return {
              success: false,
              provider: this.id,
              providerOrderId,
              providerPaymentId,
              error: `Gateway payment amount (₹${(paymentData.amount / 100).toFixed(2)}) does not match order total (₹${(expectedAmountPaise / 100).toFixed(2)}).`,
            };
          }
          if (paymentData.currency && paymentData.currency.toUpperCase() !== 'INR') {
            return {
              success: false,
              provider: this.id,
              providerOrderId,
              providerPaymentId,
              error: `Invalid gateway payment currency ${paymentData.currency}. Expected INR.`,
            };
          }
          if (paymentData.status && !['captured', 'authorized'].includes(paymentData.status)) {
            return {
              success: false,
              provider: this.id,
              providerOrderId,
              providerPaymentId,
              error: `Payment is not confirmed on gateway (status: ${paymentData.status}).`,
            };
          }
        }
      } catch {
        // If outbound network check fails in offline/test environment, signature verification stands
      }
    }

    return {
      success: true,
      provider: this.id,
      providerOrderId,
      providerPaymentId,
    };
  }

  /**
   * Verifies raw-body webhook signature and parses gateway events idempotently.
   */
  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerificationResult> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return {
        isValid: false,
        provider: this.id,
        error: 'Webhook endpoint is not configured (missing RAZORPAY_WEBHOOK_SECRET).',
      };
    }

    if (!signature) {
      return {
        isValid: false,
        provider: this.id,
        error: 'Missing webhook signature header.',
      };
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeSignaturesMatch(expectedSignature, signature)) {
      return {
        isValid: false,
        provider: this.id,
        error: 'Invalid webhook signature.',
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        isValid: false,
        provider: this.id,
        error: 'Invalid webhook JSON payload.',
      };
    }

    const event = parsed?.event;
    const paymentEntity = parsed?.payload?.payment?.entity;

    if (!paymentEntity || !['payment.captured', 'order.paid', 'payment.failed'].includes(event)) {
      return {
        isValid: true,
        event,
        provider: this.id,
        status: 'ignored',
      };
    }

    const internalOrderId = paymentEntity.notes?.orderId;
    const providerOrderId = paymentEntity.order_id;
    const providerPaymentId = paymentEntity.id;

    if (!internalOrderId && !providerOrderId) {
      return {
        isValid: false,
        event,
        provider: this.id,
        error: 'Webhook event has no order reference.',
      };
    }

    return {
      isValid: true,
      event,
      provider: this.id,
      providerOrderId,
      providerPaymentId,
      internalOrderId,
      status: event === 'payment.failed' ? 'failed' : 'captured',
    };
  }
}
