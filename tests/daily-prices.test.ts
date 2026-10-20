import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getProducts,
  getAvailableProducts,
  getDailyPricesRecord,
  saveDailyPricesDraft,
  publishDailyPrices,
  createOrder,
  getOrderById,
  _resetDbForTesting,
} from '@/lib/db/store';
import { calculateOrderTotals } from '@/lib/business';
import { DEFAULT_SETTINGS, DAILY_FLOWERS_CONFIG, DAILY_PRICE_PRODUCT_IDS } from '@/lib/config';
import { GET as getPublicDailyPrices } from '@/app/api/daily-prices/route';
import {
  GET as getAdminDailyPrices,
  POST as postAdminDailyPrices,
} from '@/app/api/admin/daily-prices/route';
import { POST as postOrder } from '@/app/api/orders/route';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { Order } from '@/types';

describe('Daily Price Management System', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  it('1. Initializes daily prices for exactly the 6 configured flower varieties', async () => {
    const record = await getDailyPricesRecord();
    expect(record).toBeDefined();
    expect(record.status).toBe('published');
    expect(Object.keys(record.items)).toHaveLength(6);

    for (const flowerId of DAILY_PRICE_PRODUCT_IDS) {
      expect(record.items[flowerId]).toBeDefined();
      expect(record.items[flowerId].pricePaise).toBeGreaterThan(0);
      expect(typeof record.items[flowerId].inStock).toBe('boolean');
      expect(record.items[flowerId].unit).toBeTruthy();
    }

    // Units check: marigolds and chamanthi are per 250g, jasmine and rose are per 100g
    expect(record.items['prod-yellow-marigold'].unit).toBe('per 250g');
    expect(record.items['prod-jasmine'].unit).toBe('per 100g');
    expect(record.items['prod-rose'].unit).toBe('per 100g');
    expect(record.items['prod-chamanthi'].unit).toBe('per 250g');
  });

  it('2. Saves changes as a draft without immediately affecting published catalogue prices', async () => {
    const initialProducts = await getProducts();
    const initialYellow = initialProducts.find((p) => p.id === 'prod-yellow-marigold')!;
    const initialPricePaise = initialYellow.pricePaise;

    // Save a draft with higher price for Yellow Marigold
    const newDraftPricePaise = initialPricePaise + 1500; // + ₹15.00
    const draftRecord = await saveDailyPricesDraft(
      {
        'prod-yellow-marigold': {
          productId: 'prod-yellow-marigold',
          name: 'Yellow Marigold',
          pricePaise: newDraftPricePaise,
          unit: 'per 250g',
          inStock: true,
        },
      },
      'admin@maheshflora.com'
    );

    expect(draftRecord.status).toBe('draft');
    expect(draftRecord.draftSavedAt).toBeDefined();

    // Catalogue products should NOT have changed yet because this was only a draft
    const productsAfterDraft = await getProducts();
    const yellowAfterDraft = productsAfterDraft.find((p) => p.id === 'prod-yellow-marigold')!;
    expect(yellowAfterDraft.pricePaise).toBe(initialPricePaise);
  });

  it('3. Publishes today prices with one action, updating public store and recording publisher/time', async () => {
    const current = await getDailyPricesRecord();
    const updatedItems = { ...current.items };

    // Update prices for festival morning
    updatedItems['prod-yellow-marigold'] = {
      ...updatedItems['prod-yellow-marigold'],
      pricePaise: 6500, // ₹65.00
      unit: 'per 250g',
      inStock: true,
    };
    updatedItems['prod-jasmine'] = {
      ...updatedItems['prod-jasmine'],
      pricePaise: 9000, // ₹90.00
      unit: 'per 100g',
      inStock: true,
    };
    // Mark mixed marigold out of stock for today
    updatedItems['prod-mixed-marigold'] = {
      ...updatedItems['prod-mixed-marigold'],
      inStock: false,
    };

    const publishedRecord = await publishDailyPrices(updatedItems, 'Mahesh Admin');

    expect(publishedRecord.status).toBe('published');
    expect(publishedRecord.publishedBy).toBe('Mahesh Admin');
    expect(publishedRecord.publishedAt).toBeDefined();

    // Verify products store received the update
    const publicProducts = await getProducts();
    const yellow = publicProducts.find((p) => p.id === 'prod-yellow-marigold')!;
    expect(yellow.pricePaise).toBe(6500);

    const jasmine = publicProducts.find((p) => p.id === 'prod-jasmine')!;
    expect(jasmine.pricePaise).toBe(9000);

    const mixed = publicProducts.find((p) => p.id === 'prod-mixed-marigold')!;
    expect(mixed.inStock).toBe(false);

    // Available products must now exclude the out-of-stock mixed marigold
    const available = await getAvailableProducts();
    expect(available.find((p) => p.id === 'prod-mixed-marigold')).toBeUndefined();
  });

  it('4. Rejects negative prices and invalid numbers during publication', async () => {
    const current = await getDailyPricesRecord();
    const invalidItems = {
      ...current.items,
      'prod-rose': {
        ...current.items['prod-rose'],
        pricePaise: -500, // Negative price
      },
    };

    await expect(publishDailyPrices(invalidItems, 'Admin')).rejects.toThrow(
      /cannot be negative or invalid/
    );
  });

  it('5. Public API (/api/daily-prices) serves current published prices', async () => {
    const res = await getPublicDailyPrices();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.dailyPrices).toBeDefined();
    expect(Object.keys(data.dailyPrices.items)).toHaveLength(6);
  });

  it('6. Admin API (/api/admin/daily-prices) rejects unauthorized requests', async () => {
    // Unauthenticated GET
    const reqGetUnauth = new NextRequest('http://localhost:3000/api/admin/daily-prices');
    const resGetUnauth = await getAdminDailyPrices(reqGetUnauth);
    expect(resGetUnauth.status).toBe(401);

    // Unauthenticated POST
    const reqPostUnauth = new NextRequest('http://localhost:3000/api/admin/daily-prices', {
      method: 'POST',
      body: JSON.stringify({ action: 'draft', items: {} }),
    });
    const resPostUnauth = await postAdminDailyPrices(reqPostUnauth);
    expect(resPostUnauth.status).toBe(401);

    // Authenticated GET with x-admin-key header
    const reqGetAuth = new NextRequest('http://localhost:3000/api/admin/daily-prices', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const resGetAuth = await getAdminDailyPrices(reqGetAuth);
    expect(resGetAuth.status).toBe(200);
    const data = await resGetAuth.json();
    expect(data.success).toBe(true);
    expect(data.record).toBeDefined();
  });

  it('7. Admin API POST validates inputs and enforces non-negative prices', async () => {
    const current = await getDailyPricesRecord();

    // Send negative price
    const reqNegative = new NextRequest('http://localhost:3000/api/admin/daily-prices', {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'draft',
        items: {
          'prod-rose': {
            ...current.items['prod-rose'],
            pricePaise: -200,
          },
        },
      }),
    });
    const resNegative = await postAdminDailyPrices(reqNegative);
    expect(resNegative.status).toBe(400);
    const negData = await resNegative.json();
    expect(negData.error).toContain('cannot be negative');
  });

  it('8. Past orders snapshot is immutable when daily prices change', async () => {
    // 1. Create a historical order with Yellow Marigold at ₹40 (4000 paise)
    const orderId = 'MF-TEST-HISTORICAL-01';
    const pastOrder: Order = {
      id: orderId,
      customer: {
        customerName: 'Ramesh Rao',
        phone: '+919876543210',
        apartmentCommunity: 'My Home Bhooja',
        buildingTower: 'Block A',
        flatNumber: '802',
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
      deliveryFeePaise: 3000,
      totalPaise: 11000,
      deliverySchedule: { type: 'one-time', date: '2026-10-18', timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: '2026-10-18T06:00:00.000Z',
      updatedAt: '2026-10-18T06:00:00.000Z',
    };
    await createOrder(pastOrder);

    // 2. Change daily market price for Yellow Marigold to ₹80 (8000 paise)
    const current = await getDailyPricesRecord();
    const updated = { ...current.items };
    updated['prod-yellow-marigold'] = {
      ...updated['prod-yellow-marigold'],
      pricePaise: 8000,
    };
    await publishDailyPrices(updated, 'Admin');

    // 3. Verify that historical order remains completely untouched
    const retrievedPastOrder = await getOrderById(orderId);
    expect(retrievedPastOrder).toBeDefined();
    expect(retrievedPastOrder!.items[0].pricePaise).toBe(4000);
    expect(retrievedPastOrder!.subtotalPaise).toBe(8000);
    expect(retrievedPastOrder!.totalPaise).toBe(11000);
  });

  it('9. Order submission detects price updates (409 Conflict) and allows confirmation', async () => {
    // 1. Current price of Jasmine is ₹70 (7000 paise)
    const current = await getDailyPricesRecord();
    const updated = { ...current.items };
    updated['prod-jasmine'] = {
      ...updated['prod-jasmine'],
      pricePaise: 7000,
    };
    await publishDailyPrices(updated, 'Admin');

    // 2. Customer attempts to submit with old expected subtotal of ₹50 (5000 paise)
    const reqWithOldPrice = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-uid': 'cust_sunita',
        'x-customer-phone': '9876543210',
      },
      body: JSON.stringify({
        customer: {
          customerName: 'Sunita Reddy',
          phone: '9876543210',
          apartmentCommunity: 'Aparna Serene Park',
          buildingTower: 'Tower 4',
          flatNumber: '1201',
        },
        items: [{ productId: 'prod-jasmine', quantity: 1 }],
        expectedSubtotalPaise: 5000, // Outdated price in customer cart
        confirmPriceChange: false,
        deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
        paymentMethod: 'whatsapp_upi',
      }),
    });

    const resConflict = await postOrder(reqWithOldPrice);
    expect(resConflict.status).toBe(409);
    const conflictData = await resConflict.json();
    expect(conflictData.code).toBe('PRICE_CHANGED');
    expect(conflictData.currentSubtotalPaise).toBe(7000);
    expect(conflictData.previousSubtotalPaise).toBe(5000);

    // 3. Customer confirms the updated market price and resubmits
    const reqWithConfirmedPrice = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-uid': 'cust_sunita',
        'x-customer-phone': '9876543210',
      },
      body: JSON.stringify({
        customer: {
          customerName: 'Sunita Reddy',
          phone: '9876543210',
          apartmentCommunity: 'Aparna Serene Park',
          buildingTower: 'Tower 4',
          flatNumber: '1201',
        },
        items: [{ productId: 'prod-jasmine', quantity: 1 }],
        expectedSubtotalPaise: 5000,
        confirmPriceChange: true, // User confirmed
        deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
        paymentMethod: 'whatsapp_upi',
      }),
    });

    const resSuccess = await postOrder(reqWithConfirmedPrice);
    expect(resSuccess.status).toBe(200);
    const successData = await resSuccess.json();
    expect(successData.success).toBe(true);
    expect(successData.order.subtotalPaise).toBe(7000);
    expect(successData.order.items[0].pricePaise).toBe(7000);
  });
});
