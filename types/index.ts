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

export interface SavedAddress {
  id: string;
  uid: string;
  recipientName: string;
  phone: string;
  alternatePhone?: string;
  flatNumber: string;
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
  buildingTower: string;
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
  deliverySchedule: DeliverySchedule;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  whatsappLink?: string;
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
