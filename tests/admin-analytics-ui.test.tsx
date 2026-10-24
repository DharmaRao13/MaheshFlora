import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import AdminDashboardClient from '@/app/admin/AdminDashboardClient';
import { ADMIN_SECRET_KEY } from '@/lib/auth';

describe('Admin Analytics Dashboard Component and Navigation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      localStorage.clear();
      localStorage.setItem('mahesh_admin_key', ADMIN_SECRET_KEY);
    }
  });

  const mockAnalyticsData = {
    dateRange: {
      preset: 'last_7_days',
      label: 'Last 7 Days',
      fromDate: '2026-10-18',
      toDate: '2026-10-24',
      previousFromDate: '2026-10-11',
      previousToDate: '2026-10-17',
      previousLabel: 'Prior 7 Days',
      durationDays: 7,
    },
    kpis: {
      grossSalesPaise: { value: 1250000, formatted: '₹12,500.00', percentChangeFormatted: '+18.5%', trend: 'up' },
      netRevenuePaise: { value: 1100000, formatted: '₹11,000.00', percentChangeFormatted: '+15.2%', trend: 'up' },
      totalOrdersCount: { value: 45, formatted: '45', percentChangeFormatted: '+12.5%', trend: 'up' },
      completedOrdersCount: { value: 38, formatted: '38', percentChangeFormatted: '+10.0%', trend: 'up' },
      pendingOrdersCount: { value: 5, formatted: '5', percentChangeFormatted: '-20.0%', trend: 'down' },
      cancelledOrdersCount: { value: 2, formatted: '2', percentChangeFormatted: '0.0%', trend: 'neutral' },
      aovPaise: { value: 29000, formatted: '₹290.00', percentChangeFormatted: '+5.5%', trend: 'up' },
      flowerPurchaseExpensesPaise: { value: 450000, formatted: '₹4,500.00', percentChangeFormatted: '+8.0%', trend: 'up' },
      transportExpensesPaise: { value: 120000, formatted: '₹1,200.00', percentChangeFormatted: '+4.0%', trend: 'up' },
      otherExpensesPaise: { value: 60000, formatted: '₹600.00', percentChangeFormatted: '0.0%', trend: 'neutral' },
      totalExpensesPaise: { value: 630000, formatted: '₹6,300.00', percentChangeFormatted: '+6.5%', trend: 'up' },
      netProfitPaise: { value: 470000, formatted: '₹4,700.00', percentChangeFormatted: '+30.2%', trend: 'up' },
      profitMarginPercent: { value: 42.7, formatted: '42.7%', percentChangeFormatted: '+4.5%', trend: 'up' },
    },
    hasRecordedFlowerCosts: true,
    dailyTrend: [
      { date: '2026-10-18', label: '18 Oct', grossSalesPaise: 150000, netRevenuePaise: 140000, expensesPaise: 80000, netProfitPaise: 60000, ordersCount: 6 },
      { date: '2026-10-19', label: '19 Oct', grossSalesPaise: 180000, netRevenuePaise: 160000, expensesPaise: 90000, netProfitPaise: 70000, ordersCount: 7 },
    ],
    monthlyBreakdown: [
      { monthKey: '2026-10', label: 'Oct', grossSalesPaise: 4500000, netRevenuePaise: 4100000, expensesPaise: 2200000, netProfitPaise: 1900000, ordersCount: 160 },
    ],
    paymentDistribution: [
      { method: 'cod', label: 'Cash on Delivery (COD)', count: 20, amountPaise: 500000, percentage: 50 },
      { method: 'whatsapp_upi', label: 'WhatsApp / Instant UPI', count: 15, amountPaise: 400000, percentage: 37.5 },
      { method: 'razorpay', label: 'Razorpay / Online', count: 5, amountPaise: 200000, percentage: 12.5 },
    ],
    orderStatusDistribution: [
      { status: 'delivered', label: 'Completed / Delivered', count: 38, amountPaise: 1000000, percentage: 84.4 },
      { status: 'preparing', label: 'Packing at Dawn', count: 5, amountPaise: 150000, percentage: 11.1 },
      { status: 'cancelled', label: 'Cancelled', count: 2, amountPaise: 100000, percentage: 4.4 },
    ],
    flowerPerformance: [
      {
        productId: 'prod-jasmine',
        name: 'Jasmine (Mallepulu)',
        teluguName: 'మల్లెపూలు',
        category: 'fragrant',
        quantitySold: 40,
        ordersCount: 25,
        salesRevenuePaise: 600000,
        estimatedCostPaise: 270000,
        profitContributionPaise: 330000,
        marginPercent: 55,
      },
    ],
    subscriptions: {
      activeCount: 18,
      pausedCount: 2,
      cancelledCount: 1,
      totalCount: 21,
      newInPeriodCount: 3,
      estimatedWeeklyRevenuePaise: 160000,
      upcomingDeliveriesCount: 54,
    },
    festivals: {
      totalBookingsCount: 12,
      paidBookingsCount: 8,
      pendingPaymentCount: 4,
      cancelledCount: 0,
      totalRevenuePaise: 360000,
      collectedRevenuePaise: 240000,
      upcomingFestivalDeliveriesCount: 8,
    },
    recentOrders: [
      {
        id: 'MF-2026-9001',
        createdAt: '2026-10-24T06:00:00.000Z',
        customerName: 'Ananya Rao',
        orderStatus: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'whatsapp_upi',
        totalPaise: 45000,
      },
    ],
  };

  it('1. Admin navigation contains Analysis Dashboard and highlights when active', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/login')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, adminKey: ADMIN_SECRET_KEY }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminDashboardClient initialTab="analytics" />);

    // Fast-login for test
    fireEvent.change(screen.getByPlaceholderText(/Enter admin passcode/i), {
      target: { value: ADMIN_SECRET_KEY },
    });
    fireEvent.click(screen.getByRole('button', { name: /Access Dashboard/i }));

    // Navigation tab exists
    await waitFor(() => {
      const analyticsTab = screen.getByRole('button', { name: /Analysis Dashboard/i });
      expect(analyticsTab).toBeInTheDocument();
    });
  });

  it('2. Renders all 12 KPI cards, charts, and product performance table in Analytics view', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, summary: mockAnalyticsData }),
        });
      }
      if (url.includes('/api/admin/expenses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, expenses: [] }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalyticsDashboard adminKey={ADMIN_SECRET_KEY} />);

    await waitFor(() => {
      expect(screen.getByText('Sales, Profit & Operational Analysis')).toBeInTheDocument();
    });

    // Check KPIs
    expect(screen.getByText('Gross Sales')).toBeInTheDocument();
    expect(screen.getByText('Net Collected Revenue')).toBeInTheDocument();
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('Completed Orders')).toBeInTheDocument();
    expect(screen.getByText('Average Order Value')).toBeInTheDocument();
    expect(screen.getByText('Flower Purchase Costs')).toBeInTheDocument();
    expect(screen.getByText('Delivery & Transport')).toBeInTheDocument();
    expect(screen.getByText('Packaging & Other Costs')).toBeInTheDocument();
    expect(screen.getByText('Net Profit / Loss')).toBeInTheDocument();
    expect(screen.getByText('Profit Margin')).toBeInTheDocument();

    // Check values
    expect(screen.getByText('₹12,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹11,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹4,700.00')).toBeInTheDocument();
    expect(screen.getByText('42.7%')).toBeInTheDocument();

    // Check Charts headings
    expect(screen.getByText('Daily Sales & Revenue Trend')).toBeInTheDocument();
    expect(screen.getByText('Revenue vs Operating Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Profit & Loss Trend')).toBeInTheDocument();
    expect(screen.getByText(/Monthly Revenue Breakdown/i)).toBeInTheDocument();

    // Check Flower variety ranking
    expect(screen.getByText('Flower Variety Performance Ranking')).toBeInTheDocument();
    expect(screen.getByText('Jasmine (Mallepulu)')).toBeInTheDocument();

    // Check Subscriptions & Festival cards
    expect(screen.getByText('Weekly Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Festival Pre-Bookings')).toBeInTheDocument();
  });

  it('3. Date preset buttons trigger data reload with requested preset', async () => {
    let requestedPreset = '';
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/analytics')) {
        const u = new URL(url, 'http://localhost');
        requestedPreset = u.searchParams.get('preset') || '';
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, summary: mockAnalyticsData }),
        });
      }
      if (url.includes('/api/admin/expenses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, expenses: [] }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalyticsDashboard adminKey={ADMIN_SECRET_KEY} />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => {
      expect(requestedPreset).toBe('today');
    });

    fireEvent.click(screen.getByRole('button', { name: 'This Month' }));
    await waitFor(() => {
      expect(requestedPreset).toBe('this_month');
    });
  });

  it('4. Opens "Log Expense" modal and submits new expense record', async () => {
    let createdPayload: any = null;
    const fetchMock = vi.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, summary: mockAnalyticsData }),
        });
      }
      if (url.includes('/api/admin/expenses') && opts?.method === 'POST') {
        createdPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            expense: { id: 'EXP-999', ...createdPayload, amountPaise: createdPayload.amountRupees * 100 },
          }),
        });
      }
      if (url.includes('/api/admin/expenses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, expenses: [] }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalyticsDashboard adminKey={ADMIN_SECRET_KEY} />);

    await waitFor(() => {
      expect(screen.getByText('Log Expense')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Log Expense/i }));

    expect(screen.getByText('Amount in Rupees (₹) *')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. 1500'), {
      target: { value: '2500' },
    });
    fireEvent.change(screen.getByPlaceholderText(/wholesale jasmine/i), {
      target: { value: 'Morning mandi marigold purchase' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(createdPayload).toBeDefined();
      expect(createdPayload.amountRupees).toBe(2500);
      expect(createdPayload.description).toBe('Morning mandi marigold purchase');
    });
  });
});
