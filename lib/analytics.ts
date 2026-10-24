import {
  Order,
  Subscription,
  Festival,
  FestivalBooking,
  Expense,
  Product,
  DateRangeResult,
  AnalyticsKPIs,
  FinancialMetric,
  FlowerPerformanceItem,
  DailyTrendPoint,
  MonthlyBreakdownPoint,
  PaymentMethodBreakdown,
  OrderStatusBreakdown,
  SubscriptionsAnalytics,
  FestivalBookingsAnalytics,
  AnalyticsSummaryResponse,
  PaymentMethod,
  OrderStatus,
} from '@/types';
import { formatINR } from './config';
import { toISTDateString, addDaysToDateString, formatHumanDate, getDaysDifference } from './dateUtils';

/**
 * Format currency paise into Indian Rupee string, e.g. "₹12,450" or "₹12,450.00"
 */
export function formatCurrencyPaise(paise: number, includeDecimals = true): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(rupees);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Builds a FinancialMetric object with safe diff and percentage change calculations.
 */
function buildMetric(
  value: number,
  previousValue: number | undefined,
  type: 'currency' | 'count' | 'percent',
  isPositiveGood = true,
  isEstimate = false,
  note?: string
): FinancialMetric {
  let formatted = '';
  if (type === 'currency') {
    formatted = formatCurrencyPaise(value);
  } else if (type === 'percent') {
    formatted = `${value.toFixed(1)}%`;
  } else {
    formatted = new Intl.NumberFormat('en-IN').format(Math.round(value));
  }

  let previousFormatted: string | undefined = undefined;
  let diff: number | undefined = undefined;
  let diffFormatted: string | undefined = undefined;
  let percentChange: number | undefined = undefined;
  let percentChangeFormatted: string | undefined = undefined;
  let trend: 'up' | 'down' | 'neutral' = 'neutral';

  if (previousValue !== undefined) {
    if (type === 'currency') {
      previousFormatted = formatCurrencyPaise(previousValue);
    } else if (type === 'percent') {
      previousFormatted = `${previousValue.toFixed(1)}%`;
    } else {
      previousFormatted = new Intl.NumberFormat('en-IN').format(Math.round(previousValue));
    }

    diff = value - previousValue;
    if (type === 'currency') {
      diffFormatted = `${diff >= 0 ? '+' : ''}${formatCurrencyPaise(diff)}`;
    } else if (type === 'percent') {
      diffFormatted = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    } else {
      diffFormatted = `${diff >= 0 ? '+' : ''}${new Intl.NumberFormat('en-IN').format(Math.round(diff))}`;
    }

    if (previousValue === 0) {
      if (value === 0) {
        percentChange = 0;
        percentChangeFormatted = '0.0%';
      } else if (value > 0) {
        percentChange = 100;
        percentChangeFormatted = '+100%';
      } else {
        percentChange = -100;
        percentChangeFormatted = '-100%';
      }
    } else {
      percentChange = Number((((value - previousValue) / Math.abs(previousValue)) * 100).toFixed(1));
      percentChangeFormatted = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`;
    }

    if (diff > 0) {
      trend = 'up';
    } else if (diff < 0) {
      trend = 'down';
    } else {
      trend = 'neutral';
    }
  }

  return {
    value,
    formatted,
    previousValue,
    previousFormatted,
    diff,
    diffFormatted,
    percentChange,
    percentChangeFormatted,
    trend,
    isPositiveGood,
    isEstimate,
    note,
  };
}

/**
 * Core Financial Analytics Calculation Engine
 */
export function computeAnalyticsSummary(params: {
  orders: Order[];
  subscriptions: Subscription[];
  festivals: Festival[];
  festivalBookings: FestivalBooking[];
  expenses: Expense[];
  products: Product[];
  dateRange: DateRangeResult;
}): AnalyticsSummaryResponse {
  const { orders, subscriptions, festivals, festivalBookings, expenses, products, dateRange } = params;

  // Filter helper functions using IST date bounds
  const isOrderInPeriod = (o: Order, from: string, to: string) => {
    const orderDate = toISTDateString(o.createdAt);
    return orderDate >= from && orderDate <= to;
  };

  const isExpenseInPeriod = (e: Expense, from: string, to: string) => {
    return e.date >= from && e.date <= to;
  };

  const isBookingInPeriod = (b: FestivalBooking, from: string, to: string) => {
    const bookingDate = toISTDateString(b.createdAt);
    return bookingDate >= from && bookingDate <= to;
  };

  // 1. Current Period Records
  const currentOrders = orders.filter((o) => isOrderInPeriod(o, dateRange.fromDate, dateRange.toDate));
  const currentExpenses = expenses.filter((e) => isExpenseInPeriod(e, dateRange.fromDate, dateRange.toDate));
  const currentBookings = festivalBookings.filter((b) => isBookingInPeriod(b, dateRange.fromDate, dateRange.toDate));

  // 2. Previous Period Records
  const prevOrders = orders.filter((o) => isOrderInPeriod(o, dateRange.previousFromDate, dateRange.previousToDate));
  const prevExpenses = expenses.filter((e) => isExpenseInPeriod(e, dateRange.previousFromDate, dateRange.previousToDate));
  const prevBookings = festivalBookings.filter((b) => isBookingInPeriod(b, dateRange.previousFromDate, dateRange.previousToDate));

  // Calculation subroutine for a period
  const calculatePeriodTotals = (periodOrders: Order[], periodExpenses: Expense[], periodBookings: FestivalBooking[]) => {
    const validOrders = periodOrders.filter((o) => o.orderStatus !== 'cancelled');
    const grossSalesPaise = validOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    // Paid orders count strictly towards collected revenue
    const paidOrders = periodOrders.filter((o) => o.paymentStatus === 'paid');
    const paidOrdersRevenue = paidOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    // Paid festival bookings (standalone)
    const paidBookings = periodBookings.filter((b) => b.paymentStatus === 'paid');
    const paidBookingsRevenue = paidBookings.reduce((sum, b) => sum + b.totalPaise, 0);

    // Refunds
    const refundedOrders = periodOrders.filter((o) => o.paymentStatus === 'refunded');
    const refundsPaise = refundedOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    const netRevenuePaise = Math.max(0, paidOrdersRevenue + paidBookingsRevenue - refundsPaise);

    const totalOrdersCount = periodOrders.length;
    const completedOrdersCount = periodOrders.filter((o) => o.orderStatus === 'delivered').length;
    const pendingOrdersCount = periodOrders.filter((o) =>
      ['pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.orderStatus)
    ).length;
    const cancelledOrdersCount = periodOrders.filter((o) => o.orderStatus === 'cancelled').length;

    const aovPaise = validOrders.length > 0 ? Math.round(grossSalesPaise / validOrders.length) : 0;

    // Expenses breakdown
    const flowerPurchaseExpensesPaise = periodExpenses
      .filter((e) => e.category === 'flower_purchase')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const transportExpensesPaise = periodExpenses
      .filter((e) => e.category === 'transport')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const packagingExpensesPaise = periodExpenses
      .filter((e) => e.category === 'packaging')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const otherExpensesPaise = periodExpenses
      .filter((e) => e.category === 'other')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const totalExpensesPaise = periodExpenses.reduce((sum, e) => sum + e.amountPaise, 0);

    const netProfitPaise = netRevenuePaise - totalExpensesPaise;
    const profitMarginPercent = netRevenuePaise > 0 ? Number(((netProfitPaise / netRevenuePaise) * 100).toFixed(1)) : 0;

    return {
      grossSalesPaise,
      netRevenuePaise,
      totalOrdersCount,
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      aovPaise,
      flowerPurchaseExpensesPaise,
      transportExpensesPaise,
      otherExpensesPaise: packagingExpensesPaise + otherExpensesPaise,
      totalExpensesPaise,
      netProfitPaise,
      profitMarginPercent,
    };
  };

  const curr = calculatePeriodTotals(currentOrders, currentExpenses, currentBookings);
  const prev = calculatePeriodTotals(prevOrders, prevExpenses, prevBookings);

  const hasRecordedFlowerCosts = curr.flowerPurchaseExpensesPaise > 0;
  const flowerCostNote = hasRecordedFlowerCosts
    ? undefined
    : 'No flower purchase expenses recorded for this period; profit reflects other recorded expenses';

  const kpis: AnalyticsKPIs = {
    grossSalesPaise: buildMetric(curr.grossSalesPaise, prev.grossSalesPaise, 'currency', true),
    netRevenuePaise: buildMetric(curr.netRevenuePaise, prev.netRevenuePaise, 'currency', true),
    totalOrdersCount: buildMetric(curr.totalOrdersCount, prev.totalOrdersCount, 'count', true),
    completedOrdersCount: buildMetric(curr.completedOrdersCount, prev.completedOrdersCount, 'count', true),
    pendingOrdersCount: buildMetric(curr.pendingOrdersCount, prev.pendingOrdersCount, 'count', true),
    cancelledOrdersCount: buildMetric(curr.cancelledOrdersCount, prev.cancelledOrdersCount, 'count', false),
    aovPaise: buildMetric(curr.aovPaise, prev.aovPaise, 'currency', true),
    flowerPurchaseExpensesPaise: buildMetric(curr.flowerPurchaseExpensesPaise, prev.flowerPurchaseExpensesPaise, 'currency', false),
    transportExpensesPaise: buildMetric(curr.transportExpensesPaise, prev.transportExpensesPaise, 'currency', false),
    otherExpensesPaise: buildMetric(curr.otherExpensesPaise, prev.otherExpensesPaise, 'currency', false),
    totalExpensesPaise: buildMetric(curr.totalExpensesPaise, prev.totalExpensesPaise, 'currency', false),
    netProfitPaise: buildMetric(
      curr.netProfitPaise,
      prev.netProfitPaise,
      'currency',
      true,
      !hasRecordedFlowerCosts,
      flowerCostNote
    ),
    profitMarginPercent: buildMetric(
      curr.profitMarginPercent,
      prev.profitMarginPercent,
      'percent',
      true,
      !hasRecordedFlowerCosts,
      flowerCostNote
    ),
  };

  // 3. Daily Sales & Revenue Trend (Day-by-day across dateRange.fromDate -> dateRange.toDate)
  const duration = getDaysDifference(dateRange.fromDate, dateRange.toDate);
  const dailyTrend: DailyTrendPoint[] = [];

  // Generate sequence of dates
  let currentDate = dateRange.fromDate;
  for (let i = 0; i < duration; i++) {
    const dayOrders = currentOrders.filter((o) => toISTDateString(o.createdAt) === currentDate);
    const dayValidOrders = dayOrders.filter((o) => o.orderStatus !== 'cancelled');
    const dayExpenses = currentExpenses.filter((e) => e.date === currentDate);
    const dayBookings = currentBookings.filter((b) => toISTDateString(b.createdAt) === currentDate);

    const gross = dayValidOrders.reduce((sum, o) => sum + o.totalPaise, 0);
    const paidOrders = dayOrders.filter((o) => o.paymentStatus === 'paid');
    const paidBookings = dayBookings.filter((b) => b.paymentStatus === 'paid');
    const refunds = dayOrders.filter((o) => o.paymentStatus === 'refunded').reduce((sum, o) => sum + o.totalPaise, 0);

    const net = Math.max(
      0,
      paidOrders.reduce((sum, o) => sum + o.totalPaise, 0) +
        paidBookings.reduce((sum, b) => sum + b.totalPaise, 0) -
        refunds
    );

    const exp = dayExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const profit = net - exp;

    dailyTrend.push({
      date: currentDate,
      label: formatHumanDate(currentDate, { includeYear: false }),
      grossSalesPaise: gross,
      netRevenuePaise: net,
      expensesPaise: exp,
      netProfitPaise: profit,
      ordersCount: dayOrders.length,
    });

    currentDate = addDaysToDateString(currentDate, 1);
  }

  // 4. Monthly Revenue Breakdown (for the current year up to 12 months)
  const targetYear = dateRange.toDate.split('-')[0];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyBreakdown: MonthlyBreakdownPoint[] = months.map((monthName, idx) => {
    const monthNumber = String(idx + 1).padStart(2, '0');
    const monthKey = `${targetYear}-${monthNumber}`;

    const monthOrders = orders.filter((o) => {
      const istDate = toISTDateString(o.createdAt);
      return istDate.startsWith(monthKey);
    });

    const monthExpenses = expenses.filter((e) => e.date.startsWith(monthKey));
    const monthBookings = festivalBookings.filter((b) => toISTDateString(b.createdAt).startsWith(monthKey));

    const validMonthOrders = monthOrders.filter((o) => o.orderStatus !== 'cancelled');
    const gross = validMonthOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    const paidOrders = monthOrders.filter((o) => o.paymentStatus === 'paid');
    const paidBookings = monthBookings.filter((b) => b.paymentStatus === 'paid');
    const refunds = monthOrders.filter((o) => o.paymentStatus === 'refunded').reduce((sum, o) => sum + o.totalPaise, 0);

    const net = Math.max(
      0,
      paidOrders.reduce((sum, o) => sum + o.totalPaise, 0) +
        paidBookings.reduce((sum, b) => sum + b.totalPaise, 0) -
        refunds
    );

    const exp = monthExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const profit = net - exp;

    return {
      monthKey,
      label: monthName,
      grossSalesPaise: gross,
      netRevenuePaise: net,
      expensesPaise: exp,
      netProfitPaise: profit,
      ordersCount: monthOrders.length,
    };
  });

  // 5. Payment Method Distribution (for paid orders in current period)
  const paidOrders = currentOrders.filter((o) => o.paymentStatus === 'paid');
  const totalPaidOrdersCount = paidOrders.length;
  const paymentMethodMap: Record<string, { count: number; amountPaise: number }> = {
    cod: { count: 0, amountPaise: 0 },
    whatsapp_upi: { count: 0, amountPaise: 0 },
    razorpay: { count: 0, amountPaise: 0 },
  };

  for (const o of paidOrders) {
    const m = (o.paymentMethod || 'cod').toLowerCase();
    if (!paymentMethodMap[m]) {
      paymentMethodMap[m] = { count: 0, amountPaise: 0 };
    }
    paymentMethodMap[m].count++;
    paymentMethodMap[m].amountPaise += o.totalPaise;
  }

  const paymentLabels: Record<string, string> = {
    cod: 'Cash on Delivery (COD)',
    whatsapp_upi: 'WhatsApp / Instant UPI',
    razorpay: 'Razorpay / Online',
  };

  const paymentDistribution: PaymentMethodBreakdown[] = Object.entries(paymentMethodMap).map(([method, data]) => ({
    method,
    label: paymentLabels[method] || method.toUpperCase(),
    count: data.count,
    amountPaise: data.amountPaise,
    percentage: totalPaidOrdersCount > 0 ? Number(((data.count / totalPaidOrdersCount) * 100).toFixed(1)) : 0,
  }));

  // 6. Order Status Distribution (for all orders in current period)
  const orderStatusMap: Record<OrderStatus, { count: number; amountPaise: number }> = {
    delivered: { count: 0, amountPaise: 0 },
    preparing: { count: 0, amountPaise: 0 },
    out_for_delivery: { count: 0, amountPaise: 0 },
    confirmed: { count: 0, amountPaise: 0 },
    pending_confirmation: { count: 0, amountPaise: 0 },
    cancelled: { count: 0, amountPaise: 0 },
  };

  for (const o of currentOrders) {
    const st = o.orderStatus in orderStatusMap ? o.orderStatus : 'pending_confirmation';
    orderStatusMap[st].count++;
    orderStatusMap[st].amountPaise += o.totalPaise;
  }

  const statusLabels: Record<OrderStatus, string> = {
    delivered: 'Completed / Delivered',
    preparing: 'Packing at Dawn',
    out_for_delivery: 'Out for Delivery',
    confirmed: 'Confirmed',
    pending_confirmation: 'Pending Confirmation',
    cancelled: 'Cancelled',
  };

  const orderStatusDistribution: OrderStatusBreakdown[] = (Object.keys(orderStatusMap) as OrderStatus[]).map((status) => ({
    status,
    label: statusLabels[status],
    count: orderStatusMap[status].count,
    amountPaise: orderStatusMap[status].amountPaise,
    percentage: currentOrders.length > 0 ? Number(((orderStatusMap[status].count / currentOrders.length) * 100).toFixed(1)) : 0,
  }));

  // 7. Flower Product Performance Ranking
  const productStatsMap = new Map<
    string,
    {
      product: Product;
      quantitySold: number;
      ordersCount: number;
      salesRevenuePaise: number;
    }
  >();

  // Initialize with catalogue products
  for (const p of products) {
    productStatsMap.set(p.id, {
      product: p,
      quantitySold: 0,
      ordersCount: 0,
      salesRevenuePaise: 0,
    });
  }

  // Iterate over valid orders in period
  const validCurrentOrders = currentOrders.filter((o) => o.orderStatus !== 'cancelled');
  for (const o of validCurrentOrders) {
    const seenInOrder = new Set<string>();
    for (const item of o.items) {
      let stats = productStatsMap.get(item.productId);
      if (!stats) {
        // Unknown or custom product
        const fallbackProd: Product = {
          id: item.productId,
          name: item.name,
          description: '',
          category: 'daily-puja',
          pricePaise: item.pricePaise,
          unit: item.unit,
          imageUrl: '',
          inStock: true,
        };
        stats = {
          product: fallbackProd,
          quantitySold: 0,
          ordersCount: 0,
          salesRevenuePaise: 0,
        };
        productStatsMap.set(item.productId, stats);
      }

      stats.quantitySold += item.quantity;
      stats.salesRevenuePaise += item.itemTotalPaise;
      if (!seenInOrder.has(item.productId)) {
        stats.ordersCount++;
        seenInOrder.add(item.productId);
      }
    }
  }

  // Calculate costs & contribution
  // Standard floristry wholesale benchmark is ~40-50% purchase cost unless exact batch receipts are logged
  const totalFlowerSales = Array.from(productStatsMap.values()).reduce((sum, s) => sum + s.salesRevenuePaise, 0);

  const flowerPerformance: FlowerPerformanceItem[] = Array.from(productStatsMap.values()).map(({ product, quantitySold, ordersCount, salesRevenuePaise }) => {
    // If recorded flower purchase expenses exist, attribute proportionally by revenue share; else estimate 45% wholesale cost
    let estimatedCostPaise = 0;
    if (curr.flowerPurchaseExpensesPaise > 0 && totalFlowerSales > 0) {
      estimatedCostPaise = Math.round((salesRevenuePaise / totalFlowerSales) * curr.flowerPurchaseExpensesPaise);
    } else {
      estimatedCostPaise = Math.round(salesRevenuePaise * 0.45);
    }

    const profitContributionPaise = salesRevenuePaise - estimatedCostPaise;
    const marginPercent = salesRevenuePaise > 0 ? Number(((profitContributionPaise / salesRevenuePaise) * 100).toFixed(1)) : 0;

    return {
      productId: product.id,
      name: product.name,
      teluguName: product.teluguName,
      variety: product.category,
      category: product.category,
      quantitySold,
      ordersCount,
      salesRevenuePaise,
      estimatedCostPaise,
      profitContributionPaise,
      marginPercent,
    };
  });

  // Rank by sales revenue descending
  flowerPerformance.sort((a, b) => b.salesRevenuePaise - a.salesRevenuePaise);

  // 8. Subscriptions Analytics
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const pausedSubs = subscriptions.filter((s) => s.status === 'paused');
  const cancelledSubs = subscriptions.filter((s) => s.status === 'cancelled');

  const newSubsInPeriod = subscriptions.filter((s) => {
    const createdDate = toISTDateString(s.createdAt);
    return createdDate >= dateRange.fromDate && createdDate <= dateRange.toDate;
  }).length;

  const estimatedWeeklyPaise = activeSubs.reduce((sum, s) => sum + (s.estimatedWeeklyPaise || 0), 0);

  const subscriptionsSummary: SubscriptionsAnalytics = {
    activeCount: activeSubs.length,
    pausedCount: pausedSubs.length,
    cancelledCount: cancelledSubs.length,
    totalCount: subscriptions.length,
    newInPeriodCount: newSubsInPeriod,
    estimatedWeeklyRevenuePaise: estimatedWeeklyPaise,
    upcomingDeliveriesCount: activeSubs.length * 3, // Average scheduled deliveries across active gated community subscribers
  };

  // 9. Festival Bookings Analytics
  const paidFestivalBookings = currentBookings.filter((b) => b.paymentStatus === 'paid');
  const pendingPaymentBookings = currentBookings.filter((b) => b.paymentStatus !== 'paid' && b.status !== 'cancelled');
  const cancelledBookings = currentBookings.filter((b) => b.status === 'cancelled');
  const festivalTotalRevenue = currentBookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.totalPaise, 0);

  const festivalCollectedRevenue = paidFestivalBookings.reduce((sum, b) => sum + b.totalPaise, 0);

  const festivalSummary: FestivalBookingsAnalytics = {
    totalBookingsCount: currentBookings.length,
    paidBookingsCount: paidFestivalBookings.length,
    pendingPaymentCount: pendingPaymentBookings.length,
    cancelledCount: cancelledBookings.length,
    totalRevenuePaise: festivalTotalRevenue,
    collectedRevenuePaise: festivalCollectedRevenue,
    upcomingFestivalDeliveriesCount: currentBookings.filter((b) => b.status === 'confirmed').length,
  };

  // 10. Recent Orders in period (latest 10)
  const recentOrders = [...currentOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      customerName: o.customer.customerName,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      totalPaise: o.totalPaise,
    }));

  return {
    dateRange,
    kpis,
    hasRecordedFlowerCosts,
    dailyTrend,
    monthlyBreakdown,
    paymentDistribution,
    orderStatusDistribution,
    flowerPerformance,
    subscriptions: subscriptionsSummary,
    festivals: festivalSummary,
    recentOrders,
  };
}

/**
 * Generates sanitized CSV string for financial export (no customer phone numbers or addresses)
 */
export function generateAnalyticsCSV(params: {
  summary: AnalyticsSummaryResponse;
  orders: Order[];
  expenses: Expense[];
}): string {
  const { summary, orders, expenses } = params;

  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];

  // Header Metadata
  rows.push(escapeCSV(`Mahesh Flora - Financial Analysis Report`));
  rows.push(escapeCSV(`Reporting Period: ${summary.dateRange.label} (${summary.dateRange.fromDate} to ${summary.dateRange.toDate})`));
  rows.push(escapeCSV(`Generated at: ${new Date().toISOString()} (IST)`));
  rows.push('');

  // KPI Summary Block
  rows.push(escapeCSV('--- FINANCIAL SUMMARY ---'));
  rows.push(['Metric', 'Current Period', 'Previous Period', 'Change', 'Notes'].map(escapeCSV).join(','));
  rows.push(['Gross Sales', summary.kpis.grossSalesPaise.formatted, summary.kpis.grossSalesPaise.previousFormatted || 'N/A', summary.kpis.grossSalesPaise.percentChangeFormatted || '0%', 'Valid orders before refunds'].map(escapeCSV).join(','));
  rows.push(['Net Collected Revenue', summary.kpis.netRevenuePaise.formatted, summary.kpis.netRevenuePaise.previousFormatted || 'N/A', summary.kpis.netRevenuePaise.percentChangeFormatted || '0%', 'Verified collected payments minus refunds'].map(escapeCSV).join(','));
  rows.push(['Total Operating Expenses', summary.kpis.totalExpensesPaise.formatted, summary.kpis.totalExpensesPaise.previousFormatted || 'N/A', summary.kpis.totalExpensesPaise.percentChangeFormatted || '0%', 'Flower purchases, transport & packaging'].map(escapeCSV).join(','));
  rows.push(['Net Profit / Loss', summary.kpis.netProfitPaise.formatted, summary.kpis.netProfitPaise.previousFormatted || 'N/A', summary.kpis.netProfitPaise.percentChangeFormatted || '0%', summary.kpis.netProfitPaise.note || 'Net Revenue minus Expenses'].map(escapeCSV).join(','));
  rows.push(['Profit Margin', summary.kpis.profitMarginPercent.formatted, summary.kpis.profitMarginPercent.previousFormatted || 'N/A', summary.kpis.profitMarginPercent.diffFormatted || '0%', 'Net Profit / Net Revenue'].map(escapeCSV).join(','));
  rows.push(['Total Orders', summary.kpis.totalOrdersCount.formatted, summary.kpis.totalOrdersCount.previousFormatted || 'N/A', summary.kpis.totalOrdersCount.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
  rows.push(['Completed Orders', summary.kpis.completedOrdersCount.formatted, summary.kpis.completedOrdersCount.previousFormatted || 'N/A', summary.kpis.completedOrdersCount.percentChangeFormatted || '0%', 'Delivered'].map(escapeCSV).join(','));
  rows.push(['Pending Orders', summary.kpis.pendingOrdersCount.formatted, summary.kpis.pendingOrdersCount.previousFormatted || 'N/A', summary.kpis.pendingOrdersCount.percentChangeFormatted || '0%', 'In preparation or transit'].map(escapeCSV).join(','));
  rows.push(['Cancelled Orders', summary.kpis.cancelledOrdersCount.formatted, summary.kpis.cancelledOrdersCount.previousFormatted || 'N/A', summary.kpis.cancelledOrdersCount.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
  rows.push(['Average Order Value (AOV)', summary.kpis.aovPaise.formatted, summary.kpis.aovPaise.previousFormatted || 'N/A', summary.kpis.aovPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
  rows.push('');

  // Itemized Order Details (Sanitized of PII)
  rows.push(escapeCSV('--- ITEMISED ORDERS IN PERIOD ---'));
  rows.push([
    'Date (IST)',
    'Order ID',
    'Order Type',
    'Order Status',
    'Payment Method',
    'Payment Status',
    'Items Summary',
    'Subtotal (INR)',
    'Delivery Fee (INR)',
    'Total Amount (INR)',
  ].map(escapeCSV).join(','));

  const filteredOrders = orders.filter((o) => {
    const istDate = toISTDateString(o.createdAt);
    return istDate >= summary.dateRange.fromDate && istDate <= summary.dateRange.toDate;
  });

  for (const o of filteredOrders) {
    const istDate = toISTDateString(o.createdAt);
    const itemsSummary = o.items.map((i) => `${i.name} (x${i.quantity})`).join('; ');
    rows.push([
      istDate,
      o.id,
      o.orderType,
      o.orderStatus,
      o.paymentMethod,
      o.paymentStatus,
      itemsSummary,
      (o.subtotalPaise / 100).toFixed(2),
      (o.deliveryFeePaise / 100).toFixed(2),
      (o.totalPaise / 100).toFixed(2),
    ].map(escapeCSV).join(','));
  }
  rows.push('');

  // Itemized Expenses
  rows.push(escapeCSV('--- ITEMISED OPERATING EXPENSES IN PERIOD ---'));
  rows.push([
    'Date (IST)',
    'Expense ID',
    'Category',
    'Description',
    'Amount (INR)',
    'Reference / Receipt',
    'Logged By',
  ].map(escapeCSV).join(','));

  const filteredExpenses = expenses.filter((e) => {
    return e.date >= summary.dateRange.fromDate && e.date <= summary.dateRange.toDate;
  });

  for (const e of filteredExpenses) {
    rows.push([
      e.date,
      e.id,
      e.category,
      e.description,
      (e.amountPaise / 100).toFixed(2),
      e.referenceReceipt || 'N/A',
      e.createdBy,
    ].map(escapeCSV).join(','));
  }
  rows.push('');

  // Flower Performance
  rows.push(escapeCSV('--- FLOWER PRODUCT PERFORMANCE ---'));
  rows.push([
    'Product ID',
    'Flower Name',
    'Category',
    'Quantity Sold',
    'Orders Count',
    'Sales Revenue (INR)',
    'Est. Purchase Cost (INR)',
    'Profit Contribution (INR)',
    'Profit Margin (%)',
  ].map(escapeCSV).join(','));

  for (const p of summary.flowerPerformance) {
    rows.push([
      p.productId,
      p.name,
      p.category || 'daily-puja',
      p.quantitySold,
      p.ordersCount,
      (p.salesRevenuePaise / 100).toFixed(2),
      (p.estimatedCostPaise / 100).toFixed(2),
      (p.profitContributionPaise / 100).toFixed(2),
      `${p.marginPercent.toFixed(1)}%`,
    ].map(escapeCSV).join(','));
  }

  return rows.join('\r\n');
}
