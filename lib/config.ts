import { BusinessSettings } from '@/types';

export const IS_PAYMENT_TEST_MODE =
  process.env.PAYMENT_TEST_MODE === 'true' ||
  process.env.NEXT_PUBLIC_PAYMENT_TEST_MODE === 'true';

export const TEST_PAYMENT_AMOUNT_PAISE = 100; // Exactly ₹1.00 (100 paise)

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: process.env.NEXT_PUBLIC_APP_NAME || "Mahesh Flora",
  tagline: "Fresh Daily Puja & Decorative Flowers Delivered to Your Doorstep",
  businessPhone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+918341401793",
  whatsappNumber: (process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+918341401793").replace(/[^0-9]/g, ''),
  upiId: process.env.NEXT_PUBLIC_BUSINESS_UPI_ID || "Q062496934@ybl",
  isPaymentTestMode: IS_PAYMENT_TEST_MODE,
  addressText: "Shop 4, Near Gachibowli Stadium Road, Gachibowli, Hyderabad, Telangana",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500032",
  openingHoursText: "Daily 5:30 AM – 9:00 PM (Fresh morning arrivals at 5:00 AM)",
  deliveryCutoffHour: 20, // 8:00 PM for next day morning deliveries
  standardDeliveryFeePaise: 3000, // ₹30.00
  freeDeliveryThresholdPaise: 29900, // Free delivery on orders above ₹299.00
  minOrderAmountPaise: 9900, // Minimum order ₹99.00
  timeSlots: {
    morning: {
      label: "Morning Puja Slot",
      time: "6:00 AM – 8:30 AM",
    },
    evening: {
      label: "Evening Sandhya Slot",
      time: "5:00 PM – 7:30 PM",
    },
  },
  serviceableCommunities: [
    "My Home Bhooja (Silpa Gram Craft Village)",
    "Aparna Serene Park (Kondapur)",
    "Jayabheri Silicon County (Hitec City)",
    "Prestige High Fields (Financial District)",
    "Rainbow Vistas Rockgarden (Hitec City)",
    "Lodha Bellezza (KPHB)",
    "My Home Avatar (Puppalaguda)",
    "Aparna Sarovar Zenith (Nallagandla)",
    "Lanco Hills (Manikonda)",
    "PBEL City (Peeramcheru)",
    "Other Gated Community / Apartment (Hyderabad)",
  ],
  deliveryPromotion: {
    id: 'promo-free-delivery',
    enabled: false,
    title: 'Free Delivery for First Time Customers',
    type: 'first_time_customers',
    minOrderAmountPaise: 0,
    maxQualifyingOrders: 100,
    currentQualifyingOrdersCount: 0,
    maxUsesPerCustomer: 1,
    isCombinable: true,
    bannerWording: '🎉 Free Delivery on your first order! Welcome to Mahesh Flora.',
  },
};

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}

export function formatINRWithDecimals(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Builds a compliant standard UPI URI for QR codes and mobile app intents.
 */
export function buildUpiPaymentUri(
  upiId: string,
  amountPaise: number,
  orderId: string,
  businessName: string = 'Mahesh Flora',
  scheme: 'upi' | 'phonepe' | 'tez' | 'paytmmp' = 'upi'
): string {
  const amountRupees = (amountPaise / 100).toFixed(2);
  const note = `Order ${orderId}`;
  const prefix = scheme === 'tez' ? 'tez://upi/pay' : `${scheme}://pay`;
  return `${prefix}?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&am=${amountRupees}&tn=${encodeURIComponent(note)}&cu=INR`;
}

export const DAILY_PRICE_PRODUCT_IDS = [
  'prod-yellow-marigold',
  'prod-orange-marigold',
  'prod-mixed-marigold',
  'prod-jasmine',
  'prod-rose',
  'prod-chamanthi',
] as const;

export const DAILY_FLOWERS_CONFIG = [
  {
    id: 'prod-yellow-marigold',
    name: 'Yellow Marigold',
    teluguName: 'పసుపు బంతి పువ్వు',
    defaultUnit: 'per 250g',
    unitOptions: ['per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/yellow-marigold.jpg',
  },
  {
    id: 'prod-orange-marigold',
    name: 'Orange Marigold',
    teluguName: 'నారింజ బంతి పువ్వు',
    defaultUnit: 'per 250g',
    unitOptions: ['per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/orange-marigold.jpg',
  },
  {
    id: 'prod-mixed-marigold',
    name: 'Mixed Marigold',
    teluguName: 'రంగు రంగుల బంతి పువ్వు',
    defaultUnit: 'per 250g',
    unitOptions: ['per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/mixed-marigold.jpg',
  },
  {
    id: 'prod-jasmine',
    name: 'Jasmine',
    teluguName: 'మల్లెపూలు',
    defaultUnit: 'per 100g',
    unitOptions: ['per 100g', 'per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/jasmine.jpg',
  },
  {
    id: 'prod-rose',
    name: 'Rose',
    teluguName: 'గులాబీలు',
    defaultUnit: 'per 100g',
    unitOptions: ['per 100g', 'per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/rose.jpg',
  },
  {
    id: 'prod-chamanthi',
    name: 'Chamanthi',
    teluguName: 'చామంతి పువ్వులు',
    defaultUnit: 'per 250g',
    unitOptions: ['per 250g', 'per 500g', 'per 1kg'],
    imageUrl: '/images/chamanthi.jpg',
  },
];


