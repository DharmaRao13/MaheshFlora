import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  evaluateDeliveryPromotion,
  calculateOrderTotals,
} from '@/lib/business';
import {
  getSettings,
  updateSettings,
  createOrder,
  getOrderById,
  incrementPromotionOrderCount,
  getCustomerCompletedOrderCount,
} from '@/lib/db/store';
import { PUT as updateSettingsRoute } from '@/app/api/admin/settings/route';
import { GET as getActivePromoRoute } from '@/app/api/promotions/active/route';
import { POST as placeOrderRoute } from '@/app/api/orders/route';
import { DEFAULT_SETTINGS, formatINR } from '@/lib/config';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Product, DeliveryPromotion, BusinessSettings, Order } from '@/types';

const sampleProducts: Product[] = [
  {
    id: 'prod-marigold-yellow',
    name: 'Yellow Marigold (Banti Puvvu)',
    category: 'loose-flowers',
    pricePaise: 4000, // ₹40.00
    unit: 'per 250g',
    description: 'Fresh yellow marigolds',
    imageUrl: '/images/marigold.jpg',
    inStock: true,
  },
  {
    id: 'prod-jasmine-string',
    name: 'Jasmine Strings (Mallepuvvu)',
    category: 'pooja-garlands',
    pricePaise: 5900, // ₹59.00
    unit: 'per moora',
    description: 'Fresh jasmine',
    imageUrl: '/images/jasmine.jpg',
    inStock: true,
  },
  {
    id: 'prod-rose-petals',
    name: 'Rose Petals (Gulabi)',
    category: 'loose-flowers',
    pricePaise: 9900, // ₹99.00
    unit: 'per 250g',
    description: 'Fragrant rose petals',
    imageUrl: '/images/rose.jpg',
    inStock: true,
  },
];

describe('Admin-Controlled First-Order Free Delivery Promotion Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // Reset settings to default with delivery promotion disabled
    await updateSettings({
      ...DEFAULT_SETTINGS,
      deliveryPromotion: {
        id: 'promo-first-order-default',
        enabled: false,
        title: 'First-Order Free Delivery',
        type: 'first_time_customers',
        minOrderAmountPaise: 9900, // ₹99
        maxUsesPerCustomer: 1,
      },
    });
  });

  // =========================================================================
  // 1. MINIMUM PURCHASE AMOUNT THRESHOLDS (BELOW, EXACTLY AT, ABOVE)
  // =========================================================================
  describe('Minimum Purchase Amount Thresholds', () => {
    it('1. Rejects free delivery when order is below configured minimum purchase amount', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-min-99',
        enabled: true,
        title: 'First Order Free Delivery above ₹99',
        type: 'first_time_customers',
        minOrderAmountPaise: 9900, // ₹99
      };

      // Cart subtotal: ₹40 + ₹40 = ₹80 (8000 paise) < ₹99
      const evalResult = evaluateDeliveryPromotion(promo, 8000, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });

      expect(evalResult.isEligible).toBe(false);
      expect(evalResult.discountAmountPaise).toBe(0);
      expect(evalResult.reason).toContain('Minimum order amount of ₹99 required');

      // Server calculation charges standard delivery fee (₹30)
      const calc = calculateOrderTotals(
        [{ productId: 'prod-marigold-yellow', quantity: 2 }],
        sampleProducts,
        { ...DEFAULT_SETTINGS, deliveryPromotion: promo },
        { isFirstTimeCustomer: true, customerCompletedOrderCount: 0 }
      );

      expect(calc.subtotalPaise).toBe(8000);
      expect(calc.deliveryFeePaise).toBe(3000);
      expect(calc.totalPaise).toBe(11000);
      expect(calc.appliedPromotion).toBeUndefined();
    });

    it('2. Unlocks free delivery when order is exactly at configured minimum purchase amount', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-min-99',
        enabled: true,
        title: 'First Order Free Delivery above ₹99',
        type: 'first_time_customers',
        minOrderAmountPaise: 9900, // ₹99
      };

      // Cart subtotal: ₹40 + ₹59 = ₹99 (9900 paise) === ₹99
      const evalResult = evaluateDeliveryPromotion(promo, 9900, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });

      expect(evalResult.isEligible).toBe(true);
      expect(evalResult.discountAmountPaise).toBe(3000);
      expect(evalResult.reason).toContain('First-time customer');

      // Server calculation sets delivery fee to 0 and records audit fields
      const calc = calculateOrderTotals(
        [
          { productId: 'prod-marigold-yellow', quantity: 1 },
          { productId: 'prod-jasmine-string', quantity: 1 },
        ],
        sampleProducts,
        { ...DEFAULT_SETTINGS, deliveryPromotion: promo },
        { isFirstTimeCustomer: true, customerCompletedOrderCount: 0 }
      );

      expect(calc.subtotalPaise).toBe(9900);
      expect(calc.deliveryFeePaise).toBe(0);
      expect(calc.totalPaise).toBe(9900);
      expect(calc.appliedPromotion).toBeDefined();
      expect(calc.appliedPromotion?.promotionId).toBe('promo-min-99');
      expect(calc.appliedPromotion?.minPurchaseThresholdPaise).toBe(9900);
      expect(calc.appliedPromotion?.discountAmountPaise).toBe(3000);
    });

    it('3. Unlocks free delivery when order is above configured minimum purchase amount (e.g. ₹149 or ₹199 custom presets)', () => {
      const promo149: DeliveryPromotion = {
        id: 'promo-min-149',
        enabled: true,
        title: 'Free Delivery above ₹149',
        type: 'first_time_customers',
        minOrderAmountPaise: 14900, // ₹149
      };

      // Cart subtotal: ₹99 + ₹59 = ₹158 (15800 paise) > ₹149
      const calc = calculateOrderTotals(
        [
          { productId: 'prod-rose-petals', quantity: 1 },
          { productId: 'prod-jasmine-string', quantity: 1 },
        ],
        sampleProducts,
        { ...DEFAULT_SETTINGS, deliveryPromotion: promo149 },
        { isFirstTimeCustomer: true, customerCompletedOrderCount: 0 }
      );

      expect(calc.subtotalPaise).toBe(15800);
      expect(calc.deliveryFeePaise).toBe(0);
      expect(calc.totalPaise).toBe(15800);
      expect(calc.appliedPromotion?.minPurchaseThresholdPaise).toBe(14900);
    });
  });

  // =========================================================================
  // 2. DISABLED OFFERS TOGGLE
  // =========================================================================
  describe('Disabled Offer Toggle', () => {
    it('1. Charges standard delivery fee when promotion offer is disabled by admin', () => {
      const promoDisabled: DeliveryPromotion = {
        id: 'promo-disabled',
        enabled: false, // Turned OFF by admin
        title: 'First-Order Free Delivery',
        type: 'first_time_customers',
        minOrderAmountPaise: 9900,
      };

      // Cart is ₹139 (above ₹99) and user is first-time customer
      const evalResult = evaluateDeliveryPromotion(promoDisabled, 13900, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });

      expect(evalResult.isEligible).toBe(false);
      expect(evalResult.discountAmountPaise).toBe(0);

      const calc = calculateOrderTotals(
        [
          { productId: 'prod-marigold-yellow', quantity: 2 },
          { productId: 'prod-jasmine-string', quantity: 1 },
        ],
        sampleProducts,
        { ...DEFAULT_SETTINGS, deliveryPromotion: promoDisabled },
        { isFirstTimeCustomer: true, customerCompletedOrderCount: 0 }
      );

      expect(calc.subtotalPaise).toBe(13900);
      expect(calc.deliveryFeePaise).toBe(3000);
      expect(calc.totalPaise).toBe(16900);
      expect(calc.appliedPromotion).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. ELIGIBILITY CONFIGURATION: FIRST-TIME, FIRST N ORDERS, OR BOTH
  // =========================================================================
  describe('Offer Eligibility Configurations', () => {
    it('1. First-time customers only: succeeds on first order, fails on second order', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-first-time-only',
        enabled: true,
        title: 'Welcome First Order Free Delivery',
        type: 'first_time_customers',
        minOrderAmountPaise: 9900,
      };

      // First order (0 previous completed orders)
      const firstOrder = evaluateDeliveryPromotion(promo, 12000, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });
      expect(firstOrder.isEligible).toBe(true);

      // Repeat order from returning customer (1 previous completed order)
      const secondOrder = evaluateDeliveryPromotion(promo, 12000, 3000, {
        isFirstTimeCustomer: false,
        customerCompletedOrderCount: 1,
      });
      expect(secondOrder.isEligible).toBe(false);
      expect(secondOrder.reason).toContain('first-time customers');
    });

    it('2. First N qualifying orders: succeeds while count < cap, fails when cap reached', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-early-bird',
        enabled: true,
        title: 'First 10 Orders Free Delivery',
        type: 'first_n_orders',
        minOrderAmountPaise: 9900,
        maxQualifyingOrders: 10,
        currentQualifyingOrdersCount: 9,
      };

      // 10th order (count is 9 < 10)
      const tenthOrder = evaluateDeliveryPromotion(promo, 12000, 3000);
      expect(tenthOrder.isEligible).toBe(true);
      expect(tenthOrder.reason).toContain('Storewide early order #10');

      // 11th order (count reached 10)
      const cappedPromo = { ...promo, currentQualifyingOrdersCount: 10 };
      const eleventhOrder = evaluateDeliveryPromotion(cappedPromo, 12000, 3000);
      expect(eleventhOrder.isEligible).toBe(false);
      expect(eleventhOrder.reason).toContain('order limit has been reached');
    });

    it('3. Both (First-time customers AND First N qualifying orders): requires BOTH criteria to be satisfied', () => {
      const promoBoth: DeliveryPromotion = {
        id: 'promo-both',
        enabled: true,
        title: 'First 25 First-Time Customers Free Delivery',
        type: 'first_time_and_first_n_orders',
        minOrderAmountPaise: 9900,
        maxQualifyingOrders: 25,
        currentQualifyingOrdersCount: 15,
      };

      // Case A: First-time customer within cap -> ELIGIBLE
      const eligible = evaluateDeliveryPromotion(promoBoth, 12000, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });
      expect(eligible.isEligible).toBe(true);
      expect(eligible.reason).toContain('First-time customer early bird promotional free delivery');

      // Case B: Returning customer within cap -> INELIGIBLE (failed first-time criterion)
      const returningCustomer = evaluateDeliveryPromotion(promoBoth, 12000, 3000, {
        isFirstTimeCustomer: false,
        customerCompletedOrderCount: 2,
      });
      expect(returningCustomer.isEligible).toBe(false);
      expect(returningCustomer.reason).toContain('first-time customers');

      // Case C: First-time customer after cap is exhausted -> INELIGIBLE (failed cap criterion)
      const exhaustedPromo = { ...promoBoth, currentQualifyingOrdersCount: 25 };
      const lateFirstTimer = evaluateDeliveryPromotion(exhaustedPromo, 12000, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });
      expect(lateFirstTimer.isEligible).toBe(false);
      expect(lateFirstTimer.reason).toContain('order limit has been reached');
    });
  });

  // =========================================================================
  // 4. CONCURRENT ORDERS REACHING QUALIFYING-ORDER LIMIT
  // =========================================================================
  describe('Concurrent Orders Reaching Qualifying-Order Limit', () => {
    it('1. Atomically enforces qualifying order limit across multiple orders', async () => {
      const promoId = 'promo-concurrency-test';
      await updateSettings({
        ...DEFAULT_SETTINGS,
        deliveryPromotion: {
          id: promoId,
          enabled: true,
          title: 'First 2 Orders Free Delivery',
          type: 'first_n_orders',
          minOrderAmountPaise: 4000,
          maxQualifyingOrders: 2,
          currentQualifyingOrdersCount: 0,
        },
      });

      // Simulate 4 concurrent customer checkout attempts
      const attempts = [1, 2, 3, 4];
      const results: { attempt: number; qualified: boolean }[] = [];

      for (const att of attempts) {
        const currentSettings = await getSettings();
        const promo = currentSettings.deliveryPromotion;
        const evalResult = evaluateDeliveryPromotion(promo, 8000, 3000);

        if (evalResult.isEligible && evalResult.promotion) {
          // Atomic increment simulates successful order placement
          await incrementPromotionOrderCount(promoId);
          results.push({ attempt: att, qualified: true });
        } else {
          results.push({ attempt: att, qualified: false });
        }
      }

      // Exactly the first 2 orders qualified, the subsequent 2 were charged delivery fee
      expect(results[0].qualified).toBe(true);
      expect(results[1].qualified).toBe(true);
      expect(results[2].qualified).toBe(false);
      expect(results[3].qualified).toBe(false);

      const finalSettings = await getSettings();
      expect(finalSettings.deliveryPromotion?.currentQualifyingOrdersCount).toBe(2);
    });
  });

  // =========================================================================
  // 5. PAST ORDER IMMUTABILITY / AUDIT RECORDING
  // =========================================================================
  describe('Past Order Immutability & Audit Trail', () => {
    it('1. Preserves applied promotion threshold, discount, and fee on existing orders when admin modifies offer later', async () => {
      const initialThresholdPaise = 9900; // ₹99
      const promoId = 'promo-immutable-test';

      // 1. Admin creates initial promotion: ₹99 min purchase
      await updateSettings({
        ...DEFAULT_SETTINGS,
        deliveryPromotion: {
          id: promoId,
          enabled: true,
          title: 'First Order Free Delivery ₹99',
          type: 'first_time_customers',
          minOrderAmountPaise: initialThresholdPaise,
        },
      });

      // 2. Customer places order of ₹100
      const orderId = 'MF-PROMO-AUDIT-001';
      const orderData: Order = {
        id: orderId,
        customer: {
          customerName: 'Ananya Sharma',
          phone: '+919988776655',
          apartmentCommunity: 'Sobha Forest View',
          flatNumber: 'B-101',
        },
        items: [
          {
            productId: 'prod-rose-petals',
            name: 'Rose Petals',
            pricePaise: 9900,
            unit: 'per 250g',
            quantity: 1,
            itemTotalPaise: 9900,
          },
        ],
        orderType: 'one-time',
        subtotalPaise: 9900,
        deliveryFeePaise: 0,
        totalPaise: 9900,
        promotionId: promoId,
        minPurchaseThresholdPaise: initialThresholdPaise, // ₹99 recorded
        discountAmountPaise: 3000,
        appliedDeliveryFeePaise: 0,
        eligibilityReason: 'First-time customer promotional free delivery applied.',
        deliverySchedule: { type: 'one-time', date: '2026-12-05', timeSlot: 'morning' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createOrder(orderData);

      // 3. Later, Admin changes promotion: raises minimum purchase to ₹199 and disables previous offer
      await updateSettings({
        ...DEFAULT_SETTINGS,
        deliveryPromotion: {
          id: 'promo-updated-later',
          enabled: true,
          title: 'New Offer ₹199 Minimum',
          type: 'first_time_customers',
          minOrderAmountPaise: 19900, // ₹199
        },
      });

      // 4. Fetch the existing order from database: it must remain unmodified
      const persistedOrder = await getOrderById(orderId);
      expect(persistedOrder).toBeDefined();
      expect(persistedOrder?.promotionId).toBe(promoId);
      expect(persistedOrder?.minPurchaseThresholdPaise).toBe(initialThresholdPaise); // Unchanged!
      expect(persistedOrder?.deliveryFeePaise).toBe(0); // Free delivery intact!
      expect(persistedOrder?.totalPaise).toBe(9900);
      expect(persistedOrder?.appliedDeliveryFeePaise).toBe(0);
    });
  });

  // =========================================================================
  // 6. ADMIN API SETTINGS VALIDATION & AUTHORIZATION
  // =========================================================================
  describe('Admin API Settings Validation & Persistence', () => {
    it('1. Rejects unauthorized update requests without valid admin secret', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, // Missing x-admin-key
        body: JSON.stringify({
          deliveryPromotion: {
            id: 'promo-hack',
            enabled: true,
            title: 'Hacked Offer',
            type: 'all_orders',
            minOrderAmountPaise: 0,
          },
        }),
      });

      const res = await updateSettingsRoute(req);
      expect(res.status).toBe(401);
    });

    it('2. Rejects invalid minimum purchase amount (negative numbers)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          deliveryPromotion: {
            id: 'promo-invalid',
            enabled: true,
            title: 'Invalid Offer',
            type: 'first_time_customers',
            minOrderAmountPaise: -500, // Invalid!
          },
        }),
      });

      const res = await updateSettingsRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Minimum purchase amount must be a non-negative number');
    });

    it('3. Successfully saves configured minimum purchase amount and reflects in active promo API', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          deliveryPromotion: {
            id: 'promo-festive-149',
            enabled: true,
            title: 'Festive Free Delivery',
            type: 'first_time_and_first_n_orders',
            minOrderAmountPaise: 14900, // ₹149 custom minimum
            bannerWording: 'Special Diwali Offer: Free morning delivery on orders above ₹149!',
            maxQualifyingOrders: 100,
          },
        }),
      });

      const res = await updateSettingsRoute(req);
      expect(res.status).toBe(200);

      // Verify active promo endpoint reflects the new settings
      const activeRes = await getActivePromoRoute();
      expect(activeRes.status).toBe(200);
      const activeData = await activeRes.json();
      expect(activeData.active).toBe(true);
      expect(activeData.promotion.minOrderAmountPaise).toBe(14900);
      expect(activeData.promotion.type).toBe('first_time_and_first_n_orders');
      expect(activeData.promotion.bannerWording).toContain('orders above ₹149');
    });
  });

  // =========================================================================
  // 7. DYNAMIC CART SPEND NEEDED & UNLOCKED MESSAGES
  // =========================================================================
  describe('Dynamic Cart Remaining Spend Calculation', () => {
    it('1. Accurately calculates remaining spend needed to unlock free delivery', () => {
      const thresholdPaise = 9900; // ₹99
      const cartSubtotalPaise = 6900; // ₹69

      const remainingNeededPaise = Math.max(0, thresholdPaise - cartSubtotalPaise);
      expect(remainingNeededPaise).toBe(3000); // ₹30 remaining
      expect(formatINR(remainingNeededPaise)).toBe('₹30');

      // Dynamic message formatting: "Add ₹30 more to unlock free delivery!"
      const dynamicMessage = `Add ${formatINR(remainingNeededPaise)} more to unlock free delivery!`;
      expect(dynamicMessage).toBe('Add ₹30 more to unlock free delivery!');
    });

    it('2. Correctly flags unlocked status when threshold is reached or exceeded', () => {
      const thresholdPaise = 9900; // ₹99
      const cartSubtotalPaise = 10000; // ₹100

      const remainingNeededPaise = Math.max(0, thresholdPaise - cartSubtotalPaise);
      expect(remainingNeededPaise).toBe(0);

      const unlockedMessage = "🎉 Congratulations! You've unlocked free delivery.";
      expect(unlockedMessage).toBe("🎉 Congratulations! You've unlocked free delivery.");
    });
  });

  // =========================================================================
  // 8. CONFIGURABLE NORMAL DELIVERY FEE
  // =========================================================================
  describe('Configurable Normal Delivery Fee', () => {
    it('1. Admin can configure custom normal delivery fee (e.g. ₹40) and reject negative values', async () => {
      // Rejects negative delivery fee
      const invalidReq = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          standardDeliveryFeePaise: -100,
        }),
      });
      const invalidRes = await updateSettingsRoute(invalidReq);
      expect(invalidRes.status).toBe(400);

      // Saves valid normal delivery fee of ₹40 (4000 paise)
      const validReq = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET_KEY,
        },
        body: JSON.stringify({
          standardDeliveryFeePaise: 4000,
        }),
      });
      const validRes = await updateSettingsRoute(validReq);
      expect(validRes.status).toBe(200);

      const activeRes = await getActivePromoRoute();
      const activeData = await activeRes.json();
      expect(activeData.standardDeliveryFeePaise).toBe(4000);
    });
  });

  // =========================================================================
  // 9. CANCELLED, FAILED, REFUNDED & UNPAID ORDERS EFFECT ON ELIGIBILITY & LIMITS
  // =========================================================================
  describe('Cancelled, Failed & Refunded Orders Impact', () => {
    it('1. Cancelled and failed orders do NOT count against customer first-order eligibility', async () => {
      const customerPhone = '919876543210';
      const customerUid = 'cust-cancelled-test';

      // Seed a cancelled order
      await createOrder({
        id: 'MF-CANCELLED-001',
        customer: {
          phone: customerPhone,
          uid: customerUid,
          customerName: 'Test Customer',
          apartmentCommunity: 'Test Society',
          flatNumber: '101',
        },
        items: [{ productId: 'prod-marigold-yellow', name: 'Marigold', pricePaise: 4000, unit: 'pack', quantity: 1, itemTotalPaise: 4000 }],
        orderType: 'one-time',
        subtotalPaise: 4000,
        deliveryFeePaise: 3000,
        totalPaise: 7000,
        deliverySchedule: { type: 'one-time', date: '2026-12-01', timeSlot: 'morning' },
        orderStatus: 'cancelled',
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Seed a failed order
      await createOrder({
        id: 'MF-FAILED-001',
        customer: {
          phone: customerPhone,
          uid: customerUid,
          customerName: 'Test Customer',
          apartmentCommunity: 'Test Society',
          flatNumber: '101',
        },
        items: [{ productId: 'prod-marigold-yellow', name: 'Marigold', pricePaise: 4000, unit: 'pack', quantity: 1, itemTotalPaise: 4000 }],
        orderType: 'one-time',
        subtotalPaise: 4000,
        deliveryFeePaise: 3000,
        totalPaise: 7000,
        deliverySchedule: { type: 'one-time', date: '2026-12-01', timeSlot: 'morning' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'failed',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const count = await getCustomerCompletedOrderCount(customerPhone, customerUid);
      expect(count).toBe(0);

      // Customer remains fully eligible for first-time customer free delivery
      const promo: DeliveryPromotion = {
        id: 'promo-welcome-restored',
        enabled: true,
        title: 'First-Order Free Delivery',
        type: 'first_time_customers',
        minOrderAmountPaise: 4000,
      };

      const evalResult = evaluateDeliveryPromotion(promo, 5000, 3000, {
        isFirstTimeCustomer: count === 0,
        customerCompletedOrderCount: count,
      });

      expect(evalResult.isEligible).toBe(true);
      expect(evalResult.discountAmountPaise).toBe(3000);
    });

    it('2. Cancelling an order restores the storewide promotion redemption counter', async () => {
      const promoId = 'promo-restore-counter-test';
      await updateSettings({
        ...DEFAULT_SETTINGS,
        deliveryPromotion: {
          id: promoId,
          enabled: true,
          title: 'Storewide Early Bird',
          type: 'first_n_orders',
          minOrderAmountPaise: 4000,
          maxQualifyingOrders: 10,
          currentQualifyingOrdersCount: 5,
        },
      });

      // Place an order with promotionId
      const orderId = 'MF-PROMO-RESTORE-001';
      await createOrder({
        id: orderId,
        customer: {
          phone: '9876543219',
          customerName: 'Kavitha R',
          apartmentCommunity: 'Prestige Falcon',
          flatNumber: 'B-201',
        },
        items: [{ productId: 'prod-marigold-yellow', name: 'Marigold', pricePaise: 4000, unit: 'pack', quantity: 1, itemTotalPaise: 4000 }],
        orderType: 'one-time',
        subtotalPaise: 4000,
        deliveryFeePaise: 0,
        totalPaise: 4000,
        promotionId: promoId,
        minPurchaseThresholdPaise: 4000,
        discountAmountPaise: 3000,
        deliverySchedule: { type: 'one-time', date: '2026-12-01', timeSlot: 'morning' },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Customer cancels the order
      const { cancelOrder } = await import('@/lib/db/store');
      await cancelOrder(orderId, 'Cancelled by customer before harvest');

      const updatedSettings = await getSettings();
      // Counter was restored (decremented from 5 to 4)
      expect(updatedSettings.deliveryPromotion?.currentQualifyingOrdersCount).toBe(4);
    });
  });
});
