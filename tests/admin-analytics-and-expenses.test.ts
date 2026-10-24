import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _resetDbForTesting, createOrder, createExpense } from '@/lib/db/store';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { calculateDateRange, toISTDateString, addDaysToDateString } from '@/lib/dateUtils';
import { computeAnalyticsSummary, generateAnalyticsCSV } from '@/lib/analytics';
import { GET as getAnalyticsRoute } from '@/app/api/admin/analytics/route';
import { GET as exportAnalyticsRoute } from '@/app/api/admin/analytics/export/route';
import { GET as getExpensesRoute, POST as createExpenseRoute } from '@/app/api/admin/expenses/route';
import { PUT as updateExpenseRoute, DELETE as deleteExpenseRoute } from '@/app/api/admin/expenses/[id]/route';
import { Order, Product, Expense } from '@/types';

describe('Mahesh Flora Admin Analysis Dashboard & Expense Management', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  const testProducts: Product[] = [
    {
      id: 'prod-yellow-marigold',
      name: 'Yellow Marigold (Banthi)',
      category: 'daily-puja',
      pricePaise: 4000,
      unit: '250g',
      description: 'Fresh flowers',
      imageUrl: '',
      inStock: true,
    },
    {
      id: 'prod-jasmine',
      name: 'Jasmine (Mallepulu)',
      category: 'fragrant',
      pricePaise: 6000,
      unit: '100g',
      description: 'Fragrant flowers',
      imageUrl: '',
      inStock: true,
    },
  ];

  // 1. Authorization tests
  it('1. Rejects unauthorized access on analytics and expenses endpoints with 401', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/admin/analytics');
    const res1 = await getAnalyticsRoute(unauthReq);
    expect(res1.status).toBe(401);

    const exportReq = new NextRequest('http://localhost:3000/api/admin/analytics/export');
    const res2 = await exportAnalyticsRoute(exportReq);
    expect(res2.status).toBe(401);

    const expReq = new NextRequest('http://localhost:3000/api/admin/expenses');
    const res3 = await getExpensesRoute(expReq);
    expect(res3.status).toBe(401);

    const createExpReq = new NextRequest('http://localhost:3000/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-10-24',
        category: 'flower_purchase',
        amountRupees: 1000,
        description: 'Test purchase',
      }),
    });
    const res4 = await createExpenseRoute(createExpReq);
    expect(res4.status).toBe(401);

    // Authorized request with x-admin-key succeeds
    const authReq = new NextRequest('http://localhost:3000/api/admin/analytics?preset=today', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const authRes = await getAnalyticsRoute(authReq);
    expect(authRes.status).toBe(200);
    const authData = await authRes.json();
    expect(authData.success).toBe(true);
    expect(authData.summary).toBeDefined();
  });

  // 2. IST Date Range Presets and Boundaries
  it('2. Correctly calculates date ranges and previous comparison periods in Asia/Kolkata timezone', () => {
    // Test with a deterministic fixed date
    const fixedDate = new Date('2026-10-24T10:00:00+05:30');

    const todayRange = calculateDateRange('today', undefined, undefined, fixedDate);
    expect(todayRange.fromDate).toBe('2026-10-24');
    expect(todayRange.toDate).toBe('2026-10-24');
    expect(todayRange.previousFromDate).toBe('2026-10-23');
    expect(todayRange.previousToDate).toBe('2026-10-23');
    expect(todayRange.durationDays).toBe(1);

    const last7Range = calculateDateRange('last_7_days', undefined, undefined, fixedDate);
    expect(last7Range.fromDate).toBe('2026-10-18');
    expect(last7Range.toDate).toBe('2026-10-24');
    expect(last7Range.previousFromDate).toBe('2026-10-11');
    expect(last7Range.previousToDate).toBe('2026-10-17');
    expect(last7Range.durationDays).toBe(7);

    const thisMonthRange = calculateDateRange('this_month', undefined, undefined, fixedDate);
    expect(thisMonthRange.fromDate).toBe('2026-10-01');
    expect(thisMonthRange.toDate).toBe('2026-10-24');
    expect(thisMonthRange.previousFromDate).toBe('2026-09-01');
    expect(thisMonthRange.previousToDate).toBe('2026-09-24');

    const lastMonthRange = calculateDateRange('last_month', undefined, undefined, fixedDate);
    expect(lastMonthRange.fromDate).toBe('2026-09-01');
    expect(lastMonthRange.toDate).toBe('2026-09-30');
    expect(lastMonthRange.previousFromDate).toBe('2026-08-01');
    expect(lastMonthRange.previousToDate).toBe('2026-08-31');

    const customRange = calculateDateRange('custom', '2026-10-10', '2026-10-15', fixedDate);
    expect(customRange.fromDate).toBe('2026-10-10');
    expect(customRange.toDate).toBe('2026-10-15');
    expect(customRange.durationDays).toBe(6);
    expect(customRange.previousToDate).toBe('2026-10-09');
    expect(customRange.previousFromDate).toBe('2026-10-04');
  });

  // 3. Expense Management Module CRUD operations
  it('3. Expense Management: Creates, lists, updates, and deletes operating expenses with validation', async () => {
    // A. Create flower purchase expense
    const createReq = new NextRequest('http://localhost:3000/api/admin/expenses', {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-10-24',
        category: 'flower_purchase',
        amountRupees: 2500, // ₹2,500 = 250000 paise
        description: 'Gudimalkapur wholesale marigold 20kg bundle',
        referenceReceipt: 'BILL-4091',
      }),
    });

    const createRes = await createExpenseRoute(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.expense.id).toBeDefined();
    expect(createData.expense.amountPaise).toBe(250000);
    expect(createData.expense.category).toBe('flower_purchase');

    const expenseId = createData.expense.id;

    // B. List expenses
    const listReq = new NextRequest('http://localhost:3000/api/admin/expenses?category=flower_purchase', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const listRes = await getExpensesRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.expenses.length).toBeGreaterThanOrEqual(1);
    expect(listData.expenses[0].id).toBe(expenseId);

    // C. Update expense
    const updateReq = new NextRequest(`http://localhost:3000/api/admin/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'x-admin-key': ADMIN_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountRupees: 2800,
        description: 'Updated wholesale purchase with delivery charge',
      }),
    });
    const updateRes = await updateExpenseRoute(updateReq, { params: Promise.resolve({ id: expenseId }) });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.expense.amountPaise).toBe(280000);
    expect(updateData.expense.description).toContain('Updated wholesale');

    // D. Delete expense
    const deleteReq = new NextRequest(`http://localhost:3000/api/admin/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const deleteRes = await deleteExpenseRoute(deleteReq, { params: Promise.resolve({ id: expenseId }) });
    expect(deleteRes.status).toBe(200);

    // Confirm deleted
    const verifyListReq = new NextRequest('http://localhost:3000/api/admin/expenses', {
      headers: { 'x-admin-key': ADMIN_SECRET_KEY },
    });
    const verifyListData = await (await getExpensesRoute(verifyListReq)).json();
    const found = verifyListData.expenses.find((e: any) => e.id === expenseId);
    expect(found).toBeUndefined();
  });

  // 4. Financial Calculations: Gross Sales, Net Revenue, Profit, Margin & Distinction from Unpaid Orders
  it('4. Financial calculation rules: Gross sales, net revenue, expenses, net profit, and profit margin', () => {
    const todayStr = '2026-10-24';
    const dateRange = calculateDateRange('today', undefined, undefined, new Date(`${todayStr}T10:00:00+05:30`));

    // Order 1: Paid COD order (Delivered) -> ₹200 (20000 paise)
    const order1: Order = {
      id: 'MF-ORD-1',
      customer: { customerName: 'Priya', phone: '+919876543210', apartmentCommunity: 'My Home Bhooja' },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: '100g', quantity: 3, itemTotalPaise: 18000 }],
      orderType: 'one-time',
      subtotalPaise: 18000,
      deliveryFeePaise: 2000,
      totalPaise: 20000, // ₹200
      deliverySchedule: { type: 'one-time', date: todayStr, timeSlot: 'morning' },
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T07:00:00.000Z`,
    };

    // Order 2: Paid WhatsApp UPI order -> ₹300 (30000 paise)
    const order2: Order = {
      id: 'MF-ORD-2',
      customer: { customerName: 'Kiran', phone: '+919876543211', apartmentCommunity: 'Prestige Lakeside' },
      items: [{ productId: 'prod-yellow-marigold', name: 'Yellow Marigold', pricePaise: 4000, unit: '250g', quantity: 7, itemTotalPaise: 28000 }],
      orderType: 'one-time',
      subtotalPaise: 28000,
      deliveryFeePaise: 2000,
      totalPaise: 30000, // ₹300
      deliverySchedule: { type: 'one-time', date: todayStr, timeSlot: 'morning' },
      orderStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: `${todayStr}T06:30:00.000Z`,
      updatedAt: `${todayStr}T06:35:00.000Z`,
    };

    // Order 3: Unpaid / Payment Due order -> ₹150 (15000 paise)
    // CRUCIAL: Must be in Gross Sales, but MUST NOT be counted in Net Collected Revenue!
    const order3: Order = {
      id: 'MF-ORD-3',
      customer: { customerName: 'Ravi', phone: '+919876543212', apartmentCommunity: 'Aparna Sarovar' },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: '100g', quantity: 2, itemTotalPaise: 12000 }],
      orderType: 'one-time',
      subtotalPaise: 12000,
      deliveryFeePaise: 3000,
      totalPaise: 15000, // ₹150
      deliverySchedule: { type: 'one-time', date: todayStr, timeSlot: 'morning' },
      orderStatus: 'pending_confirmation',
      paymentStatus: 'payment_due',
      paymentMethod: 'cod',
      createdAt: `${todayStr}T07:00:00.000Z`,
      updatedAt: `${todayStr}T07:00:00.000Z`,
    };

    // Order 4: Cancelled order -> ₹100 (10000 paise)
    // CRUCIAL: Must be counted in Cancelled Orders, excluded from Gross Sales
    const order4: Order = {
      id: 'MF-ORD-4',
      customer: { customerName: 'Anil', phone: '+919876543213', apartmentCommunity: 'Lanco Hills' },
      items: [{ productId: 'prod-yellow-marigold', name: 'Yellow Marigold', pricePaise: 4000, unit: '250g', quantity: 2, itemTotalPaise: 8000 }],
      orderType: 'one-time',
      subtotalPaise: 8000,
      deliveryFeePaise: 2000,
      totalPaise: 10000,
      deliverySchedule: { type: 'one-time', date: todayStr, timeSlot: 'morning' },
      orderStatus: 'cancelled',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      createdAt: `${todayStr}T07:15:00.000Z`,
      updatedAt: `${todayStr}T07:20:00.000Z`,
    };

    // Operating Expenses for today:
    // Flower purchase: ₹180 (18000 paise)
    // Transport: ₹50 (5000 paise)
    // Packaging: ₹20 (2000 paise)
    // Total Expenses: ₹250 (25000 paise)
    const expenses: Expense[] = [
      {
        id: 'EXP-1',
        date: todayStr,
        category: 'flower_purchase',
        amountPaise: 18000,
        description: 'Morning flower batch',
        createdBy: 'admin@maheshflora.com',
        createdAt: `${todayStr}T04:30:00.000Z`,
        updatedAt: `${todayStr}T04:30:00.000Z`,
      },
      {
        id: 'EXP-2',
        date: todayStr,
        category: 'transport',
        amountPaise: 5000,
        description: 'Driver petrol allowance',
        createdBy: 'admin@maheshflora.com',
        createdAt: `${todayStr}T05:00:00.000Z`,
        updatedAt: `${todayStr}T05:00:00.000Z`,
      },
      {
        id: 'EXP-3',
        date: todayStr,
        category: 'packaging',
        amountPaise: 2000,
        description: 'Eco flower bags',
        createdBy: 'admin@maheshflora.com',
        createdAt: `${todayStr}T05:15:00.000Z`,
        updatedAt: `${todayStr}T05:15:00.000Z`,
      },
    ];

    const summary = computeAnalyticsSummary({
      orders: [order1, order2, order3, order4],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses,
      products: testProducts,
      dateRange,
    });

    // 1. Gross Sales: Valid non-cancelled orders = order1 (₹200) + order2 (₹300) + order3 (₹150) = ₹650 (65000 paise)
    expect(summary.kpis.grossSalesPaise.value).toBe(65000);
    expect(summary.kpis.grossSalesPaise.formatted).toContain('650');

    // 2. Net Collected Revenue: ONLY paid orders = order1 (₹200) + order2 (₹300) = ₹500 (50000 paise)
    // Order 3 (unpaid ₹150) is STRICTLY excluded!
    expect(summary.kpis.netRevenuePaise.value).toBe(50000);
    expect(summary.kpis.netRevenuePaise.formatted).toContain('500');

    // 3. Total Orders = 4 (including cancelled)
    expect(summary.kpis.totalOrdersCount.value).toBe(4);
    // Completed = 1 (order1 delivered)
    expect(summary.kpis.completedOrdersCount.value).toBe(1);
    // Pending = 2 (order2 confirmed + order3 pending)
    expect(summary.kpis.pendingOrdersCount.value).toBe(2);
    // Cancelled = 1 (order4)
    expect(summary.kpis.cancelledOrdersCount.value).toBe(1);

    // 4. AOV = Gross Sales (65000) / Valid Orders (3) = 21667 paise (~₹216.67)
    expect(summary.kpis.aovPaise.value).toBe(21667);

    // 5. Operating Expenses
    expect(summary.kpis.flowerPurchaseExpensesPaise.value).toBe(18000); // ₹180
    expect(summary.kpis.transportExpensesPaise.value).toBe(5000); // ₹50
    expect(summary.kpis.otherExpensesPaise.value).toBe(2000); // ₹20
    expect(summary.kpis.totalExpensesPaise.value).toBe(25000); // ₹250

    // 6. Net Profit = Net Revenue (50000) - Total Expenses (25000) = 25000 paise (₹250.00)
    expect(summary.kpis.netProfitPaise.value).toBe(25000);
    expect(summary.kpis.netProfitPaise.formatted).toContain('250');

    // 7. Profit Margin = (Net Profit 25000 / Net Revenue 50000) * 100 = 50.0%
    expect(summary.kpis.profitMarginPercent.value).toBe(50);
    expect(summary.kpis.profitMarginPercent.formatted).toBe('50.0%');

    // Flower costs recorded
    expect(summary.hasRecordedFlowerCosts).toBe(true);
  });

  // 5. Net Loss Handling (when expenses exceed revenue)
  it('5. Properly handles net loss when operating expenses exceed recognized revenue', () => {
    const todayStr = '2026-10-24';
    const dateRange = calculateDateRange('today', undefined, undefined, new Date(`${todayStr}T10:00:00+05:30`));

    // Revenue: ₹100
    const order: Order = {
      id: 'MF-ORD-SMALL',
      customer: { customerName: 'Test', phone: '+919876543210', apartmentCommunity: 'Test' },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: '100g', quantity: 1, itemTotalPaise: 6000 }],
      orderType: 'one-time',
      subtotalPaise: 6000,
      deliveryFeePaise: 4000,
      totalPaise: 10000, // ₹100
      deliverySchedule: { type: 'one-time', date: todayStr },
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T07:00:00.000Z`,
    };

    // High expense: ₹350
    const expense: Expense = {
      id: 'EXP-HIGH',
      date: todayStr,
      category: 'flower_purchase',
      amountPaise: 35000, // ₹350
      description: 'Bulk temple order stock',
      createdBy: 'admin@maheshflora.com',
      createdAt: `${todayStr}T04:00:00.000Z`,
      updatedAt: `${todayStr}T04:00:00.000Z`,
    };

    const summary = computeAnalyticsSummary({
      orders: [order],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [expense],
      products: testProducts,
      dateRange,
    });

    // Net Profit = ₹100 - ₹350 = -₹250 (-25000 paise)
    expect(summary.kpis.netProfitPaise.value).toBe(-25000);
    expect(summary.kpis.netProfitPaise.formatted).toContain('-₹250');
    // Margin is negative: -250%
    expect(summary.kpis.profitMarginPercent.value).toBe(-250);
  });

  // 6. Flower Product Performance Ranking & Volume
  it('6. Flower performance accurately calculates volume, sales, and ranks top varieties', () => {
    const todayStr = '2026-10-24';
    const dateRange = calculateDateRange('today', undefined, undefined, new Date(`${todayStr}T10:00:00+05:30`));

    const order: Order = {
      id: 'MF-ORD-FLOWER',
      customer: { customerName: 'Puja Customer', phone: '+919876543210', apartmentCommunity: 'Test' },
      items: [
        { productId: 'prod-jasmine', name: 'Jasmine (Mallepulu)', pricePaise: 6000, unit: '100g', quantity: 5, itemTotalPaise: 30000 },
        { productId: 'prod-yellow-marigold', name: 'Yellow Marigold (Banthi)', pricePaise: 4000, unit: '250g', quantity: 2, itemTotalPaise: 8000 },
      ],
      orderType: 'one-time',
      subtotalPaise: 38000,
      deliveryFeePaise: 2000,
      totalPaise: 40000,
      deliverySchedule: { type: 'one-time', date: todayStr },
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T07:00:00.000Z`,
    };

    const summary = computeAnalyticsSummary({
      orders: [order],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [],
      products: testProducts,
      dateRange,
    });

    const jasminePerf = summary.flowerPerformance.find((p) => p.productId === 'prod-jasmine');
    expect(jasminePerf).toBeDefined();
    expect(jasminePerf!.quantitySold).toBe(5);
    expect(jasminePerf!.salesRevenuePaise).toBe(30000);
    expect(jasminePerf!.ordersCount).toBe(1);

    const marigoldPerf = summary.flowerPerformance.find((p) => p.productId === 'prod-yellow-marigold');
    expect(marigoldPerf).toBeDefined();
    expect(marigoldPerf!.quantitySold).toBe(2);
    expect(marigoldPerf!.salesRevenuePaise).toBe(8000);

    // Jasmine is top ranked by sales revenue (30000 > 8000)
    expect(summary.flowerPerformance[0].productId).toBe('prod-jasmine');
  });

  // 7. Sanitized Financial CSV Export Generation
  it('7. Generates sanitized CSV report matching reporting period without customer PII', () => {
    const todayStr = '2026-10-24';
    const dateRange = calculateDateRange('today', undefined, undefined, new Date(`${todayStr}T10:00:00+05:30`));

    const order: Order = {
      id: 'MF-ORD-SECRET-99',
      customer: {
        customerName: 'Secret Customer',
        phone: '+919999988888', // PII - Must NOT appear in CSV
        apartmentCommunity: 'Gated Villa #402', // PII - Must NOT appear in CSV
      },
      items: [{ productId: 'prod-jasmine', name: 'Jasmine', pricePaise: 6000, unit: '100g', quantity: 2, itemTotalPaise: 12000 }],
      orderType: 'one-time',
      subtotalPaise: 12000,
      deliveryFeePaise: 2000,
      totalPaise: 14000,
      deliverySchedule: { type: 'one-time', date: todayStr },
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'whatsapp_upi',
      createdAt: `${todayStr}T06:00:00.000Z`,
      updatedAt: `${todayStr}T07:00:00.000Z`,
    };

    const expense: Expense = {
      id: 'EXP-MANDI-1',
      date: todayStr,
      category: 'flower_purchase',
      amountPaise: 5000,
      description: 'Morning mandi jasmine',
      createdBy: 'admin@maheshflora.com',
      createdAt: `${todayStr}T04:00:00.000Z`,
      updatedAt: `${todayStr}T04:00:00.000Z`,
    };

    const summary = computeAnalyticsSummary({
      orders: [order],
      subscriptions: [],
      festivals: [],
      festivalBookings: [],
      expenses: [expense],
      products: testProducts,
      dateRange,
    });

    const csv = generateAnalyticsCSV({
      summary,
      orders: [order],
      expenses: [expense],
    });

    // Contains financial reporting metadata
    expect(csv).toContain('Mahesh Flora - Financial Analysis Report');
    expect(csv).toContain('Gross Sales');
    expect(csv).toContain('Net Collected Revenue');
    expect(csv).toContain('MF-ORD-SECRET-99');
    expect(csv).toContain('EXP-MANDI-1');
    expect(csv).toContain('140.00'); // ₹140.00 total
    expect(csv).toContain('50.00');  // ₹50.00 expense

    // CRUCIAL PRIVACY CHECK: Customer phone number and private villa details MUST NOT appear!
    expect(csv).not.toContain('9999988888');
    expect(csv).not.toContain('Gated Villa #402');
  });
});
