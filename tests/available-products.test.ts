import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getAvailableProducts, getProducts, _resetDbForTesting } from '@/lib/db/store';
import { calculateOrderTotals } from '@/lib/business';
import { DEFAULT_SETTINGS } from '@/lib/config';

describe('Six Available Flowers & Catalogue Verification', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  it('Customer-facing catalogue returns exactly the 6 specified products with exact names', async () => {
    const available = await getAvailableProducts();
    expect(available).toHaveLength(6);

    const expectedNames = [
      'Yellow Marigold',
      'Orange Marigold',
      'Mixed Marigold',
      'Jasmine',
      'Rose',
      'Chamanthi',
    ];

    const names = available.map((p) => p.name);
    for (const expected of expectedNames) {
      expect(names).toContain(expected);
    }

    // Verify "(Chrysanthemum)" is nowhere in product names
    for (const p of available) {
      expect(p.name).not.toContain('Chrysanthemum');
      expect(p.name).not.toContain('(Chrysanthemum)');
    }
  });

  it('Every product has a valid, existing local image file in public/images', async () => {
    const available = await getAvailableProducts();
    for (const product of available) {
      expect(product.imageUrl).toMatch(/^\/images\/[a-z0-9-]+\.jpg$/);

      const diskPath = path.join(process.cwd(), 'public', product.imageUrl);
      expect(fs.existsSync(diskPath)).toBe(true);

      const stats = fs.statSync(diskPath);
      expect(stats.size).toBeGreaterThan(10000); // High quality local image
    }
  });

  it('Homepage hero image exists locally and has non-trivial file size', () => {
    const heroPng = path.join(process.cwd(), 'public', 'images', 'mahesh-flora-hero.png');
    expect(fs.existsSync(heroPng)).toBe(true);
    const stats = fs.statSync(heroPng);
    expect(stats.size).toBeGreaterThan(50000);
  });

  it('Each of the 6 products can be added to the cart and calculates correctly without error', async () => {
    const available = await getAvailableProducts();
    const allProducts = await getProducts();

    for (const product of available) {
      const cart = [{ productId: product.id, quantity: 2 }];
      const result = calculateOrderTotals(cart, allProducts, DEFAULT_SETTINGS);

      expect(result.error).toBeUndefined();
      expect(result.orderItems).toHaveLength(1);
      expect(result.orderItems[0].productId).toBe(product.id);
      expect(result.orderItems[0].name).toBe(product.name);
      expect(result.orderItems[0].quantity).toBe(2);
      expect(result.subtotalPaise).toBe(product.pricePaise * 2);
    }
  });

  it('Historical / unavailable products remain in database but have inStock: false', async () => {
    const allProducts = await getProducts();
    const available = await getAvailableProducts();

    expect(allProducts.length).toBeGreaterThan(available.length);
    const unavailable = allProducts.filter((p) => !p.inStock);
    expect(unavailable.length).toBeGreaterThanOrEqual(8);

    // Cart calculation should reject out-of-stock products
    const inactive = unavailable[0];
    const cart = [{ productId: inactive.id, quantity: 1 }];
    const result = calculateOrderTotals(cart, allProducts, DEFAULT_SETTINGS);
    expect(result.error).toContain('is currently out of stock');
  });
});
