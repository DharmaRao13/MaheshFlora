import { describe, it, expect } from 'vitest';
import { buildUpiPaymentUri, formatINR, TEST_PAYMENT_AMOUNT_PAISE } from '@/lib/config';
import { generateWhatsAppOrderLink, calculateOrderTotals } from '@/lib/business';
import { Order, Product, BusinessSettings } from '@/types';

describe('SAFE ₹1 TEST PAYMENT MODE SUITE', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod-jasmine',
      name: 'Fresh Madurai Jasmine',
      category: 'daily-puja',
      pricePaise: 6000, // ₹60
      unit: 'per 100g',
      imageUrl: '',
      inStock: true,
    },
    {
      id: 'prod-marigold',
      name: 'Golden Marigold',
      category: 'daily-puja',
      pricePaise: 4000, // ₹40
      unit: 'per 250g',
      imageUrl: '',
      inStock: true,
    },
  ];

  const sampleSettings: BusinessSettings = {
    businessName: 'Mahesh Flora',
    tagline: 'Fresh Flowers',
    businessPhone: '+918341401793',
    whatsappNumber: '918341401793',
    upiId: 'Q062496934@ybl',
    isPaymentTestMode: true,
    addressText: 'Hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500032',
    openingHoursText: '5:30 AM',
    deliveryCutoffHour: 20,
    standardDeliveryFeePaise: 3000,
    freeDeliveryThresholdPaise: 29900,
    minOrderAmountPaise: 9900,
    timeSlots: {
      morning: { label: 'Morning', time: '6:00 AM' },
      evening: { label: 'Evening', time: '5:00 PM' },
    },
    serviceableCommunities: [],
  };

  const sampleOrder: Order = {
    id: 'MF-TEST-999',
    customer: {
      customerName: 'Anil Kumar',
      phone: '+918341401793',
      apartmentCommunity: 'My Home Bhooja',
      buildingTower: 'Tower 2',
      flatNumber: 'Flat 1201',
    },
    items: [
      {
        productId: 'prod-jasmine',
        name: 'Fresh Madurai Jasmine',
        pricePaise: 6000,
        unit: 'per 100g',
        quantity: 2,
        itemTotalPaise: 12000,
      },
    ],
    orderType: 'one-time',
    subtotalPaise: 12000,
    deliveryFeePaise: 3000,
    totalPaise: 15000, // ₹150.00 original total
    testPaymentPaise: 100, // ₹1.00 test amount
    deliverySchedule: {
      type: 'one-time',
      date: '2026-10-25',
      timeSlot: 'morning',
    },
    orderStatus: 'pending_confirmation',
    paymentStatus: 'unpaid',
    paymentMethod: 'whatsapp_upi',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('generates consistent ₹1.00 amount in Universal UPI URI during test mode', () => {
    const upiUri = buildUpiPaymentUri('Q062496934@ybl', TEST_PAYMENT_AMOUNT_PAISE, sampleOrder.id, 'Mahesh Flora', 'upi');
    expect(upiUri).toContain('upi://pay');
    expect(upiUri).toContain('pa=Q062496934%40ybl');
    expect(upiUri).toContain('am=1.00');
    expect(upiUri).toContain('tn=Order%20MF-TEST-999');
    expect(upiUri).toContain('cu=INR');
  });

  it('generates consistent ₹1.00 in dedicated PhonePe, Google Pay, and Paytm intents', () => {
    const phonepeUri = buildUpiPaymentUri('Q062496934@ybl', TEST_PAYMENT_AMOUNT_PAISE, sampleOrder.id, 'Mahesh Flora', 'phonepe');
    const gpayUri = buildUpiPaymentUri('Q062496934@ybl', TEST_PAYMENT_AMOUNT_PAISE, sampleOrder.id, 'Mahesh Flora', 'tez');
    const paytmUri = buildUpiPaymentUri('Q062496934@ybl', TEST_PAYMENT_AMOUNT_PAISE, sampleOrder.id, 'Mahesh Flora', 'paytmmp');

    expect(phonepeUri).toContain('phonepe://pay');
    expect(phonepeUri).toContain('am=1.00');
    expect(phonepeUri).toContain('pa=Q062496934%40ybl');

    expect(gpayUri).toContain('tez://upi/pay');
    expect(gpayUri).toContain('am=1.00');
    expect(gpayUri).toContain('pa=Q062496934%40ybl');

    expect(paytmUri).toContain('paytmmp://pay');
    expect(paytmUri).toContain('am=1.00');
    expect(paytmUri).toContain('pa=Q062496934%40ybl');
  });

  it('keeps normal product pricing, cart subtotal, and original total completely unchanged', () => {
    const cart = [
      { productId: 'prod-jasmine', quantity: 2 },
      { productId: 'prod-marigold', quantity: 1 },
    ];
    const calc = calculateOrderTotals(cart, sampleProducts, sampleSettings);

    // 2 * 60 + 1 * 40 = 160 + 30 delivery = 190 (19000 paise)
    expect(calc.subtotalPaise).toBe(16000);
    expect(calc.deliveryFeePaise).toBe(3000);
    expect(calc.totalPaise).toBe(19000);

    // Total must not be silently replaced by ₹1 in calculation
    expect(calc.totalPaise).not.toBe(100);
    expect(formatINR(calc.totalPaise)).toBe('₹190');
  });

  it('uses full original total when test mode is disabled', () => {
    const normalUri = buildUpiPaymentUri('Q062496934@ybl', sampleOrder.totalPaise, sampleOrder.id, 'Mahesh Flora', 'upi');
    expect(normalUri).toContain('am=150.00');
    expect(normalUri).not.toContain('am=1.00');
  });

  it('displays original total and test payment notice in WhatsApp message without losing original details', () => {
    const link = generateWhatsAppOrderLink(sampleOrder, '918341401793', 'Q062496934@ybl', true);
    const decoded = decodeURIComponent(link.split('text=')[1]);

    expect(decoded).toContain('Order ID: MF-TEST-999');
    expect(decoded).toContain('Total: ₹150');
    expect(decoded).toContain('UPI ID: Q062496934@ybl');
    expect(decoded).toContain('[TEST PAYMENT MODE: ₹1.00 Test UPI Payment]');
    expect(decoded).toContain('Please help me complete the payment.');
  });
});
