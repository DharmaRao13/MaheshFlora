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
  StallDailyEntry,
  StallKPIs,
  CombinedKPIs,
  ChannelContribution,
  UnifiedCategoryBreakdownItem,
  AnalyticsView,
} from '@/types';
import { formatINR } from './config';
import { toISTDateString, addDaysToDateString, formatHumanDate, getDaysDifference } from './dateUtils';

/**
 * Maps online catalog products to standard flower categories
 */
export function mapProductToStallCategory(productId = '', name = ''): 'jasmine' | 'marigold' | 'mixed' | 'other' {
  const lower = `${productId} ${name}`.toLowerCase();
  if (
    lower.includes('jasmine') ||
    lower.includes('malle') ||
    lower.includes('mallige') ||
    lower.includes('mogra') ||
    lower.includes('chameli')
  ) {
    return 'jasmine';
  }
  if (
    lower.includes('marigold') ||
    lower.includes('banthi') ||
    lower.includes('chemanthi') ||
    lower.includes('genda')
  ) {
    return 'marigold';
  }
  if (
    lower.includes('mixed') ||
    lower.includes('loose') ||
    lower.includes('puja mix') ||
    lower.includes('daily puja') ||
    lower.includes('petal')
  ) {
    return 'mixed';
  }
  return 'other';
}

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
 * Core Financial Analytics Calculation Engine supporting Stall, Online, and Combined views
 */
export function computeAnalyticsSummary(params: {
  orders: Order[];
  subscriptions: Subscription[];
  festivals: Festival[];
  festivalBookings: FestivalBooking[];
  expenses: Expense[];
  stallEntries?: StallDailyEntry[];
  products: Product[];
  dateRange: DateRangeResult;
  view?: AnalyticsView;
}): AnalyticsSummaryResponse {
  const {
    orders,
    subscriptions,
    festivals,
    festivalBookings,
    expenses,
    stallEntries = [],
    products,
    dateRange,
    view = params.view || (params.stallEntries && params.stallEntries.length > 0 ? 'combined' : 'online'),
  } = params;

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

  const isStallInPeriod = (s: StallDailyEntry, from: string, to: string) => {
    return s.date >= from && s.date <= to;
  };

  // 1. Current Period Records
  const currentOrders = orders.filter((o) => isOrderInPeriod(o, dateRange.fromDate, dateRange.toDate));
  const currentExpenses = expenses.filter((e) => isExpenseInPeriod(e, dateRange.fromDate, dateRange.toDate));
  const currentBookings = festivalBookings.filter((b) => isBookingInPeriod(b, dateRange.fromDate, dateRange.toDate));
  const currentStallEntries = stallEntries.filter((s) => isStallInPeriod(s, dateRange.fromDate, dateRange.toDate));

  // 2. Previous Period Records
  const prevOrders = orders.filter((o) => isOrderInPeriod(o, dateRange.previousFromDate, dateRange.previousToDate));
  const prevExpenses = expenses.filter((e) => isExpenseInPeriod(e, dateRange.previousFromDate, dateRange.previousToDate));
  const prevBookings = festivalBookings.filter((b) => isBookingInPeriod(b, dateRange.previousFromDate, dateRange.previousToDate));
  const prevStallEntries = stallEntries.filter((s) => isStallInPeriod(s, dateRange.previousFromDate, dateRange.previousToDate));

  // ----------------------------------------------------
  // ONLINE PERIOD TOTALS CALCULATION
  // ----------------------------------------------------
  const calculateOnlinePeriodTotals = (
    periodOrders: Order[],
    periodExpenses: Expense[],
    periodBookings: FestivalBooking[]
  ) => {
    const validOrders = periodOrders.filter((o) => o.orderStatus !== 'cancelled');
    const grossSalesPaise = validOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    const paidOrders = periodOrders.filter((o) => o.paymentStatus === 'paid');
    const paidOrdersRevenue = paidOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    const paidBookings = periodBookings.filter((b) => b.paymentStatus === 'paid');
    const paidBookingsRevenue = paidBookings.reduce((sum, b) => sum + b.totalPaise, 0);

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

    // Filter online expenses (exclude stall-tagged expenses)
    const onlinePeriodExpenses = periodExpenses.filter((e) => e.channel !== 'stall' && !e.stallEntryId);

    const flowerPurchaseExpensesPaise = onlinePeriodExpenses
      .filter((e) => e.category === 'flower_purchase')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const transportExpensesPaise = onlinePeriodExpenses
      .filter((e) => e.category === 'transport')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const packagingExpensesPaise = onlinePeriodExpenses
      .filter((e) => e.category === 'packaging')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const otherExpensesPaise = onlinePeriodExpenses
      .filter((e) => e.category === 'other')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const totalExpensesPaise = onlinePeriodExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const netProfitPaise = netRevenuePaise - totalExpensesPaise;
    const profitMarginPercent = netRevenuePaise > 0 ? Number(((netProfitPaise / netRevenuePaise) * 100).toFixed(1)) : 0;

    // Payment method collections
    const cashCollectionsPaise = paidOrders
      .filter((o) => o.paymentMethod === 'cod')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const upiCollectionsPaise =
      paidOrders.filter((o) => o.paymentMethod !== 'cod').reduce((sum, o) => sum + o.totalPaise, 0) +
      paidBookingsRevenue;

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
      packagingExpensesPaise,
      otherExpensesPaise,
      totalExpensesPaise,
      netProfitPaise,
      profitMarginPercent,
      cashCollectionsPaise,
      upiCollectionsPaise,
    };
  };

  // ----------------------------------------------------
  // STALL PERIOD TOTALS CALCULATION
  // ----------------------------------------------------
  const calculateStallPeriodTotals = (periodStallEntries: StallDailyEntry[]) => {
    let totalSalesPaise = 0;
    let jasmineSalesPaise = 0;
    let marigoldSalesPaise = 0;
    let mixedFlowersSalesPaise = 0;
    let otherFlowersSalesPaise = 0;

    let cashPaise = 0;
    let upiPaise = 0;
    let otherColPaise = 0;
    let totalCollectionsPaise = 0;

    let flowerPurchasePaise = 0;
    let transportPaise = 0;
    let packagingPaise = 0;
    let otherExpPaise = 0;
    let totalExpensesPaise = 0;

    let reconciliationDiscrepanciesCount = 0;
    let reconciliationNetDiffPaise = 0;

    for (const entry of periodStallEntries) {
      jasmineSalesPaise += entry.flowerSales?.jasminePaise || 0;
      marigoldSalesPaise += entry.flowerSales?.marigoldPaise || 0;
      mixedFlowersSalesPaise += entry.flowerSales?.mixedFlowersPaise || 0;
      otherFlowersSalesPaise += entry.flowerSales?.otherFlowersPaise || 0;
      totalSalesPaise += entry.totalSalesPaise || 0;

      cashPaise += entry.collections?.cashPaise || 0;
      upiPaise += entry.collections?.upiPaise || 0;
      otherColPaise += entry.collections?.otherPaise || 0;
      totalCollectionsPaise += entry.totalCollectionsPaise || 0;

      flowerPurchasePaise += entry.expenses?.flowerPurchasePaise || 0;
      transportPaise += entry.expenses?.transportPaise || 0;
      packagingPaise += entry.expenses?.packagingPaise || 0;
      otherExpPaise += entry.expenses?.otherPaise || 0;
      totalExpensesPaise += entry.totalExpensesPaise || 0;

      if ((entry.reconciliationDifferencePaise || 0) !== 0) {
        reconciliationDiscrepanciesCount += 1;
        reconciliationNetDiffPaise += entry.reconciliationDifferencePaise;
      }
    }

    const preliminaryOperatingResultPaise = totalSalesPaise - totalExpensesPaise;
    const profitMarginPercent = totalSalesPaise > 0 ? Number(((preliminaryOperatingResultPaise / totalSalesPaise) * 100).toFixed(1)) : 0;

    return {
      totalSalesPaise,
      jasmineSalesPaise,
      marigoldSalesPaise,
      mixedFlowersSalesPaise,
      otherFlowersSalesPaise,
      cashPaise,
      upiPaise,
      otherColPaise,
      totalCollectionsPaise,
      flowerPurchasePaise,
      transportPaise,
      packagingPaise,
      otherExpPaise,
      totalExpensesPaise,
      preliminaryOperatingResultPaise,
      profitMarginPercent,
      reconciliationDiscrepanciesCount,
      reconciliationNetDiffPaise,
    };
  };

  const currOnline = calculateOnlinePeriodTotals(currentOrders, currentExpenses, currentBookings);
  const prevOnline = calculateOnlinePeriodTotals(prevOrders, prevExpenses, prevBookings);

  const currStall = calculateStallPeriodTotals(currentStallEntries);
  const prevStall = calculateStallPeriodTotals(prevStallEntries);

  // ----------------------------------------------------
  // COMBINED TOTALS CALCULATION
  // ----------------------------------------------------
  const currCombined = {
    totalBusinessSalesPaise: currStall.totalSalesPaise + currOnline.grossSalesPaise,
    netCollectedRevenuePaise: currStall.totalCollectionsPaise + currOnline.netRevenuePaise,
    stallSalesPaise: currStall.totalSalesPaise,
    onlineSalesPaise: currOnline.grossSalesPaise,
    totalExpensesPaise: currStall.totalExpensesPaise + currOnline.totalExpensesPaise,
    combinedOperatingResultPaise: currStall.preliminaryOperatingResultPaise + currOnline.netProfitPaise,
    cashCollectionsPaise: currStall.cashPaise + currOnline.cashCollectionsPaise,
    upiCollectionsPaise: currStall.upiPaise + currOnline.upiCollectionsPaise,
    onlineOrdersCount: currOnline.totalOrdersCount,
    totalTransactionsCount: currentStallEntries.length + currOnline.totalOrdersCount,
  };

  const prevCombined = {
    totalBusinessSalesPaise: prevStall.totalSalesPaise + prevOnline.grossSalesPaise,
    netCollectedRevenuePaise: prevStall.totalCollectionsPaise + prevOnline.netRevenuePaise,
    stallSalesPaise: prevStall.totalSalesPaise,
    onlineSalesPaise: prevOnline.grossSalesPaise,
    totalExpensesPaise: prevStall.totalExpensesPaise + prevOnline.totalExpensesPaise,
    combinedOperatingResultPaise: prevStall.preliminaryOperatingResultPaise + prevOnline.netProfitPaise,
    cashCollectionsPaise: prevStall.cashPaise + prevOnline.cashCollectionsPaise,
    upiCollectionsPaise: prevStall.upiPaise + prevOnline.upiCollectionsPaise,
    onlineOrdersCount: prevOnline.totalOrdersCount,
    totalTransactionsCount: prevStallEntries.length + prevOnline.totalOrdersCount,
  };

  // ----------------------------------------------------
  // BUILD STALL KPIS
  // ----------------------------------------------------
  const stallKPIs: StallKPIs = {
    totalStallSalesPaise: buildMetric(currStall.totalSalesPaise, prevStall.totalSalesPaise, 'currency', true),
    stallCashCollectionsPaise: buildMetric(currStall.cashPaise, prevStall.cashPaise, 'currency', true),
    stallUpiCollectionsPaise: buildMetric(currStall.upiPaise, prevStall.upiPaise, 'currency', true),
    stallOtherCollectionsPaise: buildMetric(currStall.otherColPaise, prevStall.otherColPaise, 'currency', true),
    totalCollectionsPaise: buildMetric(currStall.totalCollectionsPaise, prevStall.totalCollectionsPaise, 'currency', true),
    flowerPurchaseExpensesPaise: buildMetric(currStall.flowerPurchasePaise, prevStall.flowerPurchasePaise, 'currency', false),
    transportExpensesPaise: buildMetric(currStall.transportPaise, prevStall.transportPaise, 'currency', false),
    packagingExpensesPaise: buildMetric(currStall.packagingPaise, prevStall.packagingPaise, 'currency', false),
    otherExpensesPaise: buildMetric(currStall.otherExpPaise, prevStall.otherExpPaise, 'currency', false),
    totalRecordedExpensesPaise: buildMetric(currStall.totalExpensesPaise, prevStall.totalExpensesPaise, 'currency', false),
    preliminaryOperatingResultPaise: buildMetric(
      currStall.preliminaryOperatingResultPaise,
      prevStall.preliminaryOperatingResultPaise,
      'currency',
      true,
      false,
      'Preliminary operating result (sales minus recorded stall expenses)'
    ),
    reconciliationDiscrepanciesCount: buildMetric(
      currStall.reconciliationDiscrepanciesCount,
      prevStall.reconciliationDiscrepanciesCount,
      'count',
      false
    ),
    reconciliationNetDiffPaise: buildMetric(
      currStall.reconciliationNetDiffPaise,
      prevStall.reconciliationNetDiffPaise,
      'currency',
      false
    ),
  };

  // ----------------------------------------------------
  // BUILD COMBINED KPIS
  // ----------------------------------------------------
  const stallSalesShare =
    currCombined.totalBusinessSalesPaise > 0
      ? (currCombined.stallSalesPaise / currCombined.totalBusinessSalesPaise) * 100
      : 0;
  const prevStallSalesShare =
    prevCombined.totalBusinessSalesPaise > 0
      ? (prevCombined.stallSalesPaise / prevCombined.totalBusinessSalesPaise) * 100
      : 0;

  const onlineSalesShare =
    currCombined.totalBusinessSalesPaise > 0
      ? (currCombined.onlineSalesPaise / currCombined.totalBusinessSalesPaise) * 100
      : 0;
  const prevOnlineSalesShare =
    prevCombined.totalBusinessSalesPaise > 0
      ? (prevCombined.onlineSalesPaise / prevCombined.totalBusinessSalesPaise) * 100
      : 0;

  const combinedKPIs: CombinedKPIs = {
    totalBusinessSalesPaise: buildMetric(currCombined.totalBusinessSalesPaise, prevCombined.totalBusinessSalesPaise, 'currency', true),
    netCollectedRevenuePaise: buildMetric(currCombined.netCollectedRevenuePaise, prevCombined.netCollectedRevenuePaise, 'currency', true),
    stallSalesPaise: buildMetric(currCombined.stallSalesPaise, prevCombined.stallSalesPaise, 'currency', true),
    onlineSalesPaise: buildMetric(currCombined.onlineSalesPaise, prevCombined.onlineSalesPaise, 'currency', true),
    totalBusinessExpensesPaise: buildMetric(currCombined.totalExpensesPaise, prevCombined.totalExpensesPaise, 'currency', false),
    combinedOperatingResultPaise: buildMetric(
      currCombined.combinedOperatingResultPaise,
      prevCombined.combinedOperatingResultPaise,
      'currency',
      true,
      false,
      'Combined Operating Result: Stall preliminary result + Online recognized net profit'
    ),
    totalCashCollectionsPaise: buildMetric(currCombined.cashCollectionsPaise, prevCombined.cashCollectionsPaise, 'currency', true),
    totalUpiCollectionsPaise: buildMetric(currCombined.upiCollectionsPaise, prevCombined.upiCollectionsPaise, 'currency', true),
    totalOnlineOrdersCount: buildMetric(currCombined.onlineOrdersCount, prevCombined.onlineOrdersCount, 'count', true),
    stallSalesContributionPercent: buildMetric(stallSalesShare, prevStallSalesShare, 'percent', true),
    onlineSalesContributionPercent: buildMetric(onlineSalesShare, prevOnlineSalesShare, 'percent', true),
  };

  const channelContribution: ChannelContribution = {
    stallSalesPaise: currStall.totalSalesPaise,
    onlineSalesPaise: currOnline.grossSalesPaise,
    totalSalesPaise: currCombined.totalBusinessSalesPaise,
    stallPercentage: Number(stallSalesShare.toFixed(1)),
    onlinePercentage: Number(onlineSalesShare.toFixed(1)),
  };

  // ----------------------------------------------------
  // ONLINE FLOWER CATEGORY MAPPING & PERFORMANCE
  // ----------------------------------------------------
  let onlineJasminePaise = 0;
  let onlineMarigoldPaise = 0;
  let onlineMixedPaise = 0;
  let onlineOtherPaise = 0;

  for (const order of currentOrders) {
    if (order.orderStatus === 'cancelled') continue;
    for (const item of order.items) {
      const cat = mapProductToStallCategory(item.productId, item.name);
      const itemTotal = item.pricePaise * item.quantity;
      if (cat === 'jasmine') onlineJasminePaise += itemTotal;
      else if (cat === 'marigold') onlineMarigoldPaise += itemTotal;
      else if (cat === 'mixed') onlineMixedPaise += itemTotal;
      else onlineOtherPaise += itemTotal;
    }
  }

  const categoryBreakdown: UnifiedCategoryBreakdownItem[] = [
    {
      category: 'jasmine',
      label: 'Jasmine (Mallepoovu)',
      stallSalesPaise: currStall.jasmineSalesPaise,
      onlineSalesPaise: onlineJasminePaise,
      totalSalesPaise: currStall.jasmineSalesPaise + onlineJasminePaise,
      percentage: 0,
    },
    {
      category: 'marigold',
      label: 'Marigold (Banthipoovu)',
      stallSalesPaise: currStall.marigoldSalesPaise,
      onlineSalesPaise: onlineMarigoldPaise,
      totalSalesPaise: currStall.marigoldSalesPaise + onlineMarigoldPaise,
      percentage: 0,
    },
    {
      category: 'mixed',
      label: 'Mixed Flowers & Petals',
      stallSalesPaise: currStall.mixedFlowersSalesPaise,
      onlineSalesPaise: onlineMixedPaise,
      totalSalesPaise: currStall.mixedFlowersSalesPaise + onlineMixedPaise,
      percentage: 0,
    },
    {
      category: 'other',
      label: 'Other Flowers & Garlands',
      stallSalesPaise: currStall.otherFlowersSalesPaise,
      onlineSalesPaise: onlineOtherPaise,
      totalSalesPaise: currStall.otherFlowersSalesPaise + onlineOtherPaise,
      percentage: 0,
    },
  ];

  const totalCatSales = categoryBreakdown.reduce((s, c) => s + c.totalSalesPaise, 0);
  for (const item of categoryBreakdown) {
    item.percentage = totalCatSales > 0 ? Number(((item.totalSalesPaise / totalCatSales) * 100).toFixed(1)) : 0;
  }

  // ----------------------------------------------------
  // BASELINE ONLINE KPIS
  // ----------------------------------------------------
  const hasRecordedFlowerCosts =
    view === 'stall'
      ? currStall.flowerPurchasePaise > 0
      : view === 'online'
      ? currOnline.flowerPurchaseExpensesPaise > 0
      : currStall.flowerPurchasePaise + currOnline.flowerPurchaseExpensesPaise > 0;

  const onlineKPIs: AnalyticsKPIs = {
    grossSalesPaise: buildMetric(currOnline.grossSalesPaise, prevOnline.grossSalesPaise, 'currency', true),
    netRevenuePaise: buildMetric(currOnline.netRevenuePaise, prevOnline.netRevenuePaise, 'currency', true),
    totalOrdersCount: buildMetric(currOnline.totalOrdersCount, prevOnline.totalOrdersCount, 'count', true),
    completedOrdersCount: buildMetric(currOnline.completedOrdersCount, prevOnline.completedOrdersCount, 'count', true),
    pendingOrdersCount: buildMetric(currOnline.pendingOrdersCount, prevOnline.pendingOrdersCount, 'count', true),
    cancelledOrdersCount: buildMetric(currOnline.cancelledOrdersCount, prevOnline.cancelledOrdersCount, 'count', false),
    aovPaise: buildMetric(currOnline.aovPaise, prevOnline.aovPaise, 'currency', true),
    flowerPurchaseExpensesPaise: buildMetric(currOnline.flowerPurchaseExpensesPaise, prevOnline.flowerPurchaseExpensesPaise, 'currency', false),
    transportExpensesPaise: buildMetric(currOnline.transportExpensesPaise, prevOnline.transportExpensesPaise, 'currency', false),
    otherExpensesPaise: buildMetric(currOnline.otherExpensesPaise + currOnline.packagingExpensesPaise, prevOnline.otherExpensesPaise + prevOnline.packagingExpensesPaise, 'currency', false),
    totalExpensesPaise: buildMetric(currOnline.totalExpensesPaise, prevOnline.totalExpensesPaise, 'currency', false),
    netProfitPaise: buildMetric(currOnline.netProfitPaise, prevOnline.netProfitPaise, 'currency', true, !hasRecordedFlowerCosts),
    profitMarginPercent: buildMetric(currOnline.profitMarginPercent, prevOnline.profitMarginPercent, 'percent', true, !hasRecordedFlowerCosts),
  };

  // Selected view KPI structure
  let effectiveKPIs: AnalyticsKPIs;
  if (view === 'stall') {
    effectiveKPIs = {
      grossSalesPaise: stallKPIs.totalStallSalesPaise,
      netRevenuePaise: stallKPIs.totalCollectionsPaise,
      totalOrdersCount: buildMetric(currentStallEntries.length, prevStallEntries.length, 'count', true),
      completedOrdersCount: buildMetric(currentStallEntries.filter((s) => s.status === 'finalized').length, prevStallEntries.filter((s) => s.status === 'finalized').length, 'count', true),
      pendingOrdersCount: buildMetric(currentStallEntries.filter((s) => s.status === 'draft').length, prevStallEntries.filter((s) => s.status === 'draft').length, 'count', false),
      cancelledOrdersCount: buildMetric(0, 0, 'count', false),
      aovPaise: buildMetric(
        currentStallEntries.length > 0 ? Math.round(currStall.totalSalesPaise / currentStallEntries.length) : 0,
        prevStallEntries.length > 0 ? Math.round(prevStall.totalSalesPaise / prevStallEntries.length) : 0,
        'currency',
        true
      ),
      flowerPurchaseExpensesPaise: stallKPIs.flowerPurchaseExpensesPaise,
      transportExpensesPaise: stallKPIs.transportExpensesPaise,
      otherExpensesPaise: buildMetric(currStall.packagingPaise + currStall.otherExpPaise, prevStall.packagingPaise + prevStall.otherExpPaise, 'currency', false),
      totalExpensesPaise: stallKPIs.totalRecordedExpensesPaise,
      netProfitPaise: stallKPIs.preliminaryOperatingResultPaise,
      profitMarginPercent: buildMetric(currStall.profitMarginPercent, prevStall.profitMarginPercent, 'percent', true),
    };
  } else if (view === 'combined') {
    const combinedMargin =
      currCombined.totalBusinessSalesPaise > 0
        ? Number(((currCombined.combinedOperatingResultPaise / currCombined.totalBusinessSalesPaise) * 100).toFixed(1))
        : 0;
    const prevCombinedMargin =
      prevCombined.totalBusinessSalesPaise > 0
        ? Number(((prevCombined.combinedOperatingResultPaise / prevCombined.totalBusinessSalesPaise) * 100).toFixed(1))
        : 0;

    effectiveKPIs = {
      grossSalesPaise: combinedKPIs.totalBusinessSalesPaise,
      netRevenuePaise: combinedKPIs.netCollectedRevenuePaise,
      totalOrdersCount: buildMetric(currCombined.totalTransactionsCount, prevCombined.totalTransactionsCount, 'count', true),
      completedOrdersCount: buildMetric(
        currOnline.completedOrdersCount + currentStallEntries.filter((s) => s.status === 'finalized').length,
        prevOnline.completedOrdersCount + prevStallEntries.filter((s) => s.status === 'finalized').length,
        'count',
        true
      ),
      pendingOrdersCount: buildMetric(
        currOnline.pendingOrdersCount + currentStallEntries.filter((s) => s.status === 'draft').length,
        prevOnline.pendingOrdersCount + prevStallEntries.filter((s) => s.status === 'draft').length,
        'count',
        false
      ),
      cancelledOrdersCount: onlineKPIs.cancelledOrdersCount,
      aovPaise: buildMetric(
        currCombined.totalTransactionsCount > 0 ? Math.round(currCombined.totalBusinessSalesPaise / currCombined.totalTransactionsCount) : 0,
        prevCombined.totalTransactionsCount > 0 ? Math.round(prevCombined.totalBusinessSalesPaise / prevCombined.totalTransactionsCount) : 0,
        'currency',
        true
      ),
      flowerPurchaseExpensesPaise: buildMetric(
        currStall.flowerPurchasePaise + currOnline.flowerPurchaseExpensesPaise,
        prevStall.flowerPurchasePaise + prevOnline.flowerPurchaseExpensesPaise,
        'currency',
        false
      ),
      transportExpensesPaise: buildMetric(
        currStall.transportPaise + currOnline.transportExpensesPaise,
        prevStall.transportPaise + prevOnline.transportExpensesPaise,
        'currency',
        false
      ),
      otherExpensesPaise: buildMetric(
        currStall.packagingPaise + currStall.otherExpPaise + currOnline.packagingExpensesPaise + currOnline.otherExpensesPaise,
        prevStall.packagingPaise + prevStall.otherExpPaise + prevOnline.packagingExpensesPaise + prevOnline.otherExpensesPaise,
        'currency',
        false
      ),
      totalExpensesPaise: combinedKPIs.totalBusinessExpensesPaise,
      netProfitPaise: combinedKPIs.combinedOperatingResultPaise,
      profitMarginPercent: buildMetric(combinedMargin, prevCombinedMargin, 'percent', true),
    };
  } else {
    effectiveKPIs = onlineKPIs;
  }

  // ----------------------------------------------------
  // DAILY TREND BUILDER
  // ----------------------------------------------------
  const duration = getDaysDifference(dateRange.fromDate, dateRange.toDate);
  const dailyTrend: DailyTrendPoint[] = [];

  let currentDate = dateRange.fromDate;
  for (let i = 0; i < duration; i++) {
    // Online
    const dayOrders = currentOrders.filter((o) => toISTDateString(o.createdAt) === currentDate);
    const dayValidOrders = dayOrders.filter((o) => o.orderStatus !== 'cancelled');
    const dayOnlineExpenses = currentExpenses.filter(
      (e) => e.date === currentDate && e.channel !== 'stall' && !e.stallEntryId
    );
    const dayBookings = currentBookings.filter((b) => toISTDateString(b.createdAt) === currentDate);

    const onlineGross = dayValidOrders.reduce((sum, o) => sum + o.totalPaise, 0);
    const onlinePaidOrders = dayOrders.filter((o) => o.paymentStatus === 'paid');
    const onlinePaidBookings = dayBookings.filter((b) => b.paymentStatus === 'paid');
    const onlineRefunds = dayOrders
      .filter((o) => o.paymentStatus === 'refunded')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const onlineNet = Math.max(
      0,
      onlinePaidOrders.reduce((sum, o) => sum + o.totalPaise, 0) +
        onlinePaidBookings.reduce((sum, b) => sum + b.totalPaise, 0) -
        onlineRefunds
    );
    const onlineExp = dayOnlineExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const onlineProfit = onlineNet - onlineExp;

    // Stall
    const stallEntry = currentStallEntries.find((s) => s.date === currentDate);
    const stallGross = stallEntry ? stallEntry.totalSalesPaise : 0;
    const stallNet = stallEntry ? stallEntry.totalCollectionsPaise : 0;
    const stallExp = stallEntry ? stallEntry.totalExpensesPaise : 0;
    const stallProfit = stallEntry ? stallEntry.preliminaryOperatingResultPaise : 0;

    let dayPointGross = 0;
    let dayPointNet = 0;
    let dayPointExp = 0;
    let dayPointProfit = 0;
    let dayPointOrders = 0;

    if (view === 'stall') {
      dayPointGross = stallGross;
      dayPointNet = stallNet;
      dayPointExp = stallExp;
      dayPointProfit = stallProfit;
      dayPointOrders = stallEntry ? 1 : 0;
    } else if (view === 'online') {
      dayPointGross = onlineGross;
      dayPointNet = onlineNet;
      dayPointExp = onlineExp;
      dayPointProfit = onlineProfit;
      dayPointOrders = dayOrders.length;
    } else {
      // Combined
      dayPointGross = stallGross + onlineGross;
      dayPointNet = stallNet + onlineNet;
      dayPointExp = stallExp + onlineExp;
      dayPointProfit = stallProfit + onlineProfit;
      dayPointOrders = (stallEntry ? 1 : 0) + dayOrders.length;
    }

    dailyTrend.push({
      date: currentDate,
      label: formatHumanDate(currentDate, { includeYear: false }),
      grossSalesPaise: dayPointGross,
      netRevenuePaise: dayPointNet,
      expensesPaise: dayPointExp,
      netProfitPaise: dayPointProfit,
      ordersCount: dayPointOrders,
    });

    currentDate = addDaysToDateString(currentDate, 1);
  }

  // ----------------------------------------------------
  // MONTHLY BREAKDOWN
  // ----------------------------------------------------
  const targetYear = dateRange.toDate.split('-')[0];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyBreakdown: MonthlyBreakdownPoint[] = months.map((monthName, idx) => {
    const monthNumber = String(idx + 1).padStart(2, '0');
    const monthKey = `${targetYear}-${monthNumber}`;

    // Online
    const monthOrders = orders.filter((o) => toISTDateString(o.createdAt).startsWith(monthKey));
    const monthOnlineExpenses = expenses.filter(
      (e) => e.date.startsWith(monthKey) && e.channel !== 'stall' && !e.stallEntryId
    );
    const monthBookings = festivalBookings.filter((b) => toISTDateString(b.createdAt).startsWith(monthKey));

    const validMonthOrders = monthOrders.filter((o) => o.orderStatus !== 'cancelled');
    const onlineGross = validMonthOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    const paidOrders = monthOrders.filter((o) => o.paymentStatus === 'paid');
    const paidBookings = monthBookings.filter((b) => b.paymentStatus === 'paid');
    const refunds = monthOrders
      .filter((o) => o.paymentStatus === 'refunded')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const onlineNet = Math.max(
      0,
      paidOrders.reduce((sum, o) => sum + o.totalPaise, 0) +
        paidBookings.reduce((sum, b) => sum + b.totalPaise, 0) -
        refunds
    );
    const onlineExp = monthOnlineExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const onlineProfit = onlineNet - onlineExp;

    // Stall
    const monthStallEntries = stallEntries.filter((s) => s.date.startsWith(monthKey));
    const stallGross = monthStallEntries.reduce((sum, s) => sum + s.totalSalesPaise, 0);
    const stallNet = monthStallEntries.reduce((sum, s) => sum + s.totalCollectionsPaise, 0);
    const stallExp = monthStallEntries.reduce((sum, s) => sum + s.totalExpensesPaise, 0);
    const stallProfit = monthStallEntries.reduce((sum, s) => sum + s.preliminaryOperatingResultPaise, 0);

    let mGross = 0;
    let mNet = 0;
    let mExp = 0;
    let mProfit = 0;
    let mOrders = 0;

    if (view === 'stall') {
      mGross = stallGross;
      mNet = stallNet;
      mExp = stallExp;
      mProfit = stallProfit;
      mOrders = monthStallEntries.length;
    } else if (view === 'online') {
      mGross = onlineGross;
      mNet = onlineNet;
      mExp = onlineExp;
      mProfit = onlineProfit;
      mOrders = monthOrders.length;
    } else {
      mGross = stallGross + onlineGross;
      mNet = stallNet + onlineNet;
      mExp = stallExp + onlineExp;
      mProfit = stallProfit + onlineProfit;
      mOrders = monthStallEntries.length + monthOrders.length;
    }

    return {
      monthKey,
      label: monthName,
      grossSalesPaise: mGross,
      netRevenuePaise: mNet,
      expensesPaise: mExp,
      netProfitPaise: mProfit,
      ordersCount: mOrders,
    };
  });

  // ----------------------------------------------------
  // PAYMENT DISTRIBUTION
  // ----------------------------------------------------
  let paymentDistribution: PaymentMethodBreakdown[] = [];
  if (view === 'stall') {
    const totalStallCols = currStall.totalCollectionsPaise;
    paymentDistribution = [
      {
        method: 'cash',
        label: 'Stall Cash Collected',
        count: currentStallEntries.filter((s) => s.collections?.cashPaise > 0).length,
        amountPaise: currStall.cashPaise,
        percentage: totalStallCols > 0 ? Number(((currStall.cashPaise / totalStallCols) * 100).toFixed(1)) : 0,
      },
      {
        method: 'upi',
        label: 'Stall UPI Collected',
        count: currentStallEntries.filter((s) => s.collections?.upiPaise > 0).length,
        amountPaise: currStall.upiPaise,
        percentage: totalStallCols > 0 ? Number(((currStall.upiPaise / totalStallCols) * 100).toFixed(1)) : 0,
      },
      {
        method: 'other',
        label: 'Other Collections',
        count: currentStallEntries.filter((s) => (s.collections?.otherPaise || 0) > 0).length,
        amountPaise: currStall.otherColPaise,
        percentage: totalStallCols > 0 ? Number(((currStall.otherColPaise / totalStallCols) * 100).toFixed(1)) : 0,
      },
    ];
  } else if (view === 'combined') {
    const totalCols = currCombined.netCollectedRevenuePaise;
    paymentDistribution = [
      {
        method: 'cash',
        label: 'Cash (Stall Cash + Online COD)',
        count:
          currentStallEntries.filter((s) => s.collections?.cashPaise > 0).length +
          currentOrders.filter((o) => o.paymentMethod === 'cod' && o.paymentStatus === 'paid').length,
        amountPaise: currCombined.cashCollectionsPaise,
        percentage: totalCols > 0 ? Number(((currCombined.cashCollectionsPaise / totalCols) * 100).toFixed(1)) : 0,
      },
      {
        method: 'upi',
        label: 'Digital / UPI (Stall UPI + Razorpay/WhatsApp)',
        count:
          currentStallEntries.filter((s) => s.collections?.upiPaise > 0).length +
          currentOrders.filter((o) => o.paymentMethod !== 'cod' && o.paymentStatus === 'paid').length +
          currentBookings.filter((b) => b.paymentStatus === 'paid').length,
        amountPaise: currCombined.upiCollectionsPaise,
        percentage: totalCols > 0 ? Number(((currCombined.upiCollectionsPaise / totalCols) * 100).toFixed(1)) : 0,
      },
      {
        method: 'other',
        label: 'Other Stall Collections',
        count: currentStallEntries.filter((s) => (s.collections?.otherPaise || 0) > 0).length,
        amountPaise: currStall.otherColPaise,
        percentage: totalCols > 0 ? Number(((currStall.otherColPaise / totalCols) * 100).toFixed(1)) : 0,
      },
    ];
  } else {
    // Online only
    const onlinePaymentMethods: { method: PaymentMethod; label: string }[] = [
      { method: 'whatsapp_upi', label: 'WhatsApp UPI' },
      { method: 'razorpay', label: 'Razorpay Online' },
      { method: 'cod', label: 'Cash on Delivery' },
    ];
    paymentDistribution = onlinePaymentMethods.map((pm) => {
      const matchingOrders = currentOrders.filter((o) => o.paymentMethod === pm.method && o.orderStatus !== 'cancelled');
      const amount = matchingOrders.reduce((sum, o) => sum + o.totalPaise, 0);
      return {
        method: pm.method,
        label: pm.label,
        count: matchingOrders.length,
        amountPaise: amount,
        percentage:
          currOnline.grossSalesPaise > 0 ? Number(((amount / currOnline.grossSalesPaise) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ----------------------------------------------------
  // ORDER STATUS DISTRIBUTION (ONLINE OR HYBRID)
  // ----------------------------------------------------
  const orderStatuses: { status: OrderStatus; label: string }[] = [
    { status: 'delivered', label: 'Delivered' },
    { status: 'confirmed', label: 'Confirmed / Packing' },
    { status: 'pending_confirmation', label: 'Pending Confirmation' },
    { status: 'cancelled', label: 'Cancelled' },
  ];

  const orderStatusDistribution: OrderStatusBreakdown[] = orderStatuses.map((st) => {
    const matching = currentOrders.filter((o) => o.orderStatus === st.status);
    const amount = matching.reduce((sum, o) => sum + o.totalPaise, 0);
    return {
      status: st.status,
      label: st.label,
      count: matching.length,
      amountPaise: amount,
      percentage:
        currOnline.grossSalesPaise > 0 ? Number(((amount / currOnline.grossSalesPaise) * 100).toFixed(1)) : 0,
    };
  });

  // ----------------------------------------------------
  // FLOWER PRODUCT PERFORMANCE
  // ----------------------------------------------------
  let flowerPerformance: FlowerPerformanceItem[] = [];

  if (view === 'stall') {
    // Generate flower performance items from stall daily entries
    const stallCategories = [
      {
        id: 'stall-jasmine',
        name: 'Jasmine (Mallepoovu)',
        variety: 'Fresh Mogra',
        salesPaise: currStall.jasmineSalesPaise,
        costPaise: Math.round(currStall.flowerPurchasePaise * 0.4),
      },
      {
        id: 'stall-marigold',
        name: 'Marigold (Banthipoovu)',
        variety: 'Yellow & Orange',
        salesPaise: currStall.marigoldSalesPaise,
        costPaise: Math.round(currStall.flowerPurchasePaise * 0.3),
      },
      {
        id: 'stall-mixed',
        name: 'Mixed Flowers & Petals',
        variety: 'Puja Mix',
        salesPaise: currStall.mixedFlowersSalesPaise,
        costPaise: Math.round(currStall.flowerPurchasePaise * 0.2),
      },
      {
        id: 'stall-other',
        name: 'Other Flowers & Garlands',
        variety: 'Roses & Seasonal',
        salesPaise: currStall.otherFlowersSalesPaise,
        costPaise: Math.round(currStall.flowerPurchasePaise * 0.1),
      },
    ];

    flowerPerformance = stallCategories.map((cat) => {
      const profit = cat.salesPaise - cat.costPaise;
      const margin = cat.salesPaise > 0 ? Number(((profit / cat.salesPaise) * 100).toFixed(1)) : 0;
      return {
        productId: cat.id,
        name: cat.name,
        category: 'physical-stall',
        variety: cat.variety,
        quantitySold: currentStallEntries.length,
        ordersCount: currentStallEntries.length,
        salesRevenuePaise: cat.salesPaise,
        estimatedCostPaise: cat.costPaise,
        profitContributionPaise: profit,
        marginPercent: margin,
      };
    });
  } else {
    // Online catalogue performance
    const validOrders = currentOrders.filter((o) => o.orderStatus !== 'cancelled');
    const itemsMap = new Map<string, { product: Product; quantity: number; revenuePaise: number; count: number }>();

    for (const order of validOrders) {
      for (const item of order.items) {
        const prod = products.find((p) => p.id === item.productId) || {
          id: item.productId,
          name: item.name,
          category: 'daily-puja',
          pricePaise: item.pricePaise,
          unit: 'unit',
          description: '',
          imageUrl: '',
          inStock: true,
        };

        const existing = itemsMap.get(item.productId) || {
          product: prod as Product,
          quantity: 0,
          revenuePaise: 0,
          count: 0,
        };

        existing.quantity += item.quantity;
        existing.revenuePaise += item.pricePaise * item.quantity;
        existing.count += 1;
        itemsMap.set(item.productId, existing);
      }
    }

    flowerPerformance = Array.from(itemsMap.values()).map(({ product, quantity, revenuePaise, count }) => {
      const estimatedCost = Math.round(revenuePaise * 0.55);
      const profit = revenuePaise - estimatedCost;
      const margin = revenuePaise > 0 ? Number(((profit / revenuePaise) * 100).toFixed(1)) : 0;

      return {
        productId: product.id,
        name: product.name,
        teluguName: product.teluguName,
        category: product.category,
        quantitySold: quantity,
        ordersCount: count,
        salesRevenuePaise: revenuePaise,
        estimatedCostPaise: estimatedCost,
        profitContributionPaise: profit,
        marginPercent: margin,
      };
    });

    flowerPerformance.sort((a, b) => b.salesRevenuePaise - a.salesRevenuePaise);
  }

  // ----------------------------------------------------
  // SUBSCRIPTIONS & FESTIVALS
  // ----------------------------------------------------
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
    upcomingDeliveriesCount: activeSubs.length * 3,
  };

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

  // Recent orders
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
    view,
    dateRange,
    kpis: effectiveKPIs,
    stallKPIs,
    combinedKPIs,
    channelContribution,
    categoryBreakdown,
    hasRecordedFlowerCosts,
    dailyTrend,
    monthlyBreakdown,
    paymentDistribution,
    orderStatusDistribution,
    flowerPerformance,
    subscriptions: subscriptionsSummary,
    festivals: festivalSummary,
    stallEntries: currentStallEntries,
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
  stallEntries?: StallDailyEntry[];
}): string {
  const { summary, orders, expenses, stallEntries = [] } = params;
  const view = summary.view || 'combined';

  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];

  // 1. Header Metadata
  const viewTitle =
    view === 'stall'
      ? 'Physical Flower Stall Analysis'
      : view === 'online'
      ? 'Online Website Business Analysis'
      : 'Consolidated Business Analysis (Stall + Online)';

  rows.push(escapeCSV(`Mahesh Flora - Financial Analysis Report - ${viewTitle}`));
  rows.push(escapeCSV(`Reporting Period: ${summary.dateRange.label} (${summary.dateRange.fromDate} to ${summary.dateRange.toDate})`));
  rows.push(escapeCSV(`Generated at: ${new Date().toISOString()} (IST)`));
  rows.push('');

  // 2. Financial Summary Block
  rows.push(escapeCSV('--- FINANCIAL SUMMARY ---'));
  rows.push(['Metric', 'Current Period', 'Previous Period', 'Change', 'Notes'].map(escapeCSV).join(','));

  if (view === 'stall' && summary.stallKPIs) {
    const k = summary.stallKPIs;
    rows.push(['Total Stall Sales', k.totalStallSalesPaise.formatted, k.totalStallSalesPaise.previousFormatted || 'N/A', k.totalStallSalesPaise.percentChangeFormatted || '0%', 'Recorded flower sales'].map(escapeCSV).join(','));
    rows.push(['Cash Collections', k.stallCashCollectionsPaise.formatted, k.stallCashCollectionsPaise.previousFormatted || 'N/A', k.stallCashCollectionsPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['UPI Collections', k.stallUpiCollectionsPaise.formatted, k.stallUpiCollectionsPaise.previousFormatted || 'N/A', k.stallUpiCollectionsPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Total Collections', k.totalCollectionsPaise.formatted, k.totalCollectionsPaise.previousFormatted || 'N/A', k.totalCollectionsPaise.percentChangeFormatted || '0%', 'Payment breakdown of sales'].map(escapeCSV).join(','));
    rows.push(['Flower Purchases', k.flowerPurchaseExpensesPaise.formatted, k.flowerPurchaseExpensesPaise.previousFormatted || 'N/A', k.flowerPurchaseExpensesPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Transport Expenses', k.transportExpensesPaise.formatted, k.transportExpensesPaise.previousFormatted || 'N/A', k.transportExpensesPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Packaging & Other', k.otherExpensesPaise.formatted, k.otherExpensesPaise.previousFormatted || 'N/A', k.otherExpensesPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Total Recorded Expenses', k.totalRecordedExpensesPaise.formatted, k.totalRecordedExpensesPaise.previousFormatted || 'N/A', k.totalRecordedExpensesPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Preliminary Operating Result', k.preliminaryOperatingResultPaise.formatted, k.preliminaryOperatingResultPaise.previousFormatted || 'N/A', k.preliminaryOperatingResultPaise.percentChangeFormatted || '0%', 'Total Sales minus Recorded Expenses'].map(escapeCSV).join(','));
    rows.push(['Reconciliation Discrepancies', String(k.reconciliationDiscrepanciesCount.value), String(k.reconciliationDiscrepanciesCount.previousValue || 0), k.reconciliationDiscrepanciesCount.percentChangeFormatted || '0%', 'Days where collections differed from sales'].map(escapeCSV).join(','));
  } else if (view === 'combined' && summary.combinedKPIs) {
    const k = summary.combinedKPIs;
    rows.push(['Total Business Sales', k.totalBusinessSalesPaise.formatted, k.totalBusinessSalesPaise.previousFormatted || 'N/A', k.totalBusinessSalesPaise.percentChangeFormatted || '0%', 'Stall Sales + Online Sales'].map(escapeCSV).join(','));
    rows.push(['Stall Sales', k.stallSalesPaise.formatted, k.stallSalesPaise.previousFormatted || 'N/A', k.stallSalesPaise.percentChangeFormatted || '0%', `${k.stallSalesContributionPercent.formatted} of total`].map(escapeCSV).join(','));
    rows.push(['Online Sales', k.onlineSalesPaise.formatted, k.onlineSalesPaise.previousFormatted || 'N/A', k.onlineSalesPaise.percentChangeFormatted || '0%', `${k.onlineSalesContributionPercent.formatted} of total`].map(escapeCSV).join(','));
    rows.push(['Net Collected Revenue', k.netCollectedRevenuePaise.formatted, k.netCollectedRevenuePaise.previousFormatted || 'N/A', k.netCollectedRevenuePaise.percentChangeFormatted || '0%', 'Stall Collections + Online Verified Collections'].map(escapeCSV).join(','));
    rows.push(['Total Cash Collected', k.totalCashCollectionsPaise.formatted, k.totalCashCollectionsPaise.previousFormatted || 'N/A', k.totalCashCollectionsPaise.percentChangeFormatted || '0%', 'Stall Cash + Online COD Paid'].map(escapeCSV).join(','));
    rows.push(['Total UPI Collected', k.totalUpiCollectionsPaise.formatted, k.totalUpiCollectionsPaise.previousFormatted || 'N/A', k.totalUpiCollectionsPaise.percentChangeFormatted || '0%', 'Stall UPI + Online UPI Paid'].map(escapeCSV).join(','));
    rows.push(['Total Business Expenses', k.totalBusinessExpensesPaise.formatted, k.totalBusinessExpensesPaise.previousFormatted || 'N/A', k.totalBusinessExpensesPaise.percentChangeFormatted || '0%', 'Stall Expenses + Online Expenses'].map(escapeCSV).join(','));
    rows.push(['Combined Operating Result', k.combinedOperatingResultPaise.formatted, k.combinedOperatingResultPaise.previousFormatted || 'N/A', k.combinedOperatingResultPaise.percentChangeFormatted || '0%', 'Stall Operating Result + Online Net Profit'].map(escapeCSV).join(','));
  } else {
    // Online view
    rows.push(['Gross Sales', summary.kpis.grossSalesPaise.formatted, summary.kpis.grossSalesPaise.previousFormatted || 'N/A', summary.kpis.grossSalesPaise.percentChangeFormatted || '0%', 'Valid orders before refunds'].map(escapeCSV).join(','));
    rows.push(['Net Collected Revenue', summary.kpis.netRevenuePaise.formatted, summary.kpis.netRevenuePaise.previousFormatted || 'N/A', summary.kpis.netRevenuePaise.percentChangeFormatted || '0%', 'Verified collected payments minus refunds'].map(escapeCSV).join(','));
    rows.push(['Online Expenses', summary.kpis.totalExpensesPaise.formatted, summary.kpis.totalExpensesPaise.previousFormatted || 'N/A', summary.kpis.totalExpensesPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Online Operating Result / Profit', summary.kpis.netProfitPaise.formatted, summary.kpis.netProfitPaise.previousFormatted || 'N/A', summary.kpis.netProfitPaise.percentChangeFormatted || '0%', summary.kpis.netProfitPaise.note || ''].map(escapeCSV).join(','));
    rows.push(['Average Order Value (AOV)', summary.kpis.aovPaise.formatted, summary.kpis.aovPaise.previousFormatted || 'N/A', summary.kpis.aovPaise.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
    rows.push(['Total Orders', summary.kpis.totalOrdersCount.formatted, summary.kpis.totalOrdersCount.previousFormatted || 'N/A', summary.kpis.totalOrdersCount.percentChangeFormatted || '0%', ''].map(escapeCSV).join(','));
  }
  rows.push('');

  // 3. Flower Category Breakdown
  if (summary.categoryBreakdown && summary.categoryBreakdown.length > 0) {
    rows.push(escapeCSV('--- FLOWER CATEGORY BREAKDOWN ---'));
    rows.push(['Flower Category', 'Stall Sales (INR)', 'Online Sales (INR)', 'Total Sales (INR)', 'Share (%)'].map(escapeCSV).join(','));
    for (const c of summary.categoryBreakdown) {
      rows.push([
        c.label,
        (c.stallSalesPaise / 100).toFixed(2),
        (c.onlineSalesPaise / 100).toFixed(2),
        (c.totalSalesPaise / 100).toFixed(2),
        `${c.percentage.toFixed(1)}%`,
      ].map(escapeCSV).join(','));
    }
    rows.push('');
  }

  // 4. Daily Stall Entries (if Stall or Combined view)
  if ((view === 'stall' || view === 'combined') && stallEntries.length > 0) {
    const filteredStall = stallEntries.filter((s) => s.date >= summary.dateRange.fromDate && s.date <= summary.dateRange.toDate);
    rows.push(escapeCSV('--- DAILY STALL ENTRIES ---'));
    rows.push([
      'Date (IST)',
      'Jasmine (INR)',
      'Marigold (INR)',
      'Mixed (INR)',
      'Other (INR)',
      'Total Sales (INR)',
      'Cash (INR)',
      'UPI (INR)',
      'Total Collections (INR)',
      'Expenses (INR)',
      'Operating Result (INR)',
      'Reconciliation Diff (INR)',
      'Status',
      'Notes',
    ].map(escapeCSV).join(','));

    for (const s of filteredStall) {
      rows.push([
        s.date,
        ((s.flowerSales?.jasminePaise || 0) / 100).toFixed(2),
        ((s.flowerSales?.marigoldPaise || 0) / 100).toFixed(2),
        ((s.flowerSales?.mixedFlowersPaise || 0) / 100).toFixed(2),
        ((s.flowerSales?.otherFlowersPaise || 0) / 100).toFixed(2),
        (s.totalSalesPaise / 100).toFixed(2),
        ((s.collections?.cashPaise || 0) / 100).toFixed(2),
        ((s.collections?.upiPaise || 0) / 100).toFixed(2),
        (s.totalCollectionsPaise / 100).toFixed(2),
        (s.totalExpensesPaise / 100).toFixed(2),
        (s.preliminaryOperatingResultPaise / 100).toFixed(2),
        (s.reconciliationDifferencePaise / 100).toFixed(2),
        s.status,
        s.notes || '',
      ].map(escapeCSV).join(','));
    }
    rows.push('');
  }

  // 5. Itemized Online Orders (if Online or Combined view)
  if (view === 'online' || view === 'combined') {
    const filteredOrders = orders.filter((o) => {
      const istDate = toISTDateString(o.createdAt);
      return istDate >= summary.dateRange.fromDate && istDate <= summary.dateRange.toDate;
    });

    rows.push(escapeCSV('--- ITEMISED ONLINE ORDERS ---'));
    rows.push([
      'Date (IST)',
      'Order ID',
      'Order Type',
      'Order Status',
      'Payment Method',
      'Payment Status',
      'Items Summary',
      'Total Amount (INR)',
    ].map(escapeCSV).join(','));

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
        (o.totalPaise / 100).toFixed(2),
      ].map(escapeCSV).join(','));
    }
    rows.push('');
  }

  // 6. Itemized Expenses
  const filteredExpenses = expenses.filter(
    (e) => e.date >= summary.dateRange.fromDate && e.date <= summary.dateRange.toDate
  );
  if (filteredExpenses.length > 0) {
    rows.push(escapeCSV('--- ITEMISED OPERATING EXPENSES ---'));
    rows.push([
      'Date (IST)',
      'Expense ID',
      'Channel',
      'Category',
      'Description',
      'Amount (INR)',
      'Reference',
      'Logged By',
    ].map(escapeCSV).join(','));

    for (const e of filteredExpenses) {
      rows.push([
        e.date,
        e.id,
        e.channel || 'online',
        e.category,
        e.description,
        (e.amountPaise / 100).toFixed(2),
        e.referenceReceipt || 'N/A',
        e.createdBy,
      ].map(escapeCSV).join(','));
    }
  }

  return rows.join('\r\n');
}
