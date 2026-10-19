import fs from 'fs';
import path from 'path';
import {
  Product,
  Order,
  Subscription,
  Festival,
  FestivalBooking,
  BusinessSettings,
  OrderStatus,
  PaymentStatus,
  FestivalBookingStatus,
  DailyPriceItem,
  DailyPriceRecord,
} from '@/types';
import { INITIAL_PRODUCTS, INITIAL_FESTIVALS } from './seed';
import { DEFAULT_SETTINGS } from '../config';
import { getAdminDb, isAdminFirebaseConfigured } from '../firebase/admin';

function getFirestoreInstance() {
  if (process.env.ENABLE_DEV_MOCK_STORAGE === 'true') {
    return null;
  }
  if (!isAdminFirebaseConfigured()) {
    return null;
  }
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

export const DAILY_PRICE_PRODUCT_IDS = [
  'prod-yellow-marigold',
  'prod-orange-marigold',
  'prod-mixed-marigold',
  'prod-jasmine',
  'prod-rose',
  'prod-chamanthi',
];

export function buildDefaultDailyPrices(products: Product[]): DailyPriceRecord {
  const items: Record<string, DailyPriceItem> = {};
  for (const id of DAILY_PRICE_PRODUCT_IDS) {
    const prod = products.find((p) => p.id === id);
    if (prod) {
      items[id] = {
        productId: prod.id,
        name: prod.name,
        pricePaise: prod.pricePaise,
        unit: prod.unit,
        inStock: prod.inStock,
      };
    }
  }

  return {
    id: 'current',
    status: 'published',
    items,
    publishedAt: new Date().toISOString(),
    publishedBy: 'admin@maheshflora.com',
    updatedAt: new Date().toISOString(),
  };
}

interface DatabaseData {
  products: Product[];
  orders: Order[];
  subscriptions: Subscription[];
  festivals: Festival[];
  festivalBookings: FestivalBooking[];
  settings: BusinessSettings;
  dailyPrices?: DailyPriceRecord;
  dailyPriceHistory?: DailyPriceRecord[];
}

// In-memory cache + persistent JSON file for safe, reproducible local development
const DATA_FILE = path.join(process.cwd(), '.dev-db.json');

let memoryDb: DatabaseData | null = null;

function initializeDb(): DatabaseData {
  const initialProducts = INITIAL_PRODUCTS;
  const initial: DatabaseData = {
    products: initialProducts,
    orders: [],
    subscriptions: [],
    festivals: INITIAL_FESTIVALS,
    festivalBookings: [],
    settings: DEFAULT_SETTINGS,
    dailyPrices: buildDefaultDailyPrices(initialProducts),
    dailyPriceHistory: [],
  };
  saveDb(initial);
  return initial;
}

function getDb(): DatabaseData {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const prods = parsed.products?.length ? parsed.products : INITIAL_PRODUCTS;
      return {
        products: prods,
        orders: parsed.orders || [],
        subscriptions: parsed.subscriptions || [],
        festivals: parsed.festivals?.length ? parsed.festivals : INITIAL_FESTIVALS,
        festivalBookings: parsed.festivalBookings || [],
        settings: parsed.settings || DEFAULT_SETTINGS,
        dailyPrices: parsed.dailyPrices || buildDefaultDailyPrices(prods),
        dailyPriceHistory: parsed.dailyPriceHistory || [],
      };
    } catch {
      // If parsing fails, fall back to initial
    }
  }
  return initializeDb();
}

function saveDb(data: DatabaseData) {
  memoryDb = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database file:', err);
  }
}

// ==================== PRODUCTS ====================

export async function getProducts(): Promise<Product[]> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const snap = await firestore.collection('products').get();
      if (!snap.empty) {
        return snap.docs.map((doc: any) => doc.data() as Product);
      }
      // If Firestore collection is empty, batch-seed with INITIAL_PRODUCTS
      const batch = firestore.batch();
      for (const prod of INITIAL_PRODUCTS) {
        batch.set(firestore.collection('products').doc(prod.id), prod);
      }
      await batch.commit();
      return [...INITIAL_PRODUCTS];
    } catch (err) {
      console.warn('Firestore getProducts error, falling back to local store:', err);
    }
  }

  const db = getDb();
  return [...db.products];
}

/**
 * Returns only currently available/in-stock flower products for customer-facing display.
 */
export async function getAvailableProducts(): Promise<Product[]> {
  const prods = await getProducts();
  return prods.filter((p) => p.inStock);
}

export async function getProductById(id: string): Promise<Product | null> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const doc = await firestore.collection('products').doc(id).get();
      if (doc.exists) {
        return doc.data() as Product;
      }
    } catch (err) {
      console.warn('Firestore getProductById error, falling back to local store:', err);
    }
  }

  const db = getDb();
  return db.products.find((p) => p.id === id) || null;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const db = getDb();
  const index = db.products.findIndex((p) => p.id === id);
  const now = new Date().toISOString();
  let updated: Product;

  if (index !== -1) {
    updated = {
      ...db.products[index],
      ...updates,
      updatedAt: now,
    };
    db.products[index] = updated;
    saveDb(db);
  } else {
    const existing = await getProductById(id);
    if (!existing) {
      throw new Error(`Product not found: ${id}`);
    }
    updated = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
  }

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      await firestore.collection('products').doc(id).set(updated, { merge: true });
    } catch (err) {
      console.warn('Firestore updateProduct error:', err);
    }
  }

  return updated;
}

export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const newProduct: Product = {
    ...product,
    id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = getDb();
  db.products.push(newProduct);
  saveDb(db);

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      await firestore.collection('products').doc(newProduct.id).set(newProduct);
    } catch (err) {
      console.warn('Firestore addProduct error:', err);
    }
  }

  return newProduct;
}

// ==================== ORDERS ====================

export async function getOrders(): Promise<Order[]> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const snap = await firestore.collection('orders').orderBy('createdAt', 'desc').get();
      if (!snap.empty) {
        return snap.docs.map((doc: any) => doc.data() as Order);
      }
    } catch (err) {
      console.warn('Firestore getOrders error, falling back to local store:', err);
    }
  }

  const db = getDb();
  return [...db.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getOrderById(id: string): Promise<Order | null> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const doc = await firestore.collection('orders').doc(id).get();
      if (doc.exists) {
        return doc.data() as Order;
      }
    } catch (err) {
      console.warn('Firestore getOrderById error, falling back to local store:', err);
    }
  }

  const db = getDb();
  return db.orders.find((o) => o.id === id) || null;
}

export async function getOrdersByPhone(phone: string): Promise<Order[]> {
  const db = getDb();
  const clean = phone.replace(/[^0-9]/g, '').slice(-10);
  if (!clean || clean.length < 10) return [];
  return [...db.orders]
    .filter((o) => o.customer.phone.replace(/[^0-9]/g, '').slice(-10) === clean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOrdersByCustomerUid(uid: string): Promise<Order[]> {
  if (!uid) return [];
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const snap = await firestore
        .collection('orders')
        .where('customer.uid', '==', uid)
        .get();
      if (!snap.empty) {
        const list: Order[] = snap.docs.map((d: any) => d.data() as Order);
        return list.sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (err) {
      console.warn('Firestore getOrdersByCustomerUid error:', err);
    }
  }

  const db = getDb();
  return [...db.orders]
    .filter((o) => o.customer.uid === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOrdersByIds(ids: string[]): Promise<Order[]> {
  const db = getDb();
  const set = new Set(ids);
  return [...db.orders]
    .filter((o) => set.has(o.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createOrder(order: Order): Promise<Order> {
  const db = getDb();
  // Prevent duplicate insertion
  const existing = db.orders.find((o) => o.id === order.id);
  if (existing) {
    return existing;
  }
  if (!order.statusUpdatedAt) {
    order.statusUpdatedAt = order.createdAt;
  }
  db.orders.push(order);
  saveDb(db);

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      await firestore.collection('orders').doc(order.id).set(order);
    } catch (err) {
      console.warn('Firestore createOrder error:', err);
    }
  }

  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const now = new Date().toISOString();
  const db = getDb();
  const order = db.orders.find((o) => o.id === id);
  if (order) {
    order.orderStatus = status;
    order.statusUpdatedAt = now;
    order.updatedAt = now;
    if (status === 'cancelled') {
      order.cancelledAt = order.cancelledAt || now;
    }
    saveDb(db);
  }

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const updates: any = {
        orderStatus: status,
        statusUpdatedAt: now,
        updatedAt: now,
      };
      if (status === 'cancelled') {
        updates.cancelledAt = now;
      }
      await firestore.collection('orders').doc(id).set(updates, { merge: true });
    } catch (err) {
      console.warn('Firestore updateOrderStatus error:', err);
    }
  }

  const finalOrder = await getOrderById(id);
  if (!finalOrder) {
    throw new Error(`Order not found: ${id}`);
  }
  return finalOrder;
}

export async function cancelOrder(id: string, reason?: string): Promise<Order> {
  const now = new Date().toISOString();
  const db = getDb();
  const order = db.orders.find((o) => o.id === id);
  if (order) {
    order.orderStatus = 'cancelled';
    order.cancelledAt = now;
    order.statusUpdatedAt = now;
    if (reason) {
      order.cancellationReason = reason;
    }
    if (order.paymentStatus === 'payment_due') {
      order.paymentStatus = 'unpaid';
    }
    order.updatedAt = now;
    saveDb(db);
  }

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const updates: any = {
        orderStatus: 'cancelled',
        cancelledAt: now,
        statusUpdatedAt: now,
        updatedAt: now,
      };
      if (reason) updates.cancellationReason = reason;
      await firestore.collection('orders').doc(id).set(updates, { merge: true });
    } catch (err) {
      console.warn('Firestore cancelOrder error:', err);
    }
  }

  const finalOrder = await getOrderById(id);
  if (!finalOrder) {
    throw new Error(`Order not found: ${id}`);
  }
  return finalOrder;
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  meta?: { razorpayPaymentId?: string; razorpayOrderId?: string }
): Promise<Order> {
  const now = new Date().toISOString();
  const db = getDb();
  const order = db.orders.find((o) => o.id === id);
  if (order) {
    order.paymentStatus = paymentStatus;
    if (meta?.razorpayPaymentId) {
      order.razorpayPaymentId = meta.razorpayPaymentId;
    }
    if (meta?.razorpayOrderId) {
      order.razorpayOrderId = meta.razorpayOrderId;
    }
    if (paymentStatus === 'paid') {
      order.paidAt = now;
      if (order.orderStatus === 'pending_confirmation') {
        order.orderStatus = 'confirmed';
      }
    }
    order.updatedAt = now;
    saveDb(db);
  }

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const updates: any = {
        paymentStatus,
        updatedAt: now,
      };
      if (meta?.razorpayPaymentId) updates.razorpayPaymentId = meta.razorpayPaymentId;
      if (meta?.razorpayOrderId) updates.razorpayOrderId = meta.razorpayOrderId;
      if (paymentStatus === 'paid') {
        updates.paidAt = now;
        updates.orderStatus = 'confirmed';
      }
      await firestore.collection('orders').doc(id).set(updates, { merge: true });
    } catch (err) {
      console.warn('Firestore updateOrderPaymentStatus error:', err);
    }
  }

  const finalOrder = await getOrderById(id);
  if (!finalOrder) {
    throw new Error(`Order not found: ${id}`);
  }
  return finalOrder;
}

// ==================== SUBSCRIPTIONS ====================

export async function getSubscriptions(): Promise<Subscription[]> {
  const db = getDb();
  return [...db.subscriptions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const db = getDb();
  return db.subscriptions.find((s) => s.id === id) || null;
}

export async function getSubscriptionsByPhone(phone: string): Promise<Subscription[]> {
  const db = getDb();
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return db.subscriptions.filter(
    (s) => s.customer.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10))
  );
}

export async function createSubscription(subscription: Subscription): Promise<Subscription> {
  const db = getDb();
  db.subscriptions.push(subscription);
  saveDb(db);
  return subscription;
}

export async function pauseSubscription(id: string): Promise<Subscription> {
  const db = getDb();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) {
    throw new Error(`Subscription not found: ${id}`);
  }
  sub.status = 'paused';
  sub.pausedAt = new Date().toISOString();
  sub.updatedAt = new Date().toISOString();
  saveDb(db);
  return sub;
}

export async function resumeSubscription(id: string): Promise<Subscription> {
  const db = getDb();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) {
    throw new Error(`Subscription not found: ${id}`);
  }
  sub.status = 'active';
  delete sub.pausedAt;
  sub.updatedAt = new Date().toISOString();
  saveDb(db);
  return sub;
}

export async function skipSubscriptionDate(id: string, date: string): Promise<Subscription> {
  const db = getDb();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) {
    throw new Error(`Subscription not found: ${id}`);
  }
  if (!sub.skippedDates.includes(date)) {
    sub.skippedDates.push(date);
    sub.updatedAt = new Date().toISOString();
    saveDb(db);
  }
  return sub;
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  const db = getDb();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) {
    throw new Error(`Subscription not found: ${id}`);
  }
  sub.status = 'cancelled';
  sub.updatedAt = new Date().toISOString();
  saveDb(db);
  return sub;
}

// ==================== FESTIVALS ====================

export async function getFestivals(): Promise<Festival[]> {
  const db = getDb();
  const todayStr = new Date().toISOString().split('T')[0];
  return db.festivals
    .filter((f) => f.festivalDate >= todayStr && f.isActive)
    .sort((a, b) => a.festivalDate.localeCompare(b.festivalDate));
}

export async function getFestivalById(id: string): Promise<Festival | null> {
  const db = getDb();
  return db.festivals.find((f) => f.id === id) || null;
}

export async function addFestival(festival: Omit<Festival, 'id'>): Promise<Festival> {
  const db = getDb();
  const newFest: Festival = {
    ...festival,
    id: `fest-${Date.now()}`,
  };
  db.festivals.push(newFest);
  saveDb(db);
  return newFest;
}

export async function getFestivalBookings(): Promise<FestivalBooking[]> {
  const db = getDb();
  return [...db.festivalBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createFestivalBooking(booking: FestivalBooking): Promise<FestivalBooking> {
  const db = getDb();
  db.festivalBookings.push(booking);
  saveDb(db);
  return booking;
}

export async function updateFestivalBookingStatus(
  id: string,
  status: FestivalBookingStatus
): Promise<FestivalBooking> {
  const db = getDb();
  const booking = db.festivalBookings.find((b) => b.id === id);
  if (!booking) {
    throw new Error(`Festival booking not found: ${id}`);
  }
  booking.status = status;
  if (status === 'paid') {
    booking.paymentStatus = 'paid';
  }
  booking.updatedAt = new Date().toISOString();
  saveDb(db);
  return booking;
}

// ==================== SETTINGS ====================

export async function getSettings(): Promise<BusinessSettings> {
  const db = getDb();
  return { ...db.settings };
}

export async function updateSettings(updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
  const db = getDb();
  db.settings = {
    ...db.settings,
    ...updates,
  };
  saveDb(db);
  return { ...db.settings };
}

// ==================== DASHBOARD METRICS ====================

export async function getDashboardMetrics() {
  const db = getDb();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const allOrders = db.orders;
  const todaysOrders = allOrders.filter(
    (o) => o.createdAt.startsWith(todayStr) || o.deliverySchedule?.date === todayStr
  );

  const todaysSalesPaise = todaysOrders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.totalPaise, 0);

  const pendingOrders = allOrders.filter(
    (o) => o.orderStatus === 'pending_confirmation' || o.orderStatus === 'confirmed'
  ).length;

  const paidOrders = allOrders.filter((o) => o.paymentStatus === 'paid').length;
  const unpaidOrders = allOrders.filter((o) => o.paymentStatus === 'unpaid' || o.paymentStatus === 'pending').length;

  const awaitingDelivery = allOrders.filter(
    (o) => o.orderStatus === 'preparing' || o.orderStatus === 'out_for_delivery'
  ).length;

  const activeSubscriptions = db.subscriptions.filter((s) => s.status === 'active').length;
  const upcomingFestivalBookings = db.festivalBookings.filter(
    (b) => b.status !== 'cancelled'
  ).length;

  return {
    todayOrdersCount: todaysOrders.length,
    todaySalesPaise: todaysSalesPaise,
    totalOrdersCount: allOrders.length,
    pendingOrdersCount: pendingOrders,
    paidOrdersCount: paidOrders,
    unpaidOrdersCount: unpaidOrders,
    ordersAwaitingDeliveryCount: awaitingDelivery,
    activeSubscriptionsCount: activeSubscriptions,
    upcomingFestivalBookingsCount: upcomingFestivalBookings,
  };
}

// ==================== DAILY PRICES ====================

export async function getDailyPricesRecord(): Promise<DailyPriceRecord> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const doc = await firestore.collection('dailyPrices').doc('current').get();
      if (doc.exists) {
        const data = doc.data() as DailyPriceRecord;
        if (data && data.items && Object.keys(data.items).length > 0) {
          return data;
        }
      }
      const prods = await getProducts();
      const defaultRecord = buildDefaultDailyPrices(prods);
      await firestore.collection('dailyPrices').doc('current').set(defaultRecord);
      return defaultRecord;
    } catch (err) {
      console.warn('Firestore getDailyPricesRecord error, falling back to local store:', err);
    }
  }

  const db = getDb();
  if (!db.dailyPrices || Object.keys(db.dailyPrices.items || {}).length === 0) {
    const record = buildDefaultDailyPrices(db.products);
    db.dailyPrices = record;
    saveDb(db);
    return record;
  }
  return { ...db.dailyPrices };
}

export async function saveDailyPricesDraft(
  items: Record<string, DailyPriceItem>,
  adminUser?: string
): Promise<DailyPriceRecord> {
  const db = getDb();
  const current = db.dailyPrices || buildDefaultDailyPrices(db.products);

  const updated: DailyPriceRecord = {
    ...current,
    status: 'draft',
    items: {
      ...current.items,
      ...items,
    },
    draftSavedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.dailyPrices = updated;
  saveDb(db);

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      await firestore.collection('dailyPrices').doc('current').set(updated);
    } catch (err) {
      console.warn('Firestore saveDailyPricesDraft error:', err);
    }
  }

  return { ...updated };
}

export async function publishDailyPrices(
  items: Record<string, DailyPriceItem>,
  adminUser?: string
): Promise<DailyPriceRecord> {
  const db = getDb();
  const now = new Date().toISOString();

  // Validate items
  for (const [id, item] of Object.entries(items)) {
    if (typeof item.pricePaise !== 'number' || item.pricePaise < 0 || isNaN(item.pricePaise)) {
      throw new Error(`Invalid price for product ${item.name || id}: price cannot be negative or invalid`);
    }
  }

  const updated: DailyPriceRecord = {
    id: 'current',
    status: 'published',
    items,
    publishedAt: now,
    publishedBy: adminUser || 'Admin',
    updatedAt: now,
  };

  db.dailyPrices = updated;
  if (!db.dailyPriceHistory) {
    db.dailyPriceHistory = [];
  }
  db.dailyPriceHistory.push({ ...updated });

  // Synchronize changes back to db.products
  for (const [id, item] of Object.entries(items)) {
    const prod = db.products.find((p) => p.id === id);
    if (prod) {
      prod.pricePaise = Math.round(item.pricePaise);
      prod.inStock = Boolean(item.inStock);
      if (item.unit) {
        prod.unit = item.unit;
      }
      prod.updatedAt = now;
    }
  }

  saveDb(db);

  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const batch = firestore.batch();
      batch.set(firestore.collection('dailyPrices').doc('current'), updated);
      const historyRef = firestore.collection('dailyPriceHistory').doc(`hist-${Date.now()}`);
      batch.set(historyRef, updated);

      for (const [id, item] of Object.entries(items)) {
        const prodRef = firestore.collection('products').doc(id);
        batch.set(
          prodRef,
          {
            pricePaise: Math.round(item.pricePaise),
            inStock: Boolean(item.inStock),
            ...(item.unit ? { unit: item.unit } : {}),
            updatedAt: now,
          },
          { merge: true }
        );
      }
      await batch.commit();
    } catch (err) {
      console.warn('Firestore publishDailyPrices error:', err);
    }
  }

  return { ...updated };
}

export async function getDailyPriceHistory(): Promise<DailyPriceRecord[]> {
  const firestore = getFirestoreInstance();
  if (firestore) {
    try {
      const snap = await firestore
        .collection('dailyPriceHistory')
        .orderBy('publishedAt', 'desc')
        .limit(30)
        .get();
      if (!snap.empty) {
        return snap.docs.map((doc: any) => doc.data() as DailyPriceRecord);
      }
    } catch (err) {
      console.warn('Firestore getDailyPriceHistory error:', err);
    }
  }

  const db = getDb();
  return [...(db.dailyPriceHistory || [])].reverse();
}

// Helper to reset database for tests
export function _resetDbForTesting() {
  const prods = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  memoryDb = {
    products: prods,
    orders: [],
    subscriptions: [],
    festivals: JSON.parse(JSON.stringify(INITIAL_FESTIVALS)),
    festivalBookings: [],
    settings: { ...DEFAULT_SETTINGS },
    dailyPrices: buildDefaultDailyPrices(prods),
    dailyPriceHistory: [],
  };
  if (fs.existsSync(DATA_FILE)) {
    try {
      fs.unlinkSync(DATA_FILE);
    } catch {}
  }
}

