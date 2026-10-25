export type ProductCategory = 
  | 'daily-puja'
  | 'fragrant'
  | 'garlands'
  | 'loose-petals'
  | 'festivals';

export interface Product {
  id: string;
  name: string;
  teluguName?: string;
  description: string;
  category: ProductCategory;
  pricePaise: number; // Stored in integer paise (e.g. 6000 = ₹60.00)
  unit: string; // e.g. "per 100g", "per 250g packet", "per garland pair", "per 5 flowers"
  imageUrl: string;
  inStock: boolean;
  stockQuantity?: number;
  isPopular?: boolean;
  minimumOrderQty?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

export type AddressLabel = 'Home' | 'Work' | 'Parents' | 'Mandir/Pooja Room' | 'Other';

export interface UserProfile {
  uid: string;
  phone: string; // trusted verified mobile number from auth
  displayName?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedAddress {
  id: string;
  uid: string;
  recipientName: string;
  phone: string;
  alternatePhone?: string;
  flatNumber: string;
  tower?: string;
  block?: string;
  street?: string;
  apartmentCommunity?: string;
  locality: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  deliveryInstructions?: string;
  label: AddressLabel | string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  uid?: string;
  customerName: string;
  recipientName?: string;
  phone: string;
  apartmentCommunity: string;
  buildingTower?: string;
  tower?: string;
  block?: string;
  flatNumber: string;
  street?: string;
  locality?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  deliveryInstructions?: string;
  alternatePhone?: string;
  label?: string;
}

export type OrderType = 'one-time' | 'subscription' | 'festival';

export type DeliveryTimeSlot = 'morning' | 'evening';

export interface DeliverySchedule {
  type: OrderType;
  // For one-time order
  date?: string; // YYYY-MM-DD
  timeSlot?: DeliveryTimeSlot;
  // For weekly subscription
  daysOfWeek?: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[];
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  morningOrEvening?: DeliveryTimeSlot;
}

export type OrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'unpaid'
  | 'payment_due'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export type PaymentMethod =
  | 'cod'
  | 'whatsapp_upi'
  | 'razorpay';

export interface OrderItem {
  productId: string;
  name: string;
  pricePaise: number;
  unit: string;
  quantity: number;
  itemTotalPaise: number;
}

export interface Order {
  id: string; // e.g. MF-2026-9182
  accessToken?: string; // Unguessable secure token for guest order verification
  customer: Address;
  items: OrderItem[];
  orderType: OrderType;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  testPaymentPaise?: number; // Exactly 100 paise (₹1.00) when test payment mode is active
  // Free delivery promotion audit fields
  promotionId?: string;
  minPurchaseThresholdPaise?: number;
  discountAmountPaise?: number;
  eligibilityReason?: string;
  appliedDeliveryFeePaise?: number;
  deliverySchedule: DeliverySchedule;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  whatsappLink?: string;
  paymentProvider?: string; // e.g. 'razorpay'
  providerOrderId?: string; // Gateway order reference ID
  providerPaymentId?: string; // Gateway transaction reference ID
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  paidAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  statusUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string; // e.g. SUB-4821
  customer: Address;
  items: OrderItem[];
  daysOfWeek: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[];
  timeSlot: DeliveryTimeSlot;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  status: SubscriptionStatus;
  estimatedWeeklyPaise: number;
  skippedDates: string[]; // ['2026-10-20', ...]
  pausedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FestivalBookingStatus =
  | 'requested'
  | 'confirmed'
  | 'payment_pending'
  | 'paid'
  | 'cancelled';

export interface Festival {
  id: string;
  name: string;
  teluguName?: string;
  festivalDate: string; // YYYY-MM-DD
  bookingDeadline: string; // YYYY-MM-DD
  description: string;
  bannerUrl: string;
  availableProductIds: string[];
  isActive: boolean;
}

export interface FestivalBooking {
  id: string; // e.g. FEST-7712
  festivalId: string;
  festivalName: string;
  festivalDate: string;
  customer: Address;
  items: OrderItem[];
  specialGarlandNotes?: string;
  preferredSlot: 'early_morning' | 'morning' | 'evening';
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  status: FestivalBookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  whatsappLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  businessPhone: string;
  whatsappNumber: string; // e.g. "919876543210"
  upiId?: string; // e.g. "8341401793@upi"
  isPaymentTestMode?: boolean;
  addressText: string;
  city: string;
  state: string;
  pincode: string;
  openingHoursText: string;
  deliveryCutoffHour: number; // 20 = 8 PM
  standardDeliveryFeePaise: number; // e.g. 3000 = ₹30
  freeDeliveryThresholdPaise: number; // e.g. 29900 = ₹299
  minOrderAmountPaise: number; // e.g. 9900 = ₹99
  timeSlots: {
    morning: { label: string; time: string };
    evening: { label: string; time: string };
  };
  serviceableCommunities: string[];
  deliveryPromotion?: DeliveryPromotion;
}

export type DeliveryPromotionType =
  | 'all_orders'
  | 'first_time_customers'
  | 'first_n_orders'
  | 'first_time_and_first_n_orders';

export interface DeliveryPromotion {
  id: string; // e.g. 'promo-free-delivery'
  enabled: boolean;
  title: string;
  type: DeliveryPromotionType;
  minOrderAmountPaise: number;
  maxQualifyingOrders?: number; // Cap for first_n_orders
  currentQualifyingOrdersCount?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  maxUsesPerCustomer?: number;
  isCombinable?: boolean;
  bannerWording?: string;
}

export interface AdminCustomerSummary {
  uid: string;
  phone: string;
  name: string;
  completedOrdersCount: number;
  totalOrdersCount: number;
  totalSpendingPaise: number;
  firstOrderDate: string;
  lastOrderDate: string;
  hasActiveSubscription: boolean;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  email?: string;
  savedAddresses: SavedAddress[];
  orders: Order[];
  subscriptions: Subscription[];
  promotionRedemptions: {
    orderId: string;
    promotionId: string;
    discountAmountPaise: number;
    eligibilityReason: string;
    date: string;
  }[];
}

export interface DailyPriceItem {
  productId: string;
  name: string;
  pricePaise: number; // e.g. 4000 = ₹40.00
  unit: string; // e.g. "per 250g", "per 100g"
  inStock: boolean;
}

export interface DailyPriceRecord {
  id: string; // "current"
  status: 'draft' | 'published';
  items: Record<string, DailyPriceItem>;
  publishedAt?: string;
  publishedBy?: string;
  draftSavedAt?: string;
  updatedAt: string;
}

// ==================== EXPENSES ====================

export type ExpenseCategory = 'flower_purchase' | 'transport' | 'packaging' | 'other';

export interface Expense {
  id: string; // e.g. EXP-1729758291
  date: string; // YYYY-MM-DD (business date in IST)
  category: ExpenseCategory;
  amountPaise: number; // Stored in integer paise (e.g. 50000 = ₹500.00)
  description: string;
  referenceReceipt?: string;
  channel?: 'stall' | 'online' | 'shared'; // Defaults to 'online' or 'shared'
  stallEntryId?: string; // If synced from a stall entry
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== STALL DAILY ENTRIES ====================

export interface StallFlowerSales {
  jasminePaise: number;
  marigoldPaise: number;
  mixedFlowersPaise: number;
  otherFlowersPaise: number;
}

export interface StallCollections {
  cashPaise: number;
  upiPaise: number;
  otherPaise: number;
}

export interface StallExpenses {
  flowerPurchasePaise: number;
  transportPaise: number;
  packagingPaise: number;
  otherPaise: number;
}

export interface StallAuditEntry {
  timestamp: string;
  adminName: string;
  action: 'created' | 'updated' | 'finalized';
  reason?: string;
  previousValues?: Partial<StallDailyEntry>;
  changedFields?: string[];
}

export interface StallDailyEntry {
  id: string; // STALL-<stallId>-<date> e.g. STALL-main-2026-10-24
  stallId: string; // e.g. 'main'
  stallName?: string; // e.g. 'Main Flower Stall'
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  flowerSales: StallFlowerSales;
  totalSalesPaise: number;
  collections: StallCollections;
  totalCollectionsPaise: number;
  expenses: StallExpenses;
  totalExpensesPaise: number;
  preliminaryOperatingResultPaise: number; // totalSalesPaise - totalExpensesPaise
  reconciliationDifferencePaise: number; // totalCollectionsPaise - totalSalesPaise
  reconciliationAcknowledged: boolean;
  reconciliationReason?: string;
  notes?: string;
  status: 'draft' | 'finalized';
  version: number;
  auditHistory: StallAuditEntry[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// ==================== ANALYTICS & DASHBOARD ====================

export type AnalyticsView = 'combined' | 'stall' | 'online';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export interface DateRangeResult {
  preset: DatePreset;
  label: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  previousFromDate: string; // YYYY-MM-DD
  previousToDate: string; // YYYY-MM-DD
  previousLabel: string;
  durationDays: number;
}

export interface FinancialMetric {
  value: number; // paise, count, or percentage
  formatted: string;
  previousValue?: number;
  previousFormatted?: string;
  diff?: number;
  diffFormatted?: string;
  percentChange?: number;
  percentChangeFormatted?: string;
  trend?: 'up' | 'down' | 'neutral';
  isPositiveGood?: boolean;
  isEstimate?: boolean;
  note?: string;
}

export interface AnalyticsKPIs {
  grossSalesPaise: FinancialMetric;
  netRevenuePaise: FinancialMetric;
  totalOrdersCount: FinancialMetric;
  completedOrdersCount: FinancialMetric;
  pendingOrdersCount: FinancialMetric;
  cancelledOrdersCount: FinancialMetric;
  aovPaise: FinancialMetric;
  flowerPurchaseExpensesPaise: FinancialMetric;
  transportExpensesPaise: FinancialMetric;
  otherExpensesPaise: FinancialMetric;
  totalExpensesPaise: FinancialMetric;
  netProfitPaise: FinancialMetric;
  profitMarginPercent: FinancialMetric;
}

export interface FlowerPerformanceItem {
  productId: string;
  name: string;
  teluguName?: string;
  variety?: string;
  category?: string;
  quantitySold: number;
  ordersCount: number;
  salesRevenuePaise: number;
  estimatedCostPaise: number;
  profitContributionPaise: number;
  marginPercent: number;
}

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "24 Oct"
  grossSalesPaise: number;
  netRevenuePaise: number;
  expensesPaise: number;
  netProfitPaise: number;
  ordersCount: number;
}

export interface MonthlyBreakdownPoint {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Oct"
  grossSalesPaise: number;
  netRevenuePaise: number;
  expensesPaise: number;
  netProfitPaise: number;
  ordersCount: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod | string;
  label: string;
  count: number;
  amountPaise: number;
  percentage: number;
}

export interface OrderStatusBreakdown {
  status: OrderStatus;
  label: string;
  count: number;
  amountPaise: number;
  percentage: number;
}

export interface SubscriptionsAnalytics {
  activeCount: number;
  pausedCount: number;
  cancelledCount: number;
  totalCount: number;
  newInPeriodCount: number;
  estimatedWeeklyRevenuePaise: number;
  upcomingDeliveriesCount: number;
}

export interface FestivalBookingsAnalytics {
  totalBookingsCount: number;
  paidBookingsCount: number;
  pendingPaymentCount: number;
  cancelledCount: number;
  totalRevenuePaise: number;
  collectedRevenuePaise: number;
  upcomingFestivalDeliveriesCount: number;
}

export interface StallKPIs {
  totalStallSalesPaise: FinancialMetric;
  stallCashCollectionsPaise: FinancialMetric;
  stallUpiCollectionsPaise: FinancialMetric;
  stallOtherCollectionsPaise: FinancialMetric;
  totalCollectionsPaise: FinancialMetric;
  flowerPurchaseExpensesPaise: FinancialMetric;
  transportExpensesPaise: FinancialMetric;
  packagingExpensesPaise: FinancialMetric;
  otherExpensesPaise: FinancialMetric;
  totalRecordedExpensesPaise: FinancialMetric;
  preliminaryOperatingResultPaise: FinancialMetric;
  reconciliationDiscrepanciesCount: FinancialMetric;
  reconciliationNetDiffPaise: FinancialMetric;
}

export interface CombinedKPIs {
  totalBusinessSalesPaise: FinancialMetric; // Stall sales + Online sales
  netCollectedRevenuePaise: FinancialMetric; // Stall collections + Online paid revenue
  stallSalesPaise: FinancialMetric;
  onlineSalesPaise: FinancialMetric;
  totalBusinessExpensesPaise: FinancialMetric;
  combinedOperatingResultPaise: FinancialMetric;
  totalCashCollectionsPaise: FinancialMetric;
  totalUpiCollectionsPaise: FinancialMetric;
  totalOnlineOrdersCount: FinancialMetric;
  stallSalesContributionPercent: FinancialMetric;
  onlineSalesContributionPercent: FinancialMetric;
}

export interface ChannelContribution {
  stallSalesPaise: number;
  onlineSalesPaise: number;
  totalSalesPaise: number;
  stallPercentage: number;
  onlinePercentage: number;
}

export interface UnifiedCategoryBreakdownItem {
  category: 'jasmine' | 'marigold' | 'mixed' | 'other';
  label: string;
  stallSalesPaise: number;
  onlineSalesPaise: number;
  totalSalesPaise: number;
  percentage: number;
}

export interface AnalyticsSummaryResponse {
  view: AnalyticsView;
  dateRange: DateRangeResult;
  kpis: AnalyticsKPIs;
  stallKPIs?: StallKPIs;
  combinedKPIs?: CombinedKPIs;
  channelContribution?: ChannelContribution;
  categoryBreakdown?: UnifiedCategoryBreakdownItem[];
  hasRecordedFlowerCosts: boolean;
  dailyTrend: DailyTrendPoint[];
  monthlyBreakdown: MonthlyBreakdownPoint[];
  paymentDistribution: PaymentMethodBreakdown[];
  orderStatusDistribution: OrderStatusBreakdown[];
  flowerPerformance: FlowerPerformanceItem[];
  subscriptions: SubscriptionsAnalytics;
  festivals: FestivalBookingsAnalytics;
  stallEntries?: StallDailyEntry[];
  recentOrders: Array<{
    id: string;
    createdAt: string;
    customerName: string;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    totalPaise: number;
  }>;
}

