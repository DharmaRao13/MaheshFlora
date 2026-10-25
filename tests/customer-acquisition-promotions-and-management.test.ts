import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  evaluateDeliveryPromotion,
  calculateOrderTotals,
  evaluateOrderReorder,
} from '@/lib/business';
import {
  getSettings,
  updateSettings,
  createOrder,
  getOrders,
  getAdminCustomersList,
  getAdminCustomerDetail,
  getCustomerCompletedOrderCount,
  incrementPromotionOrderCount,
  saveUserProfile,
} from '@/lib/db/store';
import { GET as getCustomersRoute } from '@/app/api/admin/customers/route';
import { GET as getCustomerDetailRoute } from '@/app/api/admin/customers/[id]/route';
import { GET as getActivePromoRoute } from '@/app/api/promotions/active/route';
import { POST as placeOrderRoute } from '@/app/api/orders/route';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Order, OrderItem, Product, DeliveryPromotion, BusinessSettings } from '@/types';

const sampleProducts: Product[] = [
  {
    id: 'prod-yellow-marigold',
    name: 'Yellow Marigold (Banti Puvvu)',
    category: 'loose-flowers',
    pricePaise: 4000, // ₹40.00 per 250g
    unit: 'per 250g',
    description: 'Fresh yellow marigolds',
    imageUrl: '/images/yellow-marigold.jpg',
    inStock: true,
  },
  {
    id: 'prod-jasmine',
    name: 'Jasmine Strings (Mallepuvvu)',
    category: 'pooja-garlands',
    pricePaise: 8000, // ₹80.00
    unit: 'per moora',
    description: 'Fragrant jasmine',
    imageUrl: '/images/jasmine.jpg',
    inStock: true,
  },
  {
    id: 'prod-lotus',
    name: 'Red Lotus (Kamalam)',
    category: 'loose-flowers',
    pricePaise: 5000,
    unit: 'pair',
    description: 'Sacred red lotus',
    imageUrl: '/images/red-lotus.jpg',
    inStock: false, // Out of stock for testing
  },
];

describe('Customer Acquisition, Free-Delivery Promotions & Customer Management Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // FEATURE 2: SERVER-SIDE FREE DELIVERY PROMOTIONS
  // ==========================================
  describe('Feature 2: Delivery Promotion Evaluation & Business Logic', () => {
    it('1. Qualifies first-time customer when order count is 0 and subtotal meets minimum', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-welcome',
        enabled: true,
        title: 'First-Time Customer Free Delivery',
        type: 'first_time_customers',
        minOrderAmountPaise: 5000, // ₹50 min
        maxUsesPerCustomer: 1,
      };

      // Order of ₹80 (8000 paise) with 0 previous orders
      const evalFirst = evaluateDeliveryPromotion(promo, 8000, 3000, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });

      expect(evalFirst.isEligible).toBe(true);
      expect(evalFirst.discountAmountPaise).toBe(3000);
      expect(evalFirst.reason).toContain('First-time customer');

      // Order of ₹80 with 1 previous order -> Ineligible
      const evalReturning = evaluateDeliveryPromotion(promo, 8000, 3000, {
        isFirstTimeCustomer: false,
        customerCompletedOrderCount: 1,
      });

      expect(evalReturning.isEligible).toBe(false);
      expect(evalReturning.discountAmountPaise).toBe(0);
      expect(evalReturning.reason).toContain('first-time customers');
    });

    it('2. Disqualifies promotion if subtotal is below configured minOrderAmountPaise', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-min-spend',
        enabled: true,
        title: 'Free Delivery on Orders Above ₹199',
        type: 'all_orders',
        minOrderAmountPaise: 19900, // ₹199 min
      };

      const belowMin = evaluateDeliveryPromotion(promo, 12000, 3000);
      expect(belowMin.isEligible).toBe(false);
      expect(belowMin.reason).toContain('Minimum order amount');

      const meetsMin = evaluateDeliveryPromotion(promo, 20000, 3000);
      expect(meetsMin.isEligible).toBe(true);
      expect(meetsMin.discountAmountPaise).toBe(3000);
    });

    it('3. Disqualifies capped storewide promotions (first_n_orders) once limit is reached', () => {
      const promo: DeliveryPromotion = {
        id: 'promo-early-bird',
        enabled: true,
        title: 'First 50 Orders Free Delivery',
        type: 'first_n_orders',
        minOrderAmountPaise: 0,
        maxQualifyingOrders: 50,
        currentQualifyingOrdersCount: 50, // Capped!
      };

      const evalResult = evaluateDeliveryPromotion(promo, 8000, 3000);
      expect(evalResult.isEligible).toBe(false);
      expect(evalResult.reason).toContain('order limit has been reached');

      // When below cap
      const belowCapPromo = { ...promo, currentQualifyingOrdersCount: 49 };
      const evalBelow = evaluateDeliveryPromotion(belowCapPromo, 8000, 3000);
      expect(evalBelow.isEligible).toBe(true);
      expect(evalBelow.discountAmountPaise).toBe(3000);
    });

    it('4. Disqualifies promotions outside date range (expired or not yet started)', () => {
      const expiredPromo: DeliveryPromotion = {
        id: 'promo-past',
        enabled: true,
        title: 'Past Promo',
        type: 'all_orders',
        minOrderAmountPaise: 0,
        startDate: '2026-01-01',
        endDate: '2026-01-10',
      };

      const evalResult = evaluateDeliveryPromotion(expiredPromo, 8000, 3000, {
        currentDate: '2026-05-01',
      });
      expect(evalResult.isEligible).toBe(false);
      expect(evalResult.reason).toContain('expired');
    });

    it('5. calculateOrderTotals attaches promotion audit fields and reduces delivery fee to 0', () => {
      const testSettings: BusinessSettings = {
        ...DEFAULT_SETTINGS,
        standardDeliveryFeePaise: 3000,
        freeDeliveryThresholdPaise: 29900,
        deliveryPromotion: {
          id: 'promo-test-audit',
          enabled: true,
          title: 'Special First Order Free Delivery',
          type: 'first_time_customers',
          minOrderAmountPaise: 0,
          maxQualifyingOrders: 100,
        },
      };

      // Item of ₹40 (below ₹299 threshold)
      const cart = [{ productId: 'prod-yellow-marigold', quantity: 1 }];

      // First time customer: qualifies for promotion
      const totals = calculateOrderTotals(cart, sampleProducts, testSettings, {
        isFirstTimeCustomer: true,
        customerCompletedOrderCount: 0,
      });

      expect(totals.subtotalPaise).toBe(4000);
      expect(totals.deliveryFeePaise).toBe(0);
      expect(totals.totalPaise).toBe(4000); // 4000 + 0
      expect(totals.appliedPromotion).toBeDefined();
      expect(totals.appliedPromotion?.promotionId).toBe('promo-test-audit');
      expect(totals.appliedPromotion?.discountAmountPaise).toBe(3000);
      expect(totals.appliedPromotion?.eligibilityReason).toContain('First-time customer');
    });

    it('6. Public API /api/promotions/active serves public promotion config safely', async () => {
      await updateSettings({
        deliveryPromotion: {
          id: 'promo-live-public',
          enabled: true,
          title: 'Morning Puja Free Delivery',
          type: 'first_time_customers',
          minOrderAmountPaise: 0,
          bannerWording: '🎉 Free Morning Delivery for your first order!',
          maxQualifyingOrders: 200,
          currentQualifyingOrdersCount: 5,
        },
      });

      const res = await getActivePromoRoute();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.active).toBe(true);
      expect(data.promotion.title).toBe('Morning Puja Free Delivery');
      expect(data.promotion.bannerWording).toContain('Free Morning Delivery');
      // Admin internal counters or sensitive data not leaked
      expect(data.promotion.currentQualifyingOrdersCount).toBeUndefined();
    });
  });

  // ==========================================
  // FEATURE 3: ADMIN CUSTOMER MANAGEMENT
  // ==========================================
  describe('Feature 3: Admin Customer Management & Isolation', () => {
    it('1. GET /api/admin/customers rejects unauthorized requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/customers', {
        headers: {}, // No admin key
      });

      const res = await getCustomersRoute(req);
      expect(res.status).toBe(401);
    });

    it('2. GET /api/admin/customers aggregates customers, completed orders count, and spending in paise', async () => {
      const testPhone = '+919876500001';
      const testUid = 'user-test-cust-001';

      // Seed customer profile
      await saveUserProfile({
        uid: testUid,
        phone: testPhone,
        displayName: 'Smt. Gayatri Devi',
      });

      // Seed delivered order
      await createOrder({
        id: 'MF-CUST-TEST-1',
        customer: {
          uid: testUid,
          phone: testPhone,
          customerName: 'Smt. Gayatri Devi',
          apartmentCommunity: 'My Home Bhooja',
          flatNumber: 'A-402',
          tower: 'Block A',
        },
        items: [
          {
            productId: 'prod-yellow-marigold',
            name: 'Yellow Marigold',
            pricePaise: 4000,
            unit: 'per 250g',
            quantity: 2,
            itemTotalPaise: 8000,
          },
        ],
        orderType: 'one-time',
        subtotalPaise: 8000,
        deliveryFeePaise: 0,
        totalPaise: 8000,
        promotionId: 'promo-welcome',
        discountAmountPaise: 3000,
        eligibilityReason: 'First-time customer promotional free delivery applied.',
        deliverySchedule: { type: 'one-time', date: '2026-12-01', timeSlot: 'morning' },
        orderStatus: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'cod',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/admin/customers', {
        headers: { 'x-admin-key': ADMIN_SECRET_KEY },
      });

      const res = await getCustomersRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.customers)).toBe(true);

      const found = data.customers.find((c: any) => c.phone.includes('9876500001'));
      expect(found).toBeDefined();
      expect(found.name).toBe('Smt. Gayatri Devi');
      expect(found.completedOrdersCount).toBeGreaterThanOrEqual(1);
      expect(found.totalSpendingPaise).toBeGreaterThanOrEqual(8000);
    });

    it('3. GET /api/admin/customers/[id] returns customer detail including addresses, order history & promotion claims', async () => {
      const testPhone = '+919876500001';
      const testUid = 'user-test-cust-001';

      const req = new NextRequest(`http://localhost:3000/api/admin/customers/${testUid}`, {
        headers: { 'x-admin-key': ADMIN_SECRET_KEY },
      });

      const res = await getCustomerDetailRoute(req, {
        params: Promise.resolve({ id: testUid }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.customer).toBeDefined();
      expect(data.customer.name).toBe('Smt. Gayatri Devi');
      expect(data.customer.orders.length).toBeGreaterThanOrEqual(1);

      // Promotion redemption history audit check
      expect(data.customer.promotionRedemptions.length).toBeGreaterThanOrEqual(1);
      const promoAudit = data.customer.promotionRedemptions[0];
      expect(promoAudit.promotionId).toBe('promo-welcome');
      expect(promoAudit.discountAmountPaise).toBe(3000);

      // Address structure check
      expect(data.customer.savedAddresses.length).toBeGreaterThanOrEqual(1);
      const addr = data.customer.savedAddresses[0];
      expect(addr.flatNumber).toBe('A-402');
      expect(addr.apartmentCommunity).toBe('My Home Bhooja');
    });
  });

  // ==========================================
  // FEATURE 4: REPEAT-CUSTOMER EXPERIENCE ("BUY AGAIN")
  // ==========================================
  describe('Feature 4: Repeat Customer Experience ("Buy Again")', () => {
    it('1. Re-evaluates past order against live catalogue: detects price changes accurately', () => {
      // Past order had Jasmine at ₹70 (7000 paise)
      const pastItems: OrderItem[] = [
        {
          productId: 'prod-jasmine',
          name: 'Jasmine Strings (Mallepuvvu)',
          pricePaise: 7000, // Past price
          unit: 'per moora',
          quantity: 2,
          itemTotalPaise: 14000,
        },
      ];

      // Live catalogue has Jasmine at ₹80 (8000 paise)
      const evalResult = evaluateOrderReorder(pastItems, sampleProducts);

      expect(evalResult.canReorder).toBe(true);
      expect(evalResult.itemsAdded).toBe(1);
      expect(evalResult.itemsSkipped).toBe(0);
      expect(evalResult.hasPriceChanges).toBe(true);

      const jasmineRes = evalResult.results[0];
      expect(jasmineRes.priceChanged).toBe(true);
      expect(jasmineRes.oldPricePaise).toBe(7000);
      expect(jasmineRes.newPricePaise).toBe(8000);
      expect(jasmineRes.reason).toContain('market price updated from ₹70 to ₹80');
    });

    it('2. Omits out-of-stock items and warns customer before updating cart', () => {
      const pastItems: OrderItem[] = [
        {
          productId: 'prod-yellow-marigold',
          name: 'Yellow Marigold',
          pricePaise: 4000,
          unit: 'per 250g',
          quantity: 1,
          itemTotalPaise: 4000,
        },
        {
          productId: 'prod-lotus',
          name: 'Red Lotus (Kamalam)',
          pricePaise: 5000,
          unit: 'pair',
          quantity: 1,
          itemTotalPaise: 5000,
        },
      ];

      const evalResult = evaluateOrderReorder(pastItems, sampleProducts);

      expect(evalResult.canReorder).toBe(true);
      expect(evalResult.itemsAdded).toBe(1);
      expect(evalResult.itemsSkipped).toBe(1);
      expect(evalResult.hasOutOfStock).toBe(true);

      const skipped = evalResult.results.find((r) => !r.added);
      expect(skipped).toBeDefined();
      expect(skipped?.name).toContain('Red Lotus');
      expect(skipped?.reason).toContain('out of stock and was skipped');
    });
  });

  // ==========================================
  // FEATURE 1: USER REGISTRATION & PROFILE DEDUPLICATION
  // ==========================================
  describe('Feature 1: User Profile Creation & Deduplication', () => {
    it('1. saveUserProfile updates profile without creating duplicate entries for same UID', async () => {
      const uid = 'cust-dedup-test-999';
      const phone = '+919999888877';

      // First creation
      await saveUserProfile({
        uid,
        phone,
        displayName: 'Initial Name',
      });

      // Second update
      await saveUserProfile({
        uid,
        phone,
        displayName: 'Updated Lakshmi Rao',
      });

      const customer = await getAdminCustomerDetail(uid);
      expect(customer).toBeDefined();
      expect(customer?.name).toBe('Updated Lakshmi Rao');
      expect(customer?.phone).toBe(phone);
    });
  });
});
