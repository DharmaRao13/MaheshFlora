import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  _resetDbForTesting,
  saveStallEntry,
  getStallEntries,
  getStallEntryById,
  getStallEntryByDate,
  deleteStallEntry,
  createOrder,
  createExpense,
} from '@/lib/db/store';
import { computeAnalyticsSummary, generateAnalyticsCSV, mapProductToStallCategory } from '@/lib/analytics';
import { calculateDateRange } from '@/lib/dateUtils';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { GET as getStallEntriesRoute, POST as postStallEntriesRoute } from '@/app/api/admin/stall/entries/route';
import { GET as getAnalyticsRoute } from '@/app/api/admin/analytics/route';
import { GET as getAnalyticsExportRoute } from '@/app/api/admin/analytics/export/route';
import { Order, Expense, StallDailyEntry } from '@/types';

describe('Stall Management & Complete Three-Way Analytics Dashboard', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  const createAdminHeaders = (key = ADMIN_SECRET_KEY) => ({
    'x-admin-key': key,
    'Content-Type': 'application/json',
  });

  // ==================== 1. STALL CRUD, CALCULATIONS & CONSTRAINTS ====================

  it('1. Rejects unauthorized access to stall entries API', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stall/entries');
    const res = await getStallEntriesRoute(req);
    expect(res.status).toBe(401);
  });

  it('2. Calculates total flower sales accurately by category and validates non-negative numbers', async () => {
    const entry = await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: {
          jasminePaise: 450000, // ₹4,500
          marigoldPaise: 320000, // ₹3,200
          mixedFlowersPaise: 180000, // ₹1,800
          otherFlowersPaise: 150000, // ₹1,500
        },
        collections: {
          cashPaise: 600000, // ₹6,000
          upiPaise: 500000, // ₹5,000
          otherPaise: 0,
        },
        expenses: {
          flowerPurchasePaise: 500000, // ₹5,000
          transportPaise: 80000, // ₹800
          packagingPaise: 40000, // ₹400
          otherPaise: 30000, // ₹300
        },
        status: 'finalized',
      },
      'admin@maheshflora.com'
    );

    // Sales: 4500 + 3200 + 1800 + 1500 = 11,000 = 1,100,000 paise
    expect(entry.totalSalesPaise).toBe(1100000);
    // Collections: 6000 + 5000 = 11,000 = 1,100,000 paise (balanced)
    expect(entry.totalCollectionsPaise).toBe(1100000);
    expect(entry.reconciliationDifferencePaise).toBe(0);
    // Expenses: 5000 + 800 + 400 + 300 = 6,500 = 650,000 paise
    expect(entry.totalExpensesPaise).toBe(650000);
    // Preliminary Operating Result: 11,000 - 6,500 = 4,500 = 450,000 paise
    expect(entry.preliminaryOperatingResultPaise).toBe(450000);

    // Test rejection of negative inputs
    await expect(
      saveStallEntry(
        {
          stallId: 'main',
          date: '2026-10-25',
          flowerSales: {
            jasminePaise: -500,
            marigoldPaise: 0,
            mixedFlowersPaise: 0,
            otherFlowersPaise: 0,
          },
          collections: { cashPaise: 0, upiPaise: 0, otherPaise: 0 },
          expenses: { flowerPurchasePaise: 0, transportPaise: 0, packagingPaise: 0, otherPaise: 0 },
        },
        'admin@maheshflora.com'
      )
    ).rejects.toThrow(/non-negative number/i);
  });

  it('3. Enforces cash and UPI reconciliation: fails without acknowledgement and passes with reason', async () => {
    // Mismatch without acknowledgement: Sales ₹5,000 vs Collections ₹4,800
    await expect(
      saveStallEntry(
        {
          stallId: 'main',
          date: '2026-10-24',
          flowerSales: {
            jasminePaise: 500000,
            marigoldPaise: 0,
            mixedFlowersPaise: 0,
            otherFlowersPaise: 0,
          },
          collections: {
            cashPaise: 480000, // ₹200 shortage
            upiPaise: 0,
            otherPaise: 0,
          },
          expenses: { flowerPurchasePaise: 0, transportPaise: 0, packagingPaise: 0, otherPaise: 0 },
          reconciliationAcknowledged: false,
        },
        'admin@maheshflora.com'
      )
    ).rejects.toThrow(/Please verify collections or acknowledge with a reason/i);

    // Mismatch WITH explicit acknowledgement and reason passes
    const acknowledgedEntry = await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: {
          jasminePaise: 500000,
          marigoldPaise: 0,
          mixedFlowersPaise: 0,
          otherFlowersPaise: 0,
        },
        collections: {
          cashPaise: 480000,
          upiPaise: 0,
          otherPaise: 0,
        },
        expenses: { flowerPurchasePaise: 0, transportPaise: 0, packagingPaise: 0, otherPaise: 0 },
        reconciliationAcknowledged: true,
        reconciliationReason: 'Temple bulk order rounded down by ₹200; balance settled via puja donation',
      },
      'admin@maheshflora.com'
    );

    expect(acknowledgedEntry.reconciliationDifferencePaise).toBe(-20000);
    expect(acknowledgedEntry.reconciliationAcknowledged).toBe(true);
  });

  it('4. Enforces canonical 1 record per stall and business date, prevents duplicates and tracks audit history', async () => {
    // Initial entry creation
    const v1 = await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: { jasminePaise: 100000, marigoldPaise: 100000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
        collections: { cashPaise: 200000, upiPaise: 0, otherPaise: 0 },
        expenses: { flowerPurchasePaise: 80000, transportPaise: 0, packagingPaise: 0, otherPaise: 0 },
        status: 'draft',
      },
      'admin@maheshflora.com',
      'Initial morning record'
    );

    expect(v1.version).toBe(1);
    expect(v1.auditHistory.length).toBe(1);
    expect(v1.auditHistory[0].action).toBe('created');

    // Updating the same stall + date edits the existing record instead of creating duplicate
    const v2 = await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: { jasminePaise: 150000, marigoldPaise: 100000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
        collections: { cashPaise: 250000, upiPaise: 0, otherPaise: 0 },
        expenses: { flowerPurchasePaise: 80000, transportPaise: 20000, packagingPaise: 0, otherPaise: 0 },
        status: 'finalized',
        expectedVersion: 1,
      },
      'admin@maheshflora.com',
      'Evening final reconciliation with added evening jasmine sales'
    );

    expect(v2.version).toBe(2);
    expect(v2.id).toBe('STALL-main-2026-10-24');
    expect(v2.auditHistory.length).toBe(2);
    expect(v2.auditHistory[0].action).toBe('finalized');
    expect(v2.auditHistory[0].reason).toContain('added evening jasmine sales');

    // Ensure database still contains only 1 entry for this date
    const all = await getStallEntries({ fromDate: '2026-10-24', toDate: '2026-10-24' });
    expect(all.length).toBe(1);

    // Concurrency conflict test: saving with outdated expectedVersion throws
    await expect(
      saveStallEntry(
        {
          stallId: 'main',
          date: '2026-10-24',
          flowerSales: { jasminePaise: 150000, marigoldPaise: 100000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
          collections: { cashPaise: 250000, upiPaise: 0, otherPaise: 0 },
          expenses: { flowerPurchasePaise: 80000, transportPaise: 20000, packagingPaise: 0, otherPaise: 0 },
          expectedVersion: 1, // Stale version! (current is 2)
        },
        'concurrent_admin@maheshflora.com'
      )
    ).rejects.toThrow(/concurrency error/i);
  });

  // ==================== 2. THREE-WAY ANALYTICS ISOLATION & RECONCILIATION ====================

  it('5. Strictly isolates Stall Analysis from online orders, subscriptions, and online expenses', async () => {
    // 1 Stall entry
    await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: { jasminePaise: 500000, marigoldPaise: 300000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
        collections: { cashPaise: 400000, upiPaise: 400000, otherPaise: 0 },
        expenses: { flowerPurchasePaise: 350000, transportPaise: 50000, packagingPaise: 0, otherPaise: 0 },
        status: 'finalized',
      },
      'admin@maheshflora.com'
    );

    // 1 Online order
    await createOrder({
      customer: { uid: 'user-1', customerName: 'Ramesh K', phone: '+919876543210' },
      items: [
        {
          productId: 'prod-jasmine',
          name: 'Fresh Jasmine String',
          category: 'fragrant',
          pricePaise: 15000,
          quantity: 2,
        },
      ],
      deliveryAddress: {
        customerName: 'Ramesh K',
        phone: '+919876543210',
        flatNumber: 'A-102',
        apartmentCommunity: 'Aparna Towers',
        locality: 'Kondapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500084',
      },
      subtotalPaise: 30000,
      deliveryFeePaise: 0,
      totalPaise: 30000,
      paymentMethod: 'whatsapp_upi',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      createdAt: '2026-10-24T06:00:00.000Z',
    });

    const dateRange = calculateDateRange('today', '2026-10-24', '2026-10-24');
    const stallEntries = await getStallEntries({ fromDate: '2026-10-24', toDate: '2026-10-24' });

    // Compute Stall Analysis
    const stallAnalysis = computeAnalyticsSummary({
      orders: [],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [],
      stallEntries,
      products: [],
      dateRange,
      view: 'stall',
    });

    expect(stallAnalysis.view).toBe('stall');
    // Stall sales = 800,000 paise (₹8,000)
    expect(stallAnalysis.kpis.grossSalesPaise.value).toBe(800000);
    // Stall collections = 800,000 paise (₹8,000)
    expect(stallAnalysis.kpis.netRevenuePaise.value).toBe(800000);
    // Stall expenses = 400,000 paise (₹4,000)
    expect(stallAnalysis.kpis.totalExpensesPaise.value).toBe(400000);
    // Stall operating result = 400,000 paise (₹4,000)
    expect(stallAnalysis.kpis.netProfitPaise.value).toBe(400000);
    // Zero online orders in stall analysis
    expect(stallAnalysis.recentOrders.length).toBe(0);
  });

  it('6. Strictly isolates Online Analysis from manual stall entries', async () => {
    // 1 Stall entry
    await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: { jasminePaise: 500000, marigoldPaise: 300000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
        collections: { cashPaise: 400000, upiPaise: 400000, otherPaise: 0 },
        expenses: { flowerPurchasePaise: 350000, transportPaise: 50000, packagingPaise: 0, otherPaise: 0 },
        status: 'finalized',
      },
      'admin@maheshflora.com'
    );

    // 1 Online order
    const order = await createOrder({
      customer: { uid: 'user-2', customerName: 'Sita M', phone: '+919876543211' },
      items: [
        {
          productId: 'prod-yellow-marigold',
          name: 'Yellow Marigold Garland',
          category: 'garlands',
          pricePaise: 25000,
          quantity: 2,
        },
      ],
      deliveryAddress: {
        customerName: 'Sita M',
        phone: '+919876543211',
        flatNumber: 'B-201',
        apartmentCommunity: 'My Home Bhooja',
        locality: 'Hitec City',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      },
      subtotalPaise: 50000,
      deliveryFeePaise: 0,
      totalPaise: 50000,
      paymentMethod: 'whatsapp_upi',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      createdAt: '2026-10-24T07:00:00.000Z',
    });

    const dateRange = calculateDateRange('today', '2026-10-24', '2026-10-24');
    const stallEntries = await getStallEntries({ fromDate: '2026-10-24', toDate: '2026-10-24' });

    // Compute Online Analysis (even when stallEntries are passed, view: 'online' must omit them)
    const onlineAnalysis = computeAnalyticsSummary({
      orders: [order],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [],
      stallEntries,
      products: [],
      dateRange,
      view: 'online',
    });

    expect(onlineAnalysis.view).toBe('online');
    // Online gross sales: exactly ₹500 (50,000 paise)
    expect(onlineAnalysis.kpis.grossSalesPaise.value).toBe(50000);
    expect(onlineAnalysis.kpis.totalOrdersCount.value).toBe(1);
    // Stall sales must NOT be included in online analysis
    expect(onlineAnalysis.kpis.grossSalesPaise.value).not.toBe(850000);
  });

  it('7. Combines Stall and Online channels without double-counting sales, collections, or expenses', async () => {
    // 1 Stall entry: Sales ₹8,000, Collections ₹8,000 (Cash ₹4,000, UPI ₹4,000), Expenses ₹4,000
    const stall = await saveStallEntry(
      {
        stallId: 'main',
        date: '2026-10-24',
        flowerSales: { jasminePaise: 500000, marigoldPaise: 300000, mixedFlowersPaise: 0, otherFlowersPaise: 0 },
        collections: { cashPaise: 400000, upiPaise: 400000, otherPaise: 0 },
        expenses: { flowerPurchasePaise: 350000, transportPaise: 50000, packagingPaise: 0, otherPaise: 0 },
        status: 'finalized',
      },
      'admin@maheshflora.com'
    );

    // 1 Online Paid COD order: ₹600 (Cash collections ₹600)
    const orderCOD = await createOrder({
      id: 'test-order-cod-7',
      customer: { uid: 'user-3', customerName: 'Lakshmi G', phone: '+919876543212' },
      items: [
        {
          productId: 'prod-jasmine',
          name: 'Fresh Jasmine String',
          category: 'fragrant',
          pricePaise: 30000,
          quantity: 2,
        },
      ],
      deliveryAddress: {
        customerName: 'Lakshmi G',
        phone: '+919876543212',
        flatNumber: 'C-303',
        apartmentCommunity: 'Rainbow Vistas',
        locality: 'Moosapet',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500018',
      },
      subtotalPaise: 60000,
      deliveryFeePaise: 0,
      totalPaise: 60000,
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      createdAt: '2026-10-24T05:30:00.000Z',
    });

    // 1 Online Paid UPI order: ₹400 (UPI collections ₹400)
    const orderUPI = await createOrder({
      id: 'test-order-upi-7',
      customer: { uid: 'user-4', customerName: 'Vijay V', phone: '+919876543213' },
      items: [
        {
          productId: 'prod-yellow-marigold',
          name: 'Yellow Marigold Garland',
          category: 'garlands',
          pricePaise: 20000,
          quantity: 2,
        },
      ],
      deliveryAddress: {
        customerName: 'Vijay V',
        phone: '+919876543213',
        flatNumber: 'D-404',
        apartmentCommunity: 'Jayabheri Silicon',
        locality: 'Gachibowli',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500032',
      },
      subtotalPaise: 40000,
      deliveryFeePaise: 0,
      totalPaise: 40000,
      paymentMethod: 'whatsapp_upi',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      createdAt: '2026-10-24T06:15:00.000Z',
    });

    // Online delivery transport expense: ₹200 (20,000 paise)
    const onlineExpense = await createExpense({
      date: '2026-10-24',
      category: 'transport',
      amountPaise: 20000,
      description: 'Morning Gachibowli gated community delivery fuel',
      channel: 'online',
      createdBy: 'admin@maheshflora.com',
    });

    const dateRange = calculateDateRange('today', '2026-10-24', '2026-10-24');

    // Compute Combined Analysis
    const combined = computeAnalyticsSummary({
      orders: [orderCOD, orderUPI],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [onlineExpense],
      stallEntries: [stall],
      products: [],
      dateRange,
      view: 'combined',
    });

    expect(combined.view).toBe('combined');

    // Total Business Sales = Stall (₹8,000) + Online (₹600 + ₹400 = ₹1,000) = ₹9,000 = 900,000 paise
    expect(combined.kpis.grossSalesPaise.value).toBe(900000);
    expect(combined.combinedKPIs?.totalBusinessSalesPaise.value).toBe(900000);
    expect(combined.combinedKPIs?.stallSalesPaise.value).toBe(800000);
    expect(combined.combinedKPIs?.onlineSalesPaise.value).toBe(100000);

    // Total Cash Collections = Stall Cash (₹4,000) + Online COD Paid (₹600) = ₹4,600 = 460,000 paise
    expect(combined.combinedKPIs?.totalCashCollectionsPaise.value).toBe(460000);

    // Total UPI Collections = Stall UPI (₹4,000) + Online UPI Paid (₹400) = ₹4,400 = 440,000 paise
    expect(combined.combinedKPIs?.totalUpiCollectionsPaise.value).toBe(440000);

    // Net Collected Revenue = ₹4,600 + ₹4,400 = ₹9,000 = 900,000 paise
    expect(combined.kpis.netRevenuePaise.value).toBe(900000);

    // Total Business Expenses = Stall Expenses (₹4,000) + Online Expense (₹200) = ₹4,200 = 420,000 paise
    expect(combined.kpis.totalExpensesPaise.value).toBe(420000);

    // Combined Operating Result = Sales (₹9,000) - Expenses (₹4,200) = ₹4,800 = 480,000 paise
    expect(combined.kpis.netProfitPaise.value).toBe(480000);

    // Channel Contribution
    expect(combined.channelContribution?.stallPercentage).toBe(88.9);
    expect(combined.channelContribution?.onlinePercentage).toBe(11.1);

    // Flower Category mapping
    expect(mapProductToStallCategory('prod-jasmine', 'Fresh Jasmine')).toBe('jasmine');
    expect(mapProductToStallCategory('prod-marigold', 'Yellow Marigold')).toBe('marigold');
    expect(mapProductToStallCategory('prod-mixed', 'Loose Petals Mix')).toBe('mixed');

    // Sanitized CSV generation
    const csv = generateAnalyticsCSV({
      summary: combined,
      orders: [orderCOD, orderUPI],
      expenses: [onlineExpense],
      stallEntries: [stall],
    });

    expect(csv).toContain('Consolidated Business Analysis');
    expect(csv).toContain('Stall Sales');
    expect(csv).toContain('Online Sales');
    // Ensure customer phone numbers and addresses are strictly omitted
    expect(csv).not.toContain('+919876543212');
    expect(csv).not.toContain('Rainbow Vistas');
  });
});
