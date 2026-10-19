import { Product, OrderItem, BusinessSettings, Order } from '@/types';
import { formatINR } from './config';

/**
 * Validates Indian mobile numbers (10 digits starting with 6, 7, 8, 9).
 * Accepts formats: 9876543210, +919876543210, 09876543210, +91 98765 43210
 */
export function validateIndianPhone(input: string): { valid: boolean; formatted: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, formatted: '', error: 'Mobile number is required' };
  }

  // Remove spaces, hyphens, parentheses
  const cleaned = input.replace(/[\s\-()]/g, '');

  let digits = cleaned;
  if (cleaned.startsWith('+91')) {
    digits = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    digits = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    digits = cleaned.slice(1);
  }

  if (!/^\d{10}$/.test(digits)) {
    return {
      valid: false,
      formatted: input,
      error: 'Please enter a valid 10-digit Indian mobile number',
    };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      valid: false,
      formatted: input,
      error: 'Indian mobile numbers must start with 6, 7, 8, or 9',
    };
  }

  return {
    valid: true,
    formatted: `+91${digits}`,
  };
}

/**
 * Validates and calculates order totals strictly on the server
 * to prevent browser price manipulation.
 */
export function calculateOrderTotals(
  items: { productId: string; quantity: number }[],
  availableProducts: Product[],
  settings: BusinessSettings
): {
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  orderItems: OrderItem[];
  error?: string;
} {
  if (!items || items.length === 0) {
    return {
      subtotalPaise: 0,
      deliveryFeePaise: 0,
      totalPaise: 0,
      orderItems: [],
      error: 'Cart is empty. Please add items to proceed.',
    };
  }

  const productMap = new Map(availableProducts.map((p) => [p.id, p]));
  const orderItems: OrderItem[] = [];
  let subtotalPaise = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return {
        subtotalPaise: 0,
        deliveryFeePaise: 0,
        totalPaise: 0,
        orderItems: [],
        error: `Product with ID ${item.productId} was not found.`,
      };
    }

    if (!product.inStock) {
      return {
        subtotalPaise: 0,
        deliveryFeePaise: 0,
        totalPaise: 0,
        orderItems: [],
        error: `${product.name} is currently out of stock.`,
      };
    }

    const qty = Math.max(1, Math.floor(item.quantity));
    const itemTotalPaise = product.pricePaise * qty;
    subtotalPaise += itemTotalPaise;

    orderItems.push({
      productId: product.id,
      name: product.name,
      pricePaise: product.pricePaise,
      unit: product.unit,
      quantity: qty,
      itemTotalPaise,
    });
  }

  // Delivery fee logic: Free above threshold (e.g. ₹299), else standard fee (e.g. ₹30)
  const deliveryFeePaise =
    subtotalPaise >= settings.freeDeliveryThresholdPaise ? 0 : settings.standardDeliveryFeePaise;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  return {
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
    orderItems,
  };
}

/**
 * Check delivery cutoff time for orders.
 * Orders placed after cutoffHour (e.g. 8:00 PM) cannot select next morning delivery.
 */
export function checkDeliveryCutoff(
  requestedDateStr: string,
  timeSlot: 'morning' | 'evening',
  cutoffHour: number = 20
): { allowed: boolean; message?: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Disallow past dates
  if (requestedDateStr < todayStr) {
    return {
      allowed: false,
      message: 'Delivery date cannot be in the past.',
    };
  }

  // If ordering for tomorrow morning and current time is past cutoff hour
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (requestedDateStr === tomorrowStr && timeSlot === 'morning' && now.getHours() >= cutoffHour) {
    return {
      allowed: false,
      message: `Cut-off time of ${cutoffHour % 12 || 12}:00 PM for tomorrow morning's fresh harvest delivery has passed. Please choose evening or a future date.`,
    };
  }

  // Same day morning cutoff (cannot order today morning if past 7 AM)
  if (requestedDateStr === todayStr && timeSlot === 'morning' && now.getHours() >= 7) {
    return {
      allowed: false,
      message: 'Morning delivery slot for today is closed. Please select evening or tomorrow.',
    };
  }

  // Same day evening cutoff (cannot order today evening if past 4 PM)
  if (requestedDateStr === todayStr && timeSlot === 'evening' && now.getHours() >= 16) {
    return {
      allowed: false,
      message: 'Evening delivery slot for today is closed. Please select tomorrow.',
    };
  }

  return { allowed: true };
}

/**
 * Builds standard WhatsApp click-to-chat link with prefilled URL-encoded message.
 */
export function generateWhatsAppOrderLink(
  order: Order,
  whatsappNumber: string,
  upiId?: string,
  isTestPaymentMode: boolean = false
): string {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const itemsSummary = order.items
    .map((item) => `${item.name} (${item.quantity} ${item.unit})`)
    .join(', ');

  const dateText = order.deliverySchedule.date || 'Scheduled Subscription';
  const slotText =
    order.deliverySchedule.timeSlot === 'morning'
      ? 'Morning Puja Slot (6:00 AM – 8:30 AM)'
      : 'Evening Sandhya Slot (5:00 PM – 7:30 PM)';

  const isCod = order.paymentMethod?.toLowerCase() === 'cod';

  const lines = [
    'Hello Mahesh Flora!',
    '',
    'I would like to confirm my flower order.',
    '',
    `Order ID: ${order.id}`,
    `Flowers: ${itemsSummary}`,
    `Delivery date: ${dateText}`,
    `Delivery slot: ${slotText}`,
    `Delivery address: ${order.customer.flatNumber}, ${order.customer.buildingTower}, ${order.customer.apartmentCommunity}`,
    `Total: ${formatINR(order.totalPaise)}`,
    ...(isCod
      ? ['Payment Method: Cash on Delivery (COD)', 'Pay cash when your flowers are delivered.']
      : [
          'Payment Method: Online UPI',
          ...(upiId ? [`UPI ID: ${upiId}`] : []),
          ...(isTestPaymentMode ? ['[TEST PAYMENT MODE: ₹1.00 Test UPI Payment]'] : []),
        ]),
    '',
    isCod ? 'Please confirm my delivery.' : 'Please help me complete the payment.',
  ];

  const fullMessage = lines.join('\n');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(fullMessage)}`;
}

/**
 * Check if a subscription is scheduled to deliver on a specific date.
 */
export function isSubscriptionDeliveringOnDate(
  dateStr: string,
  daysOfWeek: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[],
  skippedDates: string[] = [],
  status: string = 'active'
): boolean {
  if (status !== 'active') return false;
  if (skippedDates.includes(dateStr)) return false;

  const date = new Date(dateStr + 'T00:00:00');
  const dayNames: ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')[] = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  ];
  const currentDay = dayNames[date.getDay()];

  return daysOfWeek.includes(currentDay as any);
}

/**
 * Checks whether an order can be cancelled by the customer according to business rules.
 * Cancellation is permitted only when the order is pending confirmation or confirmed,
 * before preparation begins.
 */
export function canCancelOrder(order: Order): { allowed: boolean; reason?: string } {
  if (order.orderStatus === 'cancelled') {
    return { allowed: false, reason: 'This order has already been cancelled.' };
  }
  if (order.orderStatus === 'delivered') {
    return { allowed: false, reason: 'Delivered orders cannot be cancelled.' };
  }
  if (order.orderStatus === 'out_for_delivery') {
    return { allowed: false, reason: 'The order is already out for delivery and cannot be cancelled.' };
  }
  if (order.orderStatus === 'preparing') {
    return { allowed: false, reason: 'Flowers are already being packed for morning delivery. Cancellation is no longer permitted.' };
  }
  return { allowed: true };
}

/**
 * Validates Indian postal PIN codes (6 digits, first digit 1-9).
 */
export function validatePincode(pincode: string): { valid: boolean; formatted: string; error?: string } {
  if (!pincode || typeof pincode !== 'string') {
    return { valid: false, formatted: '', error: 'PIN code is required' };
  }

  const cleaned = pincode.trim().replace(/\s+/g, '');
  if (!/^[1-9]\d{5}$/.test(cleaned)) {
    return {
      valid: false,
      formatted: cleaned,
      error: 'Please enter a valid 6-digit Indian PIN code (e.g., 560001)',
    };
  }

  return { valid: true, formatted: cleaned };
}

/**
 * Masks an Indian phone number for privacy display (e.g. +91 98765 •••••).
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const val = validateIndianPhone(phone);
  if (!val.valid) return phone;
  // val.formatted is '+919876543210'
  const digits = val.formatted.replace('+91', '');
  return `+91 ${digits.slice(0, 5)} •••••`;
}

/**
 * Validates saved delivery address fields.
 */
export function validateSavedAddress(input: Record<string, any>): {
  valid: boolean;
  sanitized?: Record<string, any>;
  error?: string;
} {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Address payload is required' };
  }

  const recipientName = typeof input.recipientName === 'string' ? input.recipientName.trim() : '';
  if (!recipientName || recipientName.length < 2) {
    return { valid: false, error: 'Recipient name is required (min 2 characters)' };
  }

  const phoneRes = validateIndianPhone(input.phone || '');
  if (!phoneRes.valid) {
    return { valid: false, error: phoneRes.error || 'Valid phone number is required' };
  }

  let alternatePhone: string | undefined = undefined;
  if (input.alternatePhone && typeof input.alternatePhone === 'string' && input.alternatePhone.trim()) {
    const altRes = validateIndianPhone(input.alternatePhone);
    if (!altRes.valid) {
      return { valid: false, error: `Alternate phone: ${altRes.error}` };
    }
    alternatePhone = altRes.formatted;
  }

  const flatNumber = typeof input.flatNumber === 'string' ? input.flatNumber.trim() : '';
  if (!flatNumber) {
    return { valid: false, error: 'House / Flat number is required' };
  }

  const locality = typeof input.locality === 'string' ? input.locality.trim() : (typeof input.apartmentCommunity === 'string' ? input.apartmentCommunity.trim() : '');
  if (!locality) {
    return { valid: false, error: 'Street / Locality or Apartment name is required' };
  }

  const pincodeRes = validatePincode(input.pincode || '');
  if (!pincodeRes.valid) {
    return { valid: false, error: pincodeRes.error || 'Valid 6-digit PIN code is required' };
  }

  const city = (typeof input.city === 'string' && input.city.trim()) ? input.city.trim() : 'Bengaluru';
  const state = (typeof input.state === 'string' && input.state.trim()) ? input.state.trim() : 'Karnataka';
  const street = typeof input.street === 'string' ? input.street.trim() : undefined;
  const landmark = typeof input.landmark === 'string' ? input.landmark.trim() : undefined;
  const apartmentCommunity = typeof input.apartmentCommunity === 'string' ? input.apartmentCommunity.trim() : undefined;
  const deliveryInstructions = typeof input.deliveryInstructions === 'string' ? input.deliveryInstructions.trim() : undefined;
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim() : 'Home';
  const isDefault = Boolean(input.isDefault);

  return {
    valid: true,
    sanitized: {
      recipientName,
      phone: phoneRes.formatted,
      alternatePhone,
      flatNumber,
      street,
      locality,
      apartmentCommunity,
      landmark,
      city,
      state,
      pincode: pincodeRes.formatted,
      deliveryInstructions,
      label,
      isDefault,
    },
  };
}

