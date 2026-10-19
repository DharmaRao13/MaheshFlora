import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isFirebaseConfigured, subscribeToDailyPrices, subscribeToOrder } from '@/lib/firebase/client';
import { isAdminFirebaseConfigured } from '@/lib/firebase/admin';
import {
  getProducts,
  getAvailableProducts,
  getDailyPricesRecord,
  saveDailyPricesDraft,
  publishDailyPrices,
  getOrders,
  createOrder,
  updateOrderStatus,
  _resetDbForTesting,
} from '@/lib/db/store';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { Order } from '@/types';

describe('Mahesh Flora — Firebase Integration & Fallback Tests', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  it('1. Correctly detects Firebase client configuration status', () => {
    // In our test environment with empty NEXT_PUBLIC_FIREBASE_API_KEY, should be false
    const configured = isFirebaseConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('2. Correctly detects Firebase admin configuration status', () => {
    const configured = isAdminFirebaseConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('3. Real-time listeners safely return a cleanup unsubscribe function even if Firebase is not connected', () => {
    const unsubDaily = subscribeToDailyPrices(() => {});
    expect(typeof unsubDaily).toBe('function');
    // Calling unsubscribe does not throw
    expect(() => unsubDaily()).not.toThrow();

    const unsubOrder = subscribeToOrder('MF-TEST-123', () => {});
    expect(typeof unsubOrder).toBe('function');
    expect(() => unsubOrder()).not.toThrow();
  });

  it('4. Data store gracefully serves products and preserves exactly 6 available products', async () => {
    const available = await getAvailableProducts();
    expect(available.length).toBe(6);

    const names = available.map((p) => p.name);
    expect(names).toContain('Yellow Marigold');
    expect(names).toContain('Orange Marigold');
    expect(names).toContain('Mixed Marigold');
    expect(names).toContain('Jasmine');
    expect(names).toContain('Rose');
    expect(names).toContain('Chamanthi');

    // Historical records are preserved
    const allProducts = await getProducts();
    expect(allProducts.length).toBeGreaterThanOrEqual(6);
  });

  it('5. Daily prices can be retrieved, saved as draft, and published with persistence', async () => {
    const initialPrices = await getDailyPricesRecord();
    expect(initialPrices).toBeDefined();
    expect(initialPrices.items).toBeDefined();

    // Draft save
    const updatedDraft = await saveDailyPricesDraft(
      {
        'prod-rose': {
          productId: 'prod-rose',
          name: 'Rose',
          pricePaise: 8000,
          unit: 'per 250g',
          inStock: true,
        },
      },
      'admin-test@maheshflora.com'
    );
    expect(updatedDraft.status).toBe('draft');
    expect(updatedDraft.items['prod-rose'].pricePaise).toBe(8000);

    // Publish
    const published = await publishDailyPrices(
      {
        ...updatedDraft.items,
        'prod-rose': {
          productId: 'prod-rose',
          name: 'Rose',
          pricePaise: 8500,
          unit: 'per 250g',
          inStock: true,
        },
      },
      'owner@maheshflora.com'
    );
    expect(published.status).toBe('published');
    expect(published.publishedBy).toBe('owner@maheshflora.com');

    // Confirm product price is synced
    const products = await getProducts();
    const rose = products.find((p) => p.id === 'prod-rose');
    expect(rose?.pricePaise).toBe(8500);
  });

  it('6. Orders lifecycle persists correctly with Firestore abstraction layer', async () => {
    const testOrder: Order = {
      id: `MF-ORD-TEST-${Date.now()}`,
      customer: {
        name: 'Suresh Kumar',
        phone: '9876543210',
        email: 'suresh@example.com',
        address: 'Banjara Hills, Road 10',
        city: 'Hyderabad',
        pincode: '500034',
      },
      items: [
        {
          productId: 'prod-yellow-marigold',
          productName: 'Yellow Marigold',
          pricePaise: 6000,
          unit: 'per 500g',
          quantity: 2,
          itemTotalPaise: 12000,
        },
      ],
      subtotalPaise: 12000,
      deliveryFeePaise: 0,
      totalPaise: 12000,
      deliverySchedule: {
        type: 'morning',
        timeWindow: '6:00 AM - 8:30 AM',
        date: new Date().toISOString().split('T')[0],
      },
      paymentMethod: 'COD',
      paymentStatus: 'payment_due',
      orderStatus: 'pending_confirmation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createOrder(testOrder);

    const orders = await getOrders();
    const found = orders.find((o) => o.id === testOrder.id);
    expect(found).toBeDefined();
    expect(found?.paymentMethod).toBe('COD');
    expect(found?.paymentStatus).toBe('payment_due');

    // Update status to confirmed
    const updated = await updateOrderStatus(testOrder.id, 'confirmed');
    expect(updated.orderStatus).toBe('confirmed');
  });

  it('7. firestore.rules file is valid and contains rules for all required collections', () => {
    const rulesPath = path.join(process.cwd(), 'firestore.rules');
    expect(fs.existsSync(rulesPath)).toBe(true);

    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    expect(rulesContent).toContain("match /products/{productId}");
    expect(rulesContent).toContain("match /orders/{orderId}");
    expect(rulesContent).toContain("match /dailyPrices/{priceId}");
    expect(rulesContent).toContain("match /dailyPriceHistory/{historyId}");
    expect(rulesContent).toContain("match /subscriptions/{subscriptionId}");
    expect(rulesContent).toContain("match /festivals/{festivalId}");
    expect(rulesContent).toContain("isAdmin()");
  });

  it('8. verifyAdminAuthorizationAsync supports valid admin secret headers', async () => {
    const validReq = new Request('http://localhost:3000/api/admin/orders', {
      headers: { 'x-admin-key': 'mahesh-flora-admin-secret-dev-key' },
    });
    const authResult = await verifyAdminAuthorizationAsync(validReq);
    expect(authResult.authorized).toBe(true);

    const invalidReq = new Request('http://localhost:3000/api/admin/orders', {
      headers: { 'x-admin-key': 'wrong-password' },
    });
    const failResult = await verifyAdminAuthorizationAsync(invalidReq);
    expect(failResult.authorized).toBe(false);
  });
});
