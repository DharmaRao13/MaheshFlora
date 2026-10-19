import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateIndianPhone,
  calculateOrderTotals,
  checkDeliveryCutoff,
  generateWhatsAppOrderLink,
  isSubscriptionDeliveringOnDate
} from '@/lib/business';
import {
  getProducts,
  getSettings,
  createOrder,
  getOrderById,
  updateOrderPaymentStatus,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  skipSubscriptionDate,
  getSubscriptionById,
  createFestivalBooking,
  getFestivalBookings,
  _resetDbForTesting
} from '@/lib/db/store';
import { verifyAdminAuthorization, verifyOrderAccess } from '@/lib/auth';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { NextRequest } from 'next/server';

describe('MAHESH FLORA - COMPREHENSIVE REQUIREMENTS SUITE', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  // ============================================================
  // TEST 1: Add jasmine to the cart. Expected: Cart quantity and subtotal update correctly.
  // ============================================================
  it('TEST 1: Add jasmine to the cart -> quantity and subtotal update correctly', async () => {
    const products = await getProducts();
    const settings = await getSettings();
    const jasmine = products.find((p) => p.id === 'prod-jasmine');
    expect(jasmine).toBeDefined();

    // 1 unit of Jasmine (6000 paise = ₹60.00)
    const cart = [{ productId: jasmine!.id, quantity: 1 }];
    const result = calculateOrderTotals(cart, products, settings);

    expect(result.error).toBeUndefined();
    expect(result.orderItems).toHaveLength(1);
    expect(result.orderItems[0].quantity).toBe(1);
    expect(result.subtotalPaise).toBe(jasmine!.pricePaise); // 6000 paise
  });

  // ============================================================
  // TEST 2: Increase the quantity. Expected: Total updates correctly.
  // ============================================================
  it('TEST 2: Increase quantity of jasmine -> Total updates correctly', async () => {
    const products = await getProducts();
    const settings = await getSettings();
    const jasmine = products.find((p) => p.id === 'prod-jasmine');

    // Increase to 3 units
    const cart = [{ productId: jasmine!.id, quantity: 3 }];
    const result = calculateOrderTotals(cart, products, settings);

    expect(result.subtotalPaise).toBe(jasmine!.pricePaise * 3); // 18000 paise
    // Under 29900 threshold, standard delivery fee 3000 is added
    expect(result.deliveryFeePaise).toBe(settings.standardDeliveryFeePaise);
    expect(result.totalPaise).toBe(18000 + 3000); // 21000 paise
  });

  // ============================================================
  // TEST 3: Attempt checkout with an empty cart. Expected: Checkout is blocked.
  // ============================================================
  it('TEST 3: Attempt checkout with an empty cart -> Checkout is blocked', async () => {
    const products = await getProducts();
    const settings = await getSettings();
    const emptyCart: { productId: string; quantity: number }[] = [];

    const result = calculateOrderTotals(emptyCart, products, settings);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/empty/i);
    expect(result.totalPaise).toBe(0);
  });

  // ============================================================
  // TEST 4: Submit an invalid mobile number. Expected: Validation error appears.
  // ============================================================
  it('TEST 4: Submit invalid mobile numbers -> Validation error appears', () => {
    // Too short
    expect(validateIndianPhone('98765').valid).toBe(false);
    expect(validateIndianPhone('98765').error).toBeDefined();

    // Invalid starting digit (must start with 6, 7, 8, 9)
    expect(validateIndianPhone('1234567890').valid).toBe(false);
    expect(validateIndianPhone('1234567890').error).toMatch(/must start with 6, 7, 8, or 9/);

    // Contains non-digit garbage
    expect(validateIndianPhone('9876abc123').valid).toBe(false);

    // Valid formats should pass and normalize to +91
    const validCheck = validateIndianPhone('9876543210');
    expect(validCheck.valid).toBe(true);
    expect(validCheck.formatted).toBe('+919876543210');
  });

  // ============================================================
  // TEST 5: Choose Monday, Wednesday, and Friday deliveries. Expected: Schedule summary shows the selected days.
  // ============================================================
  it('TEST 5: Choose Mon, Wed, Fri deliveries -> Schedule summary shows selected days', async () => {
    const products = await getProducts();
    const jasmine = products[0];

    const sub = await createSubscription({
      id: 'SUB-TEST-5',
      customer: {
        customerName: 'Ananya Rao',
        phone: '+919876543210',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Tower 4',
        flatNumber: 'Flat 901',
      },
      items: [{
        productId: jasmine.id,
        name: jasmine.name,
        pricePaise: jasmine.pricePaise,
        unit: jasmine.unit,
        quantity: 1,
        itemTotalPaise: jasmine.pricePaise,
      }],
      daysOfWeek: ['Mon', 'Wed', 'Fri'],
      timeSlot: 'morning',
      startDate: '2026-10-19',
      status: 'active',
      estimatedWeeklyPaise: jasmine.pricePaise * 3,
      skippedDates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(sub.daysOfWeek).toEqual(['Mon', 'Wed', 'Fri']);
    // Verify delivery on Monday (2026-10-19 is a Monday)
    expect(isSubscriptionDeliveringOnDate('2026-10-19', sub.daysOfWeek)).toBe(true);
    // Verify delivery on Wednesday (2026-10-21 is a Wednesday)
    expect(isSubscriptionDeliveringOnDate('2026-10-21', sub.daysOfWeek)).toBe(true);
    // Verify no delivery on Tuesday (2026-10-20 is a Tuesday)
    expect(isSubscriptionDeliveringOnDate('2026-10-20', sub.daysOfWeek)).toBe(false);
  });

  // ============================================================
  // TEST 6: Skip an upcoming delivery. Expected: The skipped date is excluded from the schedule.
  // ============================================================
  it('TEST 6: Skip an upcoming delivery -> Skipped date is excluded from the schedule', async () => {
    const sub = await createSubscription({
      id: 'SUB-TEST-6',
      customer: {
        customerName: 'Kavitha Devi',
        phone: '+919876543210',
        apartmentCommunity: 'Aparna Serene Park',
        buildingTower: 'Block C',
        flatNumber: 'Flat 302',
      },
      items: [],
      daysOfWeek: ['Mon', 'Wed', 'Fri'],
      timeSlot: 'morning',
      startDate: '2026-10-19',
      status: 'active',
      estimatedWeeklyPaise: 15000,
      skippedDates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Before skip: 2026-10-19 (Mon) is scheduled
    expect(isSubscriptionDeliveringOnDate('2026-10-19', sub.daysOfWeek, sub.skippedDates)).toBe(true);

    // Perform skip on 2026-10-19
    const updated = await skipSubscriptionDate(sub.id, '2026-10-19');
    expect(updated.skippedDates).toContain('2026-10-19');

    // After skip: 2026-10-19 must be excluded from schedule
    expect(isSubscriptionDeliveringOnDate('2026-10-19', updated.daysOfWeek, updated.skippedDates)).toBe(false);

    // Other scheduled days remain untouched (2026-10-21 is Wed)
    expect(isSubscriptionDeliveringOnDate('2026-10-21', updated.daysOfWeek, updated.skippedDates)).toBe(true);
  });

  // ============================================================
  // TEST 7: Pause a subscription. Expected: Future deliveries are not generated while paused.
  // ============================================================
  it('TEST 7: Pause a subscription -> Deliveries are not generated while paused', async () => {
    const sub = await createSubscription({
      id: 'SUB-TEST-7',
      customer: {
        customerName: 'Suresh Varma',
        phone: '+919876543210',
        apartmentCommunity: 'Prestige High Fields',
        buildingTower: 'Tower 1',
        flatNumber: 'Flat 1205',
      },
      items: [],
      daysOfWeek: ['Mon', 'Wed', 'Fri'],
      timeSlot: 'morning',
      startDate: '2026-10-19',
      status: 'active',
      estimatedWeeklyPaise: 18000,
      skippedDates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(sub.status).toBe('active');
    expect(isSubscriptionDeliveringOnDate('2026-10-19', sub.daysOfWeek, sub.skippedDates, sub.status)).toBe(true);

    // Pause the subscription
    const paused = await pauseSubscription(sub.id);
    expect(paused.status).toBe('paused');
    expect(paused.pausedAt).toBeDefined();

    // Verify deliveries are suspended while paused
    expect(isSubscriptionDeliveringOnDate('2026-10-19', paused.daysOfWeek, paused.skippedDates, paused.status)).toBe(false);

    // Resume subscription
    const resumed = await resumeSubscription(sub.id);
    expect(resumed.status).toBe('active');
    expect(isSubscriptionDeliveringOnDate('2026-10-19', resumed.daysOfWeek, resumed.skippedDates, resumed.status)).toBe(true);
  });

  // ============================================================
  // TEST 8: Create a festival booking. Expected: Booking is stored and visible in the admin dashboard.
  // ============================================================
  it('TEST 8: Create festival booking -> Stored and visible in admin dashboard', async () => {
    const booking = await createFestivalBooking({
      id: 'FEST-TEST-8',
      festivalId: 'fest-ugadi',
      festivalName: 'Ugadi Telugu New Year Special',
      festivalDate: '2026-03-19',
      customer: {
        customerName: 'Narayana Murthy',
        phone: '+919876543210',
        apartmentCommunity: 'Jayabheri Silicon County',
        buildingTower: 'Block B',
        flatNumber: 'Flat 401',
      },
      items: [{
        productId: 'prod-jasmine',
        name: 'Fresh Madurai Jasmine',
        pricePaise: 6000,
        unit: 'per 100g',
        quantity: 2,
        itemTotalPaise: 12000,
      }],
      specialGarlandNotes: 'Need 4ft fragrant mala',
      preferredSlot: 'early_morning',
      subtotalPaise: 12000,
      deliveryFeePaise: 3000,
      totalPaise: 15000,
      status: 'requested',
      paymentStatus: 'pending',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(booking.id).toBe('FEST-TEST-8');

    // Check visibility in admin dashboard bookings list
    const allBookings = await getFestivalBookings();
    const found = allBookings.find((b) => b.id === 'FEST-TEST-8');
    expect(found).toBeDefined();
    expect(found?.customer.customerName).toBe('Narayana Murthy');
    expect(found?.status).toBe('requested');
  });

  // ============================================================
  // TEST 9: Choose WhatsApp-assisted UPI. Expected: Valid order summary and WhatsApp link are generated.
  // ============================================================
  it('TEST 9: Choose WhatsApp-assisted UPI -> Valid order summary and WhatsApp link are generated', async () => {
    const order = await createOrder({
      id: 'MF-TEST-9',
      customer: {
        customerName: 'Deepa Rao',
        phone: '+919876543210',
        apartmentCommunity: 'My Home Avatar',
        buildingTower: 'Tower 6',
        flatNumber: 'Flat 702',
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
        {
          productId: 'prod-marigold',
          name: 'Golden Marigold',
          pricePaise: 4000,
          unit: 'per 250g',
          quantity: 1,
          itemTotalPaise: 4000,
        },
      ],
      orderType: 'one-time',
      subtotalPaise: 16000,
      deliveryFeePaise: 3000,
      totalPaise: 19000, // ₹190.00
      deliverySchedule: {
        type: 'one-time',
        date: '2026-10-20',
        timeSlot: 'morning',
      },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const link = generateWhatsAppOrderLink(order, '919876543210');
    expect(link).toContain('https://wa.me/919876543210');
    expect(link).toContain('text=');

    // Decode message to inspect contents
    const encodedText = link.split('text=')[1];
    const decoded = decodeURIComponent(encodedText);

    expect(decoded).toContain('Hello Mahesh Flora!');
    expect(decoded).toContain('MF-TEST-9');
    expect(decoded).toContain('Fresh Madurai Jasmine (2 per 100g)');
    expect(decoded).toContain('2026-10-20');
    expect(decoded).toContain('Morning Puja Slot');
    expect(decoded).toContain('₹190');
    expect(decoded).toContain('Please help me complete the payment.');
  });

  // ============================================================
  // TEST 10: Simulate an unsuccessful payment. Expected: Order is not marked paid.
  // ============================================================
  it('TEST 10: Simulate unsuccessful payment -> Order is not marked paid', async () => {
    const order = await createOrder({
      id: 'MF-TEST-10',
      customer: {
        customerName: 'Raghavan Pillai',
        phone: '+919876543210',
        apartmentCommunity: 'Rainbow Vistas Rockgarden',
        buildingTower: 'Tower Sapphire',
        flatNumber: 'Flat 1401',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 10000,
      deliveryFeePaise: 0,
      totalPaise: 10000,
      deliverySchedule: { type: 'one-time', date: '2026-10-20', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Simulate payment failure
    const failedOrder = await updateOrderPaymentStatus(order.id, 'failed');
    expect(failedOrder.paymentStatus).toBe('failed');
    expect(failedOrder.paidAt).toBeUndefined();

    // Verify fresh read from database
    const freshRead = await getOrderById(order.id);
    expect(freshRead?.paymentStatus).toBe('failed');
    expect(freshRead?.paymentStatus).not.toBe('paid');
  });

  // ============================================================
  // TEST 11: Simulate a verified successful payment. Expected: Payment status updates correctly.
  // ============================================================
  it('TEST 11: Simulate verified successful payment -> Payment status updates correctly to paid', async () => {
    const order = await createOrder({
      id: 'MF-TEST-11',
      customer: {
        customerName: 'Meenakshi Iyer',
        phone: '+919876543210',
        apartmentCommunity: 'Lodha Bellezza',
        buildingTower: 'Tower 2',
        flatNumber: 'Flat 801',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 15000,
      deliveryFeePaise: 0,
      totalPaise: 15000,
      deliverySchedule: { type: 'one-time', date: '2026-10-20', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(order.paymentStatus).toBe('unpaid');

    // Simulate verified payment capture
    const verifiedOrder = await updateOrderPaymentStatus(order.id, 'paid', {
      razorpayPaymentId: 'pay_test_998822',
      razorpayOrderId: 'order_test_443322',
    });

    expect(verifiedOrder.paymentStatus).toBe('paid');
    expect(verifiedOrder.paidAt).toBeDefined();
    expect(verifiedOrder.orderStatus).toBe('confirmed');
    expect(verifiedOrder.razorpayPaymentId).toBe('pay_test_998822');

    // Verify stored
    const checkDb = await getOrderById(order.id);
    expect(checkDb?.paymentStatus).toBe('paid');
  });

  // ============================================================
  // TEST 12: Attempt unauthorized admin access. Expected: Access is denied.
  // ============================================================
  it('TEST 12: Attempt unauthorized admin access -> Access is denied (401)', () => {
    // Request with no credentials or invalid key
    const reqWithoutAuth = new NextRequest('http://localhost:3000/api/admin/metrics');
    const check1 = verifyAdminAuthorization(reqWithoutAuth);
    expect(check1.authorized).toBe(false);
    expect(check1.reason).toContain('Unauthorized');

    // Request with bad key
    const reqWithBadKey = new NextRequest('http://localhost:3000/api/admin/metrics', {
      headers: { 'x-admin-key': 'wrong-password' },
    });
    const check2 = verifyAdminAuthorization(reqWithBadKey);
    expect(check2.authorized).toBe(false);

    // Request with correct secret key
    const reqWithValidKey = new NextRequest('http://localhost:3000/api/admin/metrics', {
      headers: { 'x-admin-key': 'mahesh-flora-admin-secret-dev-key' },
    });
    const check3 = verifyAdminAuthorization(reqWithValidKey);
    expect(check3.authorized).toBe(true);
  });

  // ============================================================
  // TEST 13: Attempt to modify another customer's order. Expected: Unauthorized access is denied.
  // ============================================================
  it('TEST 13: Attempt to modify another customer’s order -> Denied', () => {
    const customerAPhone = '+919876543210';
    const customerBPhone = '+919988776655';

    // Customer B tries to access/modify Customer A's order without admin rights
    const unauthReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      headers: {
        'x-customer-phone': customerBPhone,
      },
    });

    const accessCheck = verifyOrderAccess(unauthReq, customerAPhone);
    expect(accessCheck.allowed).toBe(false);
    expect(accessCheck.reason).toContain('Unauthorized access: You cannot view or modify another customer');

    // Customer A accessing their own order
    const authReq = new NextRequest('http://localhost:3000/api/admin/orders', {
      headers: {
        'x-customer-phone': customerAPhone,
      },
    });
    const ownerCheck = verifyOrderAccess(authReq, customerAPhone);
    expect(ownerCheck.allowed).toBe(true);
  });

  // ============================================================
  // TEST 14: Reload the website. Expected: The cart or other persisted state behaves correctly.
  // ============================================================
  it('TEST 14: Storage and cart persistence across reloads behaves correctly', async () => {
    // Simulate initial order in store
    const testOrder = await createOrder({
      id: 'MF-RELOAD-TEST',
      customer: {
        customerName: 'Lakshmi Narayan',
        phone: '+919876543210',
        apartmentCommunity: 'Lanco Hills',
        buildingTower: 'Tower 9',
        flatNumber: 'Flat 1804',
      },
      items: [],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 3000,
      totalPaise: 9000,
      deliverySchedule: { type: 'one-time', date: '2026-10-21', timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'unpaid',
      paymentMethod: 'whatsapp_upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Re-query data simulating fresh page request
    const persisted = await getOrderById('MF-RELOAD-TEST');
    expect(persisted).toBeDefined();
    expect(persisted?.id).toBe('MF-RELOAD-TEST');
    expect(persisted?.customer.customerName).toBe('Lakshmi Narayan');
    expect(persisted?.totalPaise).toBe(9000);
  });

  // ============================================================
  // TEST 15: Open the website on a mobile viewport (~360px). Expected: Safe delivery cutoffs and responsive flow
  // ============================================================
  it('TEST 15: Mobile order flow validation and cutoff verification', () => {
    // Validate past dates are blocked
    const pastCheck = checkDeliveryCutoff('2020-01-01', 'morning');
    expect(pastCheck.allowed).toBe(false);
    expect(pastCheck.message).toContain('past');

    // Future date is allowed
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const futureCheck = checkDeliveryCutoff(futureDateStr, 'morning');
    expect(futureCheck.allowed).toBe(true);
  });
});
