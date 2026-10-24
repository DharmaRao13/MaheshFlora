import { PaymentProvider } from './types';
import { RazorpayPaymentProvider } from './providers/razorpay';

export * from './types';
export { RazorpayPaymentProvider } from './providers/razorpay';

const providers: Record<string, PaymentProvider> = {
  razorpay: new RazorpayPaymentProvider(),
};

/**
 * Returns the requested payment provider adapter.
 * Defaults to 'razorpay' as the primary payment gateway.
 */
export function getPaymentProvider(providerId: string = 'razorpay'): PaymentProvider {
  const normalized = (providerId || 'razorpay').toLowerCase().trim();
  const provider = providers[normalized];
  if (!provider) {
    throw new Error(`Unsupported payment provider: "${providerId}". Only "razorpay" is currently configured.`);
  }
  return provider;
}

/**
 * Helper to get the active payment provider identifier from configuration or order.
 */
export function getActivePaymentProviderId(): string {
  return process.env.PAYMENT_PROVIDER?.toLowerCase() || 'razorpay';
}
