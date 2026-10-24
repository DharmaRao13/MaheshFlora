import { Order } from '@/types';

export interface PaymentSessionRequest {
  order: Order;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  isTestMode?: boolean;
}

export interface PaymentSessionResponse {
  provider: string; // 'razorpay'
  providerOrderId: string; // Gateway order reference ID
  amountPaise: number; // Server-validated amount in integer paise
  currency: 'INR';
  keyId?: string; // Public client key ID
  orderId: string; // Internal order ID
}

export interface PaymentVerificationRequest {
  order: Order;
  params: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  };
}

export interface PaymentVerificationResponse {
  success: boolean;
  provider: string;
  providerPaymentId: string;
  providerOrderId: string;
  error?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: string;
  provider: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  internalOrderId?: string;
  status?: 'captured' | 'failed' | 'ignored';
  error?: string;
}

export interface PaymentProvider {
  readonly id: string;
  createSession(req: PaymentSessionRequest): Promise<PaymentSessionResponse>;
  verifyPayment(req: PaymentVerificationRequest): Promise<PaymentVerificationResponse>;
  verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerificationResult>;
}
