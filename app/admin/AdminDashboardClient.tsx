'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Settings,
  Plus,
  Edit,
  Save,
  LogOut,
  AlertCircle,
  Search,
  Filter,
  DollarSign,
  Phone,
  Eye,
  RefreshCw,
  Tag,
  BarChart3,
  Receipt,
  Store,
  Users,
  Gift,
} from 'lucide-react';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import StallManagement from '@/components/admin/StallManagement';
import CustomerManagement from '@/components/admin/CustomerManagement';
import DeliveryOffersManagement from '@/components/admin/DeliveryOffersManagement';
import {
  Order,
  Product,
  Subscription,
  FestivalBooking,
  BusinessSettings,
  OrderStatus,
  PaymentStatus,
  DailyPriceItem,
  DailyPriceRecord
} from '@/types';
import { formatINR, DAILY_FLOWERS_CONFIG, DAILY_PRICE_PRODUCT_IDS } from '@/lib/config';
import { getClientAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface DashboardMetrics {
  todayOrdersCount: number;
  todaySalesPaise: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  ordersAwaitingDeliveryCount: number;
  activeSubscriptionsCount: number;
  upcomingFestivalBookingsCount: number;
}

export default function AdminDashboardClient({
  initialTab = 'overview',
}: {
  initialTab?: 'overview' | 'analytics' | 'stall' | 'daily-prices' | 'orders' | 'products' | 'subscriptions' | 'festivals' | 'customers' | 'delivery-offers' | 'settings';
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'passcode' | 'firebase'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Active sub-navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'stall' | 'daily-prices' | 'orders' | 'products' | 'subscriptions' | 'festivals' | 'customers' | 'delivery-offers' | 'settings'>(initialTab);

  // Live state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [festivalBookings, setFestivalBookings] = useState<FestivalBooking[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Daily Prices state
  const [dailyPricesRecord, setDailyPricesRecord] = useState<DailyPriceRecord | null>(null);
  const [dailyPriceDraftItems, setDailyPriceDraftItems] = useState<Record<string, DailyPriceItem>>({});
  const [dailyPricesSaving, setDailyPricesSaving] = useState(false);
  const [dailyPricesMessage, setDailyPricesMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showDailyPricesPreview, setShowDailyPricesPreview] = useState(false);

  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Editing product modal / inline state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editPriceRupees, setEditPriceRupees] = useState<number>(0);
  const [editUnit, setEditUnit] = useState<string>('');
  const [editInStock, setEditInStock] = useState<boolean>(true);

  // New product form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductTelugu, setNewProductTelugu] = useState('');
  const [newProductPriceRupees, setNewProductPriceRupees] = useState(50);
  const [newProductUnit, setNewProductUnit] = useState('per 100g');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImg, setNewProductImg] = useState('');

  // Settings form state
  const [editSettings, setEditSettings] = useState<Partial<BusinessSettings>>({});
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

  // Helper to fetch with admin key header
  const getAdminKey = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mahesh_admin_key') || '';
    }
    return '';
  };

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const key = getAdminKey();
    const headers = new Headers(options.headers || {});
    headers.set('x-admin-key', key);
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  // Check auth on mount and set up periodic refresh
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      loadAllData();
    }, 10000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const fetchInitialData = async () => {
    try {
      const res = await adminFetch('/api/admin/metrics');
      if (res.ok) {
        setIsAuthenticated(true);
        const data = await res.json();
        setMetrics(data.metrics);
        loadAllData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [ordRes, prodRes, subRes, festRes, setRes, dailyRes] = await Promise.all([
        adminFetch('/api/admin/orders'),
        adminFetch('/api/admin/products'),
        adminFetch('/api/subscriptions'),
        adminFetch('/api/admin/festivals'),
        adminFetch('/api/admin/settings'),
        adminFetch('/api/admin/daily-prices'),
      ]);

      if (ordRes.ok) {
        const d = await ordRes.json();
        setOrders(d.orders || []);
      }
      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(d.products || []);
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSubscriptions(d.subscriptions || []);
      }
      if (festRes.ok) {
        const d = await festRes.json();
        setFestivalBookings(d.bookings || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setSettings(d.settings);
        setEditSettings(d.settings);
      }
      if (dailyRes && dailyRes.ok) {
        const d = await dailyRes.json();
        if (d.record) {
          setDailyPricesRecord(d.record);
          if (d.record.items) {
            setDailyPriceDraftItems(d.record.items);
          }
        }
      }

      // Refresh metrics
      const metRes = await adminFetch('/api/admin/metrics');
      if (metRes.ok) {
        const metData = await metRes.json();
        setMetrics(metData.metrics);
      }
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  };

  const handleDraftItemPriceChange = (id: string, rupees: number) => {
    setDailyPriceDraftItems((prev) => {
      const meta = DAILY_FLOWERS_CONFIG.find((f) => f.id === id);
      const current = prev[id] || {
        productId: id,
        name: meta?.name || id,
        pricePaise: 0,
        unit: meta?.defaultUnit || 'per 250g',
        inStock: true,
      };
      return {
        ...prev,
        [id]: {
          ...current,
          pricePaise: Math.max(0, Math.round(rupees * 100)),
        },
      };
    });
  };

  const handleDraftItemUnitChange = (id: string, unit: string) => {
    setDailyPriceDraftItems((prev) => {
      const meta = DAILY_FLOWERS_CONFIG.find((f) => f.id === id);
      const current = prev[id] || {
        productId: id,
        name: meta?.name || id,
        pricePaise: 0,
        unit: meta?.defaultUnit || 'per 250g',
        inStock: true,
      };
      return {
        ...prev,
        [id]: {
          ...current,
          unit,
        },
      };
    });
  };

  const handleDraftItemStockToggle = (id: string) => {
    setDailyPriceDraftItems((prev) => {
      const meta = DAILY_FLOWERS_CONFIG.find((f) => f.id === id);
      const current = prev[id] || {
        productId: id,
        name: meta?.name || id,
        pricePaise: 0,
        unit: meta?.defaultUnit || 'per 250g',
        inStock: true,
      };
      return {
        ...prev,
        [id]: {
          ...current,
          inStock: !current.inStock,
        },
      };
    });
  };

  const handleSaveDailyPricesDraft = async () => {
    setDailyPricesSaving(true);
    setDailyPricesMessage(null);
    try {
      for (const [id, item] of Object.entries(dailyPriceDraftItems)) {
        if (typeof item.pricePaise !== 'number' || isNaN(item.pricePaise) || item.pricePaise < 0) {
          setDailyPricesMessage({
            type: 'error',
            text: `Invalid price for "${item.name || id}". Price cannot be negative or empty.`,
          });
          setDailyPricesSaving(false);
          return;
        }
      }

      const res = await adminFetch('/api/admin/daily-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          items: dailyPriceDraftItems,
          adminName: 'Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save draft prices');
      }

      setDailyPricesRecord(data.record);
      setDailyPricesMessage({
        type: 'success',
        text: 'Changes saved as draft. Review and click "Publish Today\'s Prices" when ready to push live.',
      });
    } catch (err: any) {
      setDailyPricesMessage({ type: 'error', text: err.message || 'Failed to save draft' });
    } finally {
      setDailyPricesSaving(false);
    }
  };

  const handlePublishDailyPrices = async () => {
    setDailyPricesSaving(true);
    setDailyPricesMessage(null);
    try {
      for (const flower of DAILY_FLOWERS_CONFIG) {
        const item = dailyPriceDraftItems[flower.id];
        if (!item || typeof item.pricePaise !== 'number' || isNaN(item.pricePaise) || item.pricePaise <= 0) {
          setDailyPricesMessage({
            type: 'warning',
            text: `Please enter a valid selling price greater than ₹0 for "${flower.name}" before publishing today's rates.`,
          });
          setDailyPricesSaving(false);
          return;
        }
      }

      const res = await adminFetch('/api/admin/daily-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          items: dailyPriceDraftItems,
          adminName: 'Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish daily prices');
      }

      setDailyPricesRecord(data.record);
      setDailyPricesMessage({
        type: 'success',
        text: `Today's prices published successfully at ${new Date(data.record.publishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}! Public catalogue and orders are now live with these rates.`,
      });
      await loadAllData();
    } catch (err: any) {
      setDailyPricesMessage({ type: 'error', text: err.message || 'Failed to publish prices' });
    } finally {
      setDailyPricesSaving(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      let requestBody: any = {};

      if (authMode === 'firebase') {
        const auth = getClientAuth();
        if (!auth) {
          throw new Error(
            'Firebase is not configured yet. Please configure Firebase in .env.local or log in using your Admin Passcode.'
          );
        }
        const userCredential = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
        const idToken = await userCredential.user.getIdToken();
        requestBody = { idToken, email: userCredential.user.email };
      } else {
        requestBody = { passcode };
      }

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('mahesh_admin_key', data.adminKey || passcode);
      }

      setIsAuthenticated(true);
      await loadAllData();
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mahesh_admin_key');
    }
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  // Status transitions
  const handleUpdateOrderStatus = async (
    orderId: string,
    orderStatus?: OrderStatus,
    paymentStatus?: PaymentStatus,
    recordCod?: boolean
  ) => {
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderStatus,
          paymentStatus,
          recordCodCollection: recordCod,
        }),
      });

      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Error updating order:', e);
    }
  };

  // Product edit save
  const handleSaveProduct = async (id: string) => {
    try {
      const res = await adminFetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: {
            pricePaise: Math.round(editPriceRupees * 100),
            unit: editUnit,
            inStock: editInStock,
          },
        }),
      });
      if (res.ok) {
        setEditingProductId(null);
        await loadAllData();
      }
    } catch (e) {
      console.error('Product save error', e);
    }
  };

  // Add new product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName,
          teluguName: newProductTelugu,
          pricePaise: Math.round(newProductPriceRupees * 100),
          unit: newProductUnit,
          description: newProductDesc,
          imageUrl: newProductImg,
          inStock: true,
        }),
      });
      if (res.ok) {
        setShowAddProduct(false);
        setNewProductName('');
        setNewProductTelugu('');
        setNewProductDesc('');
        setNewProductImg('');
        await loadAllData();
      }
    } catch (e) {
      console.error('Add product error', e);
    }
  };

  // Update festival booking status
  const handleUpdateBookingStatus = async (bookingId: string, status: any) => {
    try {
      const res = await adminFetch('/api/admin/festivals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
      if (res.ok) {
        await loadAllData();
      }
    } catch (e) {
      console.error('Update booking error', e);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaveMsg(null);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSettings),
      });
      if (res.ok) {
        setSettingsSaveMsg('Settings updated successfully!');
        await loadAllData();
      }
    } catch (e: any) {
      setSettingsSaveMsg(`Error: ${e.message}`);
    }
  };

  // ==================== LOGIN SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-6 sm:p-8 shadow-elevated space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-botanical-800 text-cream-50 flex items-center justify-center mx-auto shadow-soft">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div className="text-center">
            <h1 className="font-serif font-bold text-2xl text-botanical-900">
              Mahesh Flora Store Admin
            </h1>
            <p className="text-xs text-stone-600 mt-1">
              Authorized access required for inventory, order lifecycle, and delivery dispatch.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex rounded-xl bg-cream-200/70 p-1 border border-botanical-200">
            <button
              type="button"
              onClick={() => { setAuthMode('passcode'); setAuthError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'passcode'
                  ? 'bg-cream-50 text-botanical-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Passcode Login
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('firebase'); setAuthError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'firebase'
                  ? 'bg-cream-50 text-botanical-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Firebase Auth
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'passcode' ? (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Admin Passcode / Secret Key *
                </label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter admin passcode"
                  className="w-full px-3 py-2.5 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Server administrative key configured via <code className="bg-cream-200 px-1 py-0.5 rounded font-mono">ADMIN_SECRET_KEY</code>
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Firebase Admin Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@maheshflora.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs sm:text-sm transition active:scale-95 disabled:opacity-50"
            >
              {authLoading ? 'Verifying...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (orderStatusFilter !== 'all' && order.orderStatus !== orderStatusFilter) {
      return false;
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      const matchId = order.id.toLowerCase().includes(q);
      const matchCust = order.customer.customerName.toLowerCase().includes(q);
      const matchPhone = order.customer.phone.includes(q);
      return matchId || matchCust || matchPhone;
    }
    return true;
  });

  // ==================== DASHBOARD VIEW ====================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-botanical-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-2xl text-botanical-900">
              Admin Operations Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Live Verified
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time orders, dawn packing, inventory pricing, and gated community delivery dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            title="Refresh All Data"
            className="p-2 rounded-xl border border-botanical-200 bg-cream-50 text-botanical-800 hover:bg-cream-200/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-botanical-100">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'analytics', label: 'Analysis Dashboard', icon: BarChart3 },
          { id: 'stall', label: 'Stall Management', icon: Store },
          { id: 'daily-prices', label: 'Daily Prices', icon: DollarSign },
          { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
          { id: 'products', label: `Inventory (${products.length})`, icon: Package },
          { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})`, icon: Calendar },
          { id: 'festivals', label: `Festival Bookings (${festivalBookings.length})`, icon: Sparkles },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'delivery-offers', label: 'Delivery Offers', icon: Gift },
          { id: 'settings', label: 'Store Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition ${
                isActive
                  ? 'bg-botanical-700 text-cream-50 shadow-soft'
                  : 'text-stone-600 hover:bg-cream-200/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ANALYSIS DASHBOARD TAB */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          adminKey={getAdminKey()}
          onNavigateToTab={(tab) => setActiveTab(tab as any)}
        />
      )}

      {/* STALL MANAGEMENT TAB */}
      {activeTab === 'stall' && (
        <StallManagement
          adminKey={getAdminKey()}
          onNavigateToTab={(tab) => setActiveTab(tab as any)}
        />
      )}

      {/* TAB 1: OVERVIEW METRICS */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <div className="text-xs text-stone-500 font-semibold">Today&apos;s Deliveries</div>
              <div className="font-serif font-bold text-2xl text-botanical-900 mt-1">
                {metrics.todayOrdersCount}
              </div>
              <div className="text-[11px] text-botanical-700 mt-1">
                {metrics.ordersAwaitingDeliveryCount} currently in preparation/transit
              </div>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <div className="text-xs text-stone-500 font-semibold">Today&apos;s Confirmed Sales</div>
              <div className="font-serif font-bold text-2xl text-emerald-800 mt-1">
                {formatINR(metrics.todaySalesPaise)}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                {metrics.paidOrdersCount} orders paid
              </div>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <div className="text-xs text-stone-500 font-semibold">Active Subscriptions</div>
              <div className="font-serif font-bold text-2xl text-botanical-900 mt-1">
                {metrics.activeSubscriptionsCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Mandir daily flower deliveries
              </div>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <div className="text-xs text-stone-500 font-semibold">Upcoming Festivals</div>
              <div className="font-serif font-bold text-2xl text-marigold-600 mt-1">
                {metrics.upcomingFestivalBookingsCount}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Advance flower reservations
              </div>
            </div>

          </div>

          {/* Quick Order Actions Grid */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-botanical-700" />
                <span>Live Orders Feed ({orders.length} Total Orders)</span>
              </h3>
              <span className="text-[11px] text-stone-500">Auto-refreshing every 10s</span>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-stone-500 py-4 text-center">No customer orders placed yet. Place a test order from the shop to see it here live! ✨</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 10).map((order) => (
                  <div
                    key={order.id}
                    className="bg-cream-50 p-4 rounded-2xl border border-botanical-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-botanical-900">{order.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.orderStatus === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : order.orderStatus === 'delivered'
                            ? 'bg-botanical-100 text-botanical-900 border border-botanical-300'
                            : order.orderStatus === 'out_for_delivery'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : order.orderStatus === 'preparing'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {order.orderStatus.replace('_', ' ')}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          {order.paymentStatus} ({order.paymentMethod})
                        </span>

                        <span className="font-serif font-bold text-botanical-900 ml-auto md:ml-2 text-sm">
                          {formatINR(order.totalPaise)}
                        </span>
                      </div>

                      <div className="text-stone-700">
                        <strong>Customer:</strong> {order.customer.customerName} • <strong>Phone:</strong> {order.customer.phone}
                      </div>

                      <div className="text-stone-600 text-[11px]">
                        <strong>Address:</strong> {order.customer.flatNumber}{order.customer.tower ? `, Tower ${order.customer.tower}` : ''}{order.customer.block ? `, Block ${order.customer.block}` : ''}{order.customer.buildingTower && !order.customer.tower && !order.customer.block ? `, ${order.customer.buildingTower}` : ''}, {order.customer.apartmentCommunity}
                      </div>

                      <div className="text-[11px] text-stone-500">
                        <strong>Flowers:</strong> {order.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')} • <strong>Slot:</strong> {order.deliverySchedule.timeSlot}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-botanical-100 shrink-0">
                      {order.orderStatus === 'pending_confirmation' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
                        >
                          Confirm Order
                        </button>
                      )}
                      {order.orderStatus === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="px-3 py-1.5 rounded-lg bg-botanical-700 hover:bg-botanical-800 text-white font-semibold text-xs shadow-xs"
                        >
                          Mark Packing
                        </button>
                      )}
                      {order.orderStatus === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
                        >
                          Out for Delivery
                        </button>
                      )}
                      {order.orderStatus === 'out_for_delivery' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs"
                        >
                          Mark Delivered
                        </button>
                      )}

                      {order.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, undefined, 'paid', true)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
                          title="Record payment collected"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DAILY PRICES */}
      {activeTab === 'daily-prices' && (
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-6 shadow-soft space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-xl text-botanical-900">
                    Daily Flower Market Prices
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    dailyPricesRecord?.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {dailyPricesRecord?.status === 'published' ? 'Live Published' : 'Draft Pending'}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  Update today&apos;s dawn market prices and availability for the 6 core flower varieties. Changes are synchronized to Firebase.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-botanical-600" />
                    <span>Last Published:</span>
                    <strong className="text-botanical-900">
                      {dailyPricesRecord?.publishedAt
                        ? new Date(dailyPricesRecord.publishedAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Never published'}
                    </strong>
                  </span>
                  {dailyPricesRecord?.publishedBy && (
                    <span className="text-stone-400">• By: {dailyPricesRecord.publishedBy}</span>
                  )}
                  {dailyPricesRecord?.draftSavedAt && (
                    <span className="text-stone-400">
                      • Draft saved: {new Date(dailyPricesRecord.draftSavedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDailyPricesDraft}
                  disabled={dailyPricesSaving}
                  className="px-3.5 py-2.5 rounded-xl border border-botanical-300 bg-cream-50 text-botanical-800 hover:bg-cream-200/70 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-xs"
                >
                  <Save className="w-4 h-4 text-botanical-600" />
                  <span>{dailyPricesSaving ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDailyPricesPreview(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-botanical-300 bg-cream-50 text-botanical-800 hover:bg-cream-200/70 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  <Eye className="w-4 h-4 text-botanical-600" />
                  <span>Preview (6 Flowers)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublishDailyPrices}
                  disabled={dailyPricesSaving}
                  className="px-4 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-soft"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>{dailyPricesSaving ? 'Publishing...' : "Publish Today's Prices"}</span>
                </button>
              </div>
            </div>

            {/* Notification message */}
            {dailyPricesMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-start justify-between gap-2 ${
                  dailyPricesMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : dailyPricesMessage.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dailyPricesMessage.text}</span>
                </div>
                <button
                  onClick={() => setDailyPricesMessage(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Flowers Price Editor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {DAILY_FLOWERS_CONFIG.map((flower) => {
              const currentItem = dailyPriceDraftItems[flower.id] || {
                productId: flower.id,
                name: flower.name,
                pricePaise: 5000,
                unit: flower.defaultUnit,
                inStock: true,
              };

              const priceRupees = Math.round(currentItem.pricePaise / 100);

              // Rate per kg calculation
              let ratePerKgText = '';
              if (currentItem.unit === 'per 250g') {
                ratePerKgText = `₹${priceRupees * 4} / kg`;
              } else if (currentItem.unit === 'per 100g') {
                ratePerKgText = `₹${priceRupees * 10} / kg`;
              } else if (currentItem.unit === 'per 500g') {
                ratePerKgText = `₹${priceRupees * 2} / kg`;
              } else if (currentItem.unit === 'per 1kg') {
                ratePerKgText = `₹${priceRupees} / kg`;
              }

              return (
                <div
                  key={flower.id}
                  className={`bg-cream-100/90 rounded-2xl border transition-all shadow-soft flex flex-col justify-between overflow-hidden ${
                    currentItem.inStock ? 'border-botanical-200' : 'border-stone-300 opacity-80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-cream-200 shrink-0 border border-botanical-200">
                          <img
                            src={flower.imageUrl}
                            alt={flower.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-base text-botanical-900 leading-snug">
                            {flower.name}
                          </h4>
                          <span className="text-[11px] text-stone-500 font-medium">
                            {flower.teluguName}
                          </span>
                        </div>
                      </div>

                      {/* In-Stock Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleDraftItemStockToggle(flower.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition active:scale-95 ${
                          currentItem.inStock
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                            : 'bg-stone-200 text-stone-600 border border-stone-300 hover:bg-stone-300'
                        }`}
                        title="Toggle availability for today"
                      >
                        {currentItem.inStock ? '✓ Available' : '✕ Out of Stock'}
                      </button>
                    </div>

                    {/* Price Input & Quick Adjusters */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-stone-700">
                          Selling Price (₹ INR) *
                        </label>
                        {ratePerKgText && (
                          <span className="text-[11px] text-botanical-700 font-medium">
                            ({ratePerKgText})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-bold text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={priceRupees || ''}
                            onChange={(e) =>
                              handleDraftItemPriceChange(flower.id, Number(e.target.value))
                            }
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-botanical-200 bg-white text-base font-bold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                            placeholder="e.g. 50"
                          />
                        </div>
                        {/* Quick adjustments */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleDraftItemPriceChange(flower.id, Math.max(0, priceRupees - 5))
                            }
                            className="px-2 py-2 rounded-lg bg-cream-200 hover:bg-cream-300 text-stone-700 font-bold text-xs"
                            title="Decrease by ₹5"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDraftItemPriceChange(flower.id, priceRupees + 5)
                            }
                            className="px-2 py-2 rounded-lg bg-cream-200 hover:bg-cream-300 text-stone-700 font-bold text-xs"
                            title="Increase by ₹5"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDraftItemPriceChange(flower.id, priceRupees + 10)
                            }
                            className="px-2 py-2 rounded-lg bg-cream-200 hover:bg-cream-300 text-stone-700 font-bold text-xs"
                            title="Increase by ₹10"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Unit Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        Selling Unit Configured
                      </label>
                      <select
                        value={currentItem.unit}
                        onChange={(e) => handleDraftItemUnitChange(flower.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white text-xs font-medium text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                      >
                        {flower.unitOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Card Footer summary */}
                  <div className="px-4 py-2.5 bg-cream-200/50 border-t border-botanical-200/60 flex items-center justify-between text-xs text-stone-600">
                    <span>
                      Customer sees:{' '}
                      <strong className="text-botanical-900">
                        ₹{priceRupees} / {currentItem.unit}
                      </strong>
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        currentItem.inStock ? 'text-emerald-700' : 'text-stone-500'
                      }`}
                    >
                      {currentItem.inStock ? 'Active in Shop' : 'Hidden / Sold Out'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Fast Action Bar on Mobile / Desktop */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft">
            <div className="text-xs text-stone-600 text-center sm:text-left">
              <span>Ready to update public catalogue? All 6 flower rates will take effect immediately.</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleSaveDailyPricesDraft}
                disabled={dailyPricesSaving}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-botanical-300 bg-cream-50 text-botanical-800 hover:bg-cream-200/70 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Save className="w-4 h-4 text-botanical-600" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={handlePublishDailyPrices}
                disabled={dailyPricesSaving}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-soft"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Publish Today&apos;s Prices</span>
              </button>
            </div>
          </div>

          {/* PREVIEW MODAL */}
          {showDailyPricesPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-botanical-950/70 backdrop-blur-xs">
              <div className="bg-cream-50 border border-botanical-200 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-elevated p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-botanical-100">
                  <div>
                    <h3 className="font-serif font-bold text-xl text-botanical-900">
                      Customer Catalogue Preview
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Previewing today&apos;s flower prices and availability as shown to Hyderabad residents
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDailyPricesPreview(false)}
                    className="w-8 h-8 rounded-full bg-cream-200 hover:bg-cream-300 text-stone-700 flex items-center justify-center font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {DAILY_FLOWERS_CONFIG.map((flower) => {
                    const item = dailyPriceDraftItems[flower.id] || {
                      productId: flower.id,
                      name: flower.name,
                      pricePaise: 5000,
                      unit: flower.defaultUnit,
                      inStock: true,
                    };
                    const priceRupees = Math.round(item.pricePaise / 100);

                    return (
                      <div
                        key={flower.id}
                        className="bg-white rounded-2xl border border-botanical-100 overflow-hidden shadow-xs flex flex-col justify-between"
                      >
                        <div className="relative aspect-4/3 bg-cream-100">
                          <img
                            src={flower.imageUrl}
                            alt={flower.name}
                            className="w-full h-full object-cover"
                          />
                          {!item.inStock && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-900/90 text-white">
                              Out of Stock
                            </span>
                          )}
                          <div className="absolute bottom-1.5 left-2 bg-botanical-900/80 backdrop-blur-xs text-cream-100 text-[10px] font-medium px-2 py-0.5 rounded">
                            {flower.teluguName}
                          </div>
                        </div>

                        <div className="p-3.5 space-y-2">
                          <h4 className="font-serif font-bold text-sm text-botanical-900">
                            {flower.name}
                          </h4>
                          <div className="flex items-baseline justify-between pt-1 border-t border-botanical-100/60">
                            <span className="text-base font-bold text-botanical-900">
                              ₹{priceRupees}
                            </span>
                            <span className="text-xs text-stone-500">/ {item.unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-botanical-100">
                  <button
                    onClick={() => setShowDailyPricesPreview(false)}
                    className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-xs"
                  >
                    Close Preview
                  </button>
                  <button
                    onClick={async () => {
                      setShowDailyPricesPreview(false);
                      await handlePublishDailyPrices();
                    }}
                    className="px-5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-bold text-xs flex items-center gap-1.5 shadow-soft"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Confirm & Publish Now</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="bg-cream-100/90 p-4 rounded-2xl border border-botanical-200 shadow-soft flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search Order ID, name, phone..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['all', 'pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    orderStatusFilter === st
                      ? 'bg-botanical-700 text-white'
                      : 'bg-cream-50 text-stone-700 border border-botanical-200 hover:bg-cream-200/50'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-cream-100/50 border border-botanical-200 rounded-3xl p-10 text-center text-xs text-stone-600">
                No orders match your filter criteria.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3"
                >
                  {/* Order header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-botanical-100 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-botanical-900">{order.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-botanical-200 text-botanical-900 uppercase">
                          {order.orderStatus.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.paymentStatus} ({order.paymentMethod})
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Placed: {new Date(order.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="font-serif font-bold text-base text-botanical-900">
                      {formatINR(order.totalPaise)}
                    </div>
                  </div>

                  {/* Customer and Delivery info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-700">
                    <div>
                      <span className="font-semibold text-botanical-900 block">Customer:</span>
                      <div>{order.customer.customerName}</div>
                      <div>Phone: {order.customer.phone}</div>
                    </div>

                    <div>
                      <span className="font-semibold text-botanical-900 block">Delivery Address:</span>
                      <div>
                        {order.customer.flatNumber}
                        {order.customer.tower ? `, Tower ${order.customer.tower}` : ''}
                        {order.customer.block ? `, Block ${order.customer.block}` : ''}
                        {order.customer.buildingTower && !order.customer.tower && !order.customer.block ? `, ${order.customer.buildingTower}` : ''}
                      </div>
                      <div>{order.customer.apartmentCommunity}</div>
                      {order.customer.deliveryInstructions && (
                        <div className="text-[11px] text-stone-500 italic">
                          Note: {order.customer.deliveryInstructions}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="font-semibold text-botanical-900 block">Delivery Slot:</span>
                      <div>Date: {order.deliverySchedule.date || 'Recurring'}</div>
                      <div>Slot: {order.deliverySchedule.timeSlot === 'morning' ? 'Morning Puja (6:00 AM – 8:30 AM)' : 'Evening Slot'}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="pt-2 border-t border-botanical-100 text-xs">
                    <span className="font-semibold text-stone-700">Items: </span>
                    <span className="text-botanical-900 font-medium">
                      {order.items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 border-t border-botanical-100 flex flex-wrap items-center gap-2">
                    {order.orderStatus === 'pending_confirmation' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                        className="px-3 py-1.5 rounded-lg bg-botanical-700 text-white font-semibold text-xs hover:bg-botanical-800 transition"
                      >
                        Confirm Order
                      </button>
                    )}
                    {order.orderStatus === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                        className="px-3 py-1.5 rounded-lg bg-botanical-600 text-white font-semibold text-xs hover:bg-botanical-700 transition"
                      >
                        Mark Packing
                      </button>
                    )}
                    {order.orderStatus === 'preparing' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                      >
                        Out for Delivery
                      </button>
                    )}
                    {order.orderStatus === 'out_for_delivery' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition"
                      >
                        Mark Delivered
                      </button>
                    )}

                    {/* Record COD payment collection */}
                    {order.paymentStatus !== 'paid' && order.paymentMethod === 'cod' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, undefined, undefined, true)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition"
                      >
                        Record COD Cash Collected
                      </button>
                    )}

                    {/* Cancel button */}
                    {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-200 text-stone-600 hover:text-rose-700 font-semibold text-xs transition"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY & PRODUCT MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-botanical-900">
              Flower Products & Daily Pricing
            </h3>
            <button
              onClick={() => setShowAddProduct(!showAddProduct)}
              className="px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs flex items-center gap-1.5 hover:bg-botanical-800 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Variety</span>
            </button>
          </div>

          {/* Add Product Form */}
          {showAddProduct && (
            <form onSubmit={handleAddProduct} className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-5 space-y-4 shadow-soft">
              <h4 className="font-serif font-bold text-base text-botanical-900">Add New Flower Product</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Flower Name *</label>
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Lotus / Kamalam"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Telugu Name</label>
                  <input
                    type="text"
                    value={newProductTelugu}
                    onChange={(e) => setNewProductTelugu(e.target.value)}
                    placeholder="e.g. కమలం"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    value={newProductPriceRupees}
                    onChange={(e) => setNewProductPriceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    required
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    placeholder="e.g. per 100g / per bunch"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-stone-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={newProductImg}
                    onChange={(e) => setNewProductImg(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-stone-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newProductDesc}
                    onChange={(e) => setNewProductDesc(e.target.value)}
                    placeholder="Description of harvest source and puja suitability"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="px-4 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-botanical-700 text-white text-xs font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          )}

          {/* Product Cards Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const isEditing = editingProductId === p.id;
              return (
                <div key={p.id} className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-botanical-900">{p.name}</h4>
                      {p.teluguName && <p className="text-[11px] text-botanical-700">{p.teluguName}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-300 text-stone-700'
                    }`}>
                      {p.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t border-botanical-100 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600">Price (₹)</label>
                        <input
                          type="number"
                          value={editPriceRupees}
                          onChange={(e) => setEditPriceRupees(Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-botanical-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600">Unit</label>
                        <input
                          type="text"
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-botanical-200 bg-white"
                        />
                      </div>
                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editInStock}
                          onChange={(e) => setEditInStock(e.target.checked)}
                          className="rounded text-botanical-700 w-4 h-4"
                        />
                        <span className="text-xs font-semibold text-stone-700">Currently in stock</span>
                      </label>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingProductId(null)}
                          className="px-3 py-1 rounded-lg bg-stone-200 text-xs text-stone-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveProduct(p.id)}
                          className="px-3 py-1 rounded-lg bg-botanical-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-botanical-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-botanical-900 text-sm">
                          {formatINR(p.pricePaise)}
                        </span>
                        <span className="text-stone-500 ml-1">/ {p.unit}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingProductId(p.id);
                          setEditPriceRupees(p.pricePaise / 100);
                          setEditUnit(p.unit);
                          setEditInStock(p.inStock);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cream-200 hover:bg-cream-300 text-botanical-800 text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit Price</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-lg text-botanical-900">
            Active & Paused Customer Subscriptions
          </h3>

          <div className="space-y-3">
            {subscriptions.length === 0 ? (
              <p className="text-xs text-stone-500">No subscriptions created yet.</p>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
                    <div>
                      <span className="font-bold text-sm text-botanical-900">#{sub.id}</span>
                      <span className="text-stone-700 ml-2 font-semibold">{sub.customer.customerName}</span>
                      <span className="text-stone-500 ml-1">({sub.customer.apartmentCommunity})</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      sub.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {sub.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-stone-700">
                    <div><strong>Phone:</strong> {sub.customer.phone}</div>
                    <div><strong>Start Date:</strong> {sub.startDate}</div>
                    <div><strong>Slot:</strong> {sub.timeSlot === 'morning' ? 'Morning (6:00 - 8:30 AM)' : 'Evening Slot'}</div>
                    <div><strong>Price:</strong> <span className="font-bold text-botanical-900">{formatINR(sub.estimatedWeeklyPaise)}/week</span></div>
                  </div>

                  <div className="text-stone-600 bg-white/70 p-2.5 rounded-xl border border-botanical-100 space-y-1">
                    <div>
                      <strong>Address:</strong> {sub.customer.flatNumber}
                      {sub.customer.tower ? `, Tower ${sub.customer.tower}` : ''}
                      {sub.customer.block ? `, Block ${sub.customer.block}` : ''}
                      {sub.customer.buildingTower && !sub.customer.tower && !sub.customer.block ? `, ${sub.customer.buildingTower}` : ''}
                      , {sub.customer.apartmentCommunity}{sub.customer.locality && sub.customer.locality !== sub.customer.apartmentCommunity ? `, ${sub.customer.locality}` : ''}
                      {sub.customer.city ? `, ${sub.customer.city}` : ''} - {sub.customer.pincode || '560001'}
                    </div>
                    <div><strong>Days:</strong> {sub.daysOfWeek.join(', ')}</div>
                  </div>

                  {sub.skippedDates && sub.skippedDates.length > 0 && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg">
                      Skipped Dates: {sub.skippedDates.join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: FESTIVAL BOOKINGS */}
      {activeTab === 'festivals' && (
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-lg text-botanical-900">
            Advance Festival Bookings
          </h3>

          <div className="space-y-3">
            {festivalBookings.length === 0 ? (
              <p className="text-xs text-stone-500">No festival bookings requested yet.</p>
            ) : (
              festivalBookings.map((b) => (
                <div key={b.id} className="bg-cream-100/90 border border-marigold-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-marigold-100">
                    <div>
                      <span className="font-bold text-sm text-botanical-900">{b.id}</span>
                      <span className="font-bold text-marigold-700 ml-2">[{b.festivalName}]</span>
                      <span className="text-stone-700 ml-2 font-semibold">{b.customer.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        {b.status}
                      </span>
                      <span className="font-bold text-botanical-900">
                        {formatINR(b.totalPaise)}
                      </span>
                    </div>
                  </div>

                  <div className="text-stone-700">
                    <div><strong>Delivery Date:</strong> {b.festivalDate} ({b.preferredSlot})</div>
                    <div><strong>Address:</strong> {b.customer.flatNumber}{b.customer.tower ? `, Tower ${b.customer.tower}` : ''}{b.customer.block ? `, Block ${b.customer.block}` : ''}{b.customer.buildingTower && !b.customer.tower && !b.customer.block ? `, ${b.customer.buildingTower}` : ''}, {b.customer.apartmentCommunity} • Phone: {b.customer.phone}</div>
                    {b.specialGarlandNotes && (
                      <div className="mt-1 text-botanical-800 bg-cream-50 p-2 rounded-lg border border-botanical-100">
                        <strong>Special Request:</strong> {b.specialGarlandNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-marigold-100 flex items-center gap-2">
                    {b.status === 'requested' && (
                      <button
                        onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                        className="px-3 py-1 rounded-lg bg-botanical-700 text-white font-semibold text-xs"
                      >
                        Confirm Booking
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateBookingStatus(b.id, 'paid')}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                      >
                        Mark Paid
                      </button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button
                        onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                        className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-600 text-xs font-semibold hover:text-rose-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: BUSINESS SETTINGS */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft space-y-4 max-w-2xl">
          <h3 className="font-serif font-bold text-lg text-botanical-900">
            Business & Delivery Configuration
          </h3>

          {settingsSaveMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              {settingsSaveMsg}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Business Name</label>
              <input
                type="text"
                value={editSettings.businessName || ''}
                onChange={(e) => setEditSettings({ ...editSettings, businessName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">WhatsApp Business Phone Number</label>
              <input
                type="text"
                value={editSettings.businessPhone || ''}
                onChange={(e) => setEditSettings({ ...editSettings, businessPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Delivery Cutoff Hour (24h format)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={editSettings.deliveryCutoffHour ?? 20}
                  onChange={(e) => setEditSettings({ ...editSettings, deliveryCutoffHour: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                />
                <span className="text-[10px] text-stone-500">20 = 8:00 PM for next morning deliveries</span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Standard Delivery Fee (paise)</label>
                <input
                  type="number"
                  value={editSettings.standardDeliveryFeePaise ?? 3000}
                  onChange={(e) => setEditSettings({ ...editSettings, standardDeliveryFeePaise: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
                />
                <span className="text-[10px] text-stone-500">3000 = ₹30.00</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Free Delivery Threshold (paise)</label>
              <input
                type="number"
                value={editSettings.freeDeliveryThresholdPaise ?? 29900}
                onChange={(e) => setEditSettings({ ...editSettings, freeDeliveryThresholdPaise: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
              />
              <span className="text-[10px] text-stone-500">29900 = Free delivery on orders ₹299 and above</span>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Physical Address Text</label>
              <input
                type="text"
                value={editSettings.addressText || ''}
                onChange={(e) => setEditSettings({ ...editSettings, addressText: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-botanical-700 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-botanical-800 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* CUSTOMER MANAGEMENT TAB */}
      {activeTab === 'customers' && (
        <CustomerManagement adminKey={getAdminKey()} />
      )}

      {/* DELIVERY OFFERS & PROMOTIONS TAB */}
      {activeTab === 'delivery-offers' && settings && (
        <DeliveryOffersManagement
          settings={settings}
          onSettingsUpdated={(newSettings) => {
            setSettings(newSettings);
            setEditSettings(newSettings);
          }}
          adminKey={getAdminKey()}
        />
      )}

    </div>
  );
}
