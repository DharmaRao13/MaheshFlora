'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  XCircle,
  Phone,
  Search,
  ArrowRight,
  ExternalLink,
  Calendar,
  Banknote,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Order, OrderStatus, Product } from '@/types';
import { formatINR } from '@/lib/config';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useCart } from '@/context/CartContext';
import { evaluateOrderReorder } from '@/lib/business';

export default function MyOrdersClient() {
  const { addItem } = useCart();
  const { user, customerPhone, idToken, getIdToken, sendOtp, verifyOtp, signOut: customerSignOut } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'active' | 'history'>('active');

  // Reorder / Buy Again State
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<{
    title: string;
    messages: string[];
    proceedPath: string;
  } | null>(null);

  // OTP Login UI state
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const fetchOrdersForPhone = useCallback(async (phone: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

    try {
      const headers: Record<string, string> = {
        'x-customer-phone': cleanPhone,
      };

      const freshToken = await getIdToken();
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`;
      }

      const res = await fetch(`/api/orders?phone=${encodeURIComponent(cleanPhone)}`, {
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load your orders.');
      }

      setOrders(data.orders || []);
      setActivePhone(cleanPhone);
      try {
        localStorage.setItem('mahesh_customer_phone', cleanPhone);
      } catch {}
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not retrieve orders. Please check your phone number.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken]);

  // Sync with authenticated customer phone
  useEffect(() => {
    if (customerPhone) {
      const clean = customerPhone.replace(/[^0-9]/g, '').slice(-10);
      setActivePhone(clean);
      fetchOrdersForPhone(clean);
    }
  }, [customerPhone, fetchOrdersForPhone]);

  const fetchOrdersFromLocalStorageTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const guestOrdersRaw = localStorage.getItem('mahesh_guest_orders');
      const savedPhone = localStorage.getItem('mahesh_customer_phone');

      if (savedPhone && savedPhone.length === 10) {
        await fetchOrdersForPhone(savedPhone);
        return;
      }

      if (guestOrdersRaw) {
        const guestOrders = JSON.parse(guestOrdersRaw);
        const orderIds = Object.keys(guestOrders);
        if (orderIds.length > 0) {
          const res = await fetch(`/api/orders?ids=${encodeURIComponent(orderIds.join(','))}`, {
            headers: {
              'x-order-tokens': JSON.stringify(guestOrders),
            },
          });
          const data = await res.json();
          if (res.ok && data.orders) {
            setOrders(data.orders);
            setIsLoading(false);
            return;
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [fetchOrdersForPhone]);

  useEffect(() => {
    fetchOrdersFromLocalStorageTokens();
  }, [fetchOrdersFromLocalStorageTokens]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setOtpMessage(null);
    const clean = phoneInput.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    setIsOtpSending(true);
    try {
      const result = await sendOtp(clean);
      if (result.success) {
        setOtpStep('otp');
        setOtpMessage(`Verification code sent to +91 ${clean}`);
      } else {
        setErrorMessage(result.error || 'Failed to send OTP SMS.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error sending verification code.');
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP received via SMS.');
      return;
    }
    setIsOtpVerifying(true);
    try {
      const result = await verifyOtp(otpCode);
      if (result.success) {
        setOtpStep('phone');
        setOtpCode('');
        const clean = phoneInput.replace(/[^0-9]/g, '').slice(-10);
        setActivePhone(clean);
        fetchOrdersForPhone(clean);
      } else {
        setErrorMessage(result.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify OTP.');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setErrorMessage('Please enter your 10-digit mobile number.');
      return;
    }
    const clean = phoneInput.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    fetchOrdersForPhone(clean);
  };

  const handleClearPhone = async () => {
    await customerSignOut();
    setActivePhone(null);
    setOrders([]);
    setOtpStep('phone');
    setOtpCode('');
    try {
      localStorage.removeItem('mahesh_customer_phone');
    } catch {}
  };

  const handleBuyAgain = async (order: Order) => {
    setReorderingOrderId(order.id);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const products: Product[] = data.products || [];

      const evalResult = evaluateOrderReorder(order.items, products);

      if (!evalResult.canReorder) {
        setReorderNotice({
          title: 'Items Currently Unavailable',
          messages: evalResult.results.map((r) => r.reason || `${r.name} is currently out of stock.`),
          proceedPath: '/flowers',
        });
        return;
      }

      // Add each available product to the cart at current catalogue pricing
      for (const itemRes of evalResult.results) {
        if (itemRes.added) {
          const product = products.find(
            (p) => p.name.toLowerCase().trim() === itemRes.name.toLowerCase().trim() || p.id === itemRes.name
          );
          if (product) {
            addItem(product, itemRes.quantity);
          }
        }
      }

      // If price drift or some items were out of stock, alert customer with review screen
      if (evalResult.hasPriceChanges || evalResult.hasOutOfStock) {
        const notices = evalResult.results
          .filter((r) => Boolean(r.reason))
          .map((r) => r.reason!);
        setReorderNotice({
          title: 'Items Added with Latest Market Prices',
          messages: notices,
          proceedPath: '/cart',
        });
      } else {
        if (typeof window !== 'undefined') {
          window.location.href = '/cart';
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to reload items from order. Please try again.');
    } finally {
      setReorderingOrderId(null);
    }
  };

  // Sort orders newest first
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Separation into Active vs History
  // Active: not yet delivered or cancelled
  const activeOrders = sortedOrders.filter(
    (o) => !['delivered', 'cancelled'].includes(o.orderStatus)
  );

  // History: delivered or cancelled
  const historyOrders = sortedOrders.filter((o) =>
    ['delivered', 'cancelled'].includes(o.orderStatus)
  );

  const displayedOrders = selectedTab === 'active' ? activeOrders : historyOrders;

  const renderDeliveryBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending_confirmation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Order Received</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Confirmed</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300">
            <Package className="w-3.5 h-3.5 text-purple-600" />
            <span>Preparing Order</span>
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse">
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivered</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-700 border border-stone-300">
            <XCircle className="w-3.5 h-3.5 text-stone-500" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderPaymentBadge = (order: Order) => {
    const isCod = order.paymentMethod?.toLowerCase() === 'cod';

    if (order.paymentStatus === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{isCod ? 'Paid (Cash)' : 'Paid'}</span>
        </span>
      );
    }

    if (order.paymentStatus === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>Payment Failed</span>
        </span>
      );
    }

    if (isCod) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
          <Banknote className="w-3 h-3 text-amber-600" />
          <span>Pay on Delivery</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Payment Pending</span>
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-botanical-200">
        <div>
          <h1 className="font-serif text-3xl font-bold text-botanical-900">
            My Orders & Tracking
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Track your fresh flower deliveries to your apartment in Hyderabad
          </p>
        </div>

        {activePhone && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchOrdersForPhone(activePhone)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-botanical-300 text-botanical-800 hover:bg-botanical-100 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Customer Contact Verification Section */}
      <div className="bg-cream-100/80 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft">
        {activePhone ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-botanical-700 text-cream-50 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-stone-500 font-medium">
                  {user ? 'Verified Customer Account' : 'Logged in via Phone'}
                </div>
                <div className="text-sm font-bold text-botanical-900">
                  +91 {activePhone}
                </div>
              </div>
            </div>

            <button
              onClick={handleClearPhone}
              className="text-xs text-botanical-700 hover:text-botanical-900 underline font-medium self-start sm:self-auto"
            >
              {user ? 'Sign Out / Switch Number' : 'Look up another number'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-botanical-100 text-botanical-800 flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-botanical-900">
                  Find Your Orders
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Enter your mobile number to receive an SMS OTP and securely view your active deliveries and order history.
                </p>
              </div>
            </div>

            {otpStep === 'phone' ? (
              <form onSubmit={handlePhoneSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-xs font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    maxLength={10}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-botanical-500 text-sm bg-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isOtpSending || isLoading}
                    className="px-4 py-2.5 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 text-xs font-semibold transition disabled:opacity-50 shrink-0 shadow-soft"
                  >
                    {isOtpSending ? 'Sending OTP...' : 'Send SMS OTP'}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 border border-stone-300 text-stone-700 hover:bg-stone-200 text-xs font-medium transition disabled:opacity-50 shrink-0"
                  >
                    {isLoading ? 'Searching...' : 'Find My Orders'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {otpMessage && (
                  <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{otpMessage}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-botanical-500 text-sm tracking-widest font-mono text-center bg-white"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isOtpVerifying}
                    className="px-5 py-2.5 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 text-xs font-semibold transition disabled:opacity-50 shrink-0 shadow-soft"
                  >
                    {isOtpVerifying ? 'Verifying...' : 'Verify OTP & View Orders'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('phone');
                      setOtpCode('');
                    }}
                    className="px-3 py-2.5 text-xs text-stone-600 hover:text-stone-900 underline"
                  >
                    Change Number
                  </button>
                </div>
              </form>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs: Active Orders vs Order History */}
      <div className="space-y-6">
        <div className="flex border-b border-botanical-200">
          <button
            onClick={() => setSelectedTab('active')}
            className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
              selectedTab === 'active'
                ? 'border-botanical-700 text-botanical-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Active Orders</span>
            {activeOrders.length > 0 && (
              <span className="bg-botanical-700 text-white text-[11px] px-2 py-0.5 rounded-full">
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedTab('history')}
            className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
              selectedTab === 'history'
                ? 'border-botanical-700 text-botanical-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Order History</span>
            {historyOrders.length > 0 && (
              <span className="bg-stone-200 text-stone-700 text-[11px] px-2 py-0.5 rounded-full">
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-xs text-stone-600">Loading your flower orders...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayedOrders.length === 0 && (
          <div className="bg-cream-100/50 border border-botanical-200/80 rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-botanical-100 text-botanical-700 flex items-center justify-center mx-auto">
              {selectedTab === 'active' ? (
                <ShoppingBag className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-botanical-900">
                {selectedTab === 'active' ? 'No active orders' : 'No order history yet'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-sm mx-auto">
                {selectedTab === 'active'
                  ? 'You do not have any flower deliveries currently in progress.'
                  : 'You have not completed any deliveries with us yet.'}
              </p>
            </div>

            <Link
              href="/flowers"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 text-xs font-semibold transition shadow-soft"
            >
              <span>Explore Flower Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Order Cards List */}
        {!isLoading && displayedOrders.length > 0 && (
          <div className="space-y-4">
            {displayedOrders.map((order) => {
              const tokenParam = order.accessToken ? `?token=${encodeURIComponent(order.accessToken)}` : '';
              const orderLink = `/orders/${order.id}${tokenParam}`;

              return (
                <div
                  key={order.id}
                  className="bg-white border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft hover:border-botanical-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-serif text-lg sm:text-xl font-bold text-botanical-900">
                          Order #{order.id}
                        </span>
                        {renderDeliveryBadge(order.orderStatus)}
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {renderPaymentBadge(order)}
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="py-4 space-y-2">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      Items Ordered
                    </div>
                    <div className="divide-y divide-stone-100">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                          <span className="text-stone-800 font-medium">
                            {item.quantity} × {item.name} <span className="text-stone-500 text-[11px]">({item.unit})</span>
                          </span>
                          <span className="text-stone-700 font-semibold">
                            {formatINR(item.itemTotalPaise)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Schedule & Details Footer */}
                  <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-botanical-700" />
                        <span>
                          Delivery Date: {order.deliverySchedule.date || 'Weekly Subscription'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-botanical-700" />
                        <span className="capitalize">
                          {order.deliverySchedule.timeSlot || 'morning'} Slot
                        </span>
                      </div>
                      <div>
                        Payment:{' '}
                        <span className="font-semibold text-stone-800">
                          {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online UPI'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <div className="text-[11px] text-stone-500">Total Amount</div>
                        <div className="text-base font-bold text-botanical-900">
                          {formatINR(order.totalPaise)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBuyAgain(order)}
                          disabled={reorderingOrderId === order.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-botanical-100 hover:bg-botanical-200 text-botanical-900 border border-botanical-300 text-xs font-semibold transition active:scale-95 shrink-0"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${reorderingOrderId === order.id ? 'animate-spin' : ''}`} />
                          <span>{reorderingOrderId === order.id ? 'Adding...' : 'Buy Again'}</span>
                        </button>

                        <Link
                          href={orderLink}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 text-xs font-semibold transition shadow-soft shrink-0"
                        >
                          <span>{order.orderStatus === 'delivered' ? 'View Order' : 'Track Order'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Reorder Price Change / Out of Stock Notice Modal */}
        {reorderNotice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-botanical-950/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-cream-50 rounded-2xl shadow-elevated border border-botanical-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-botanical-200">
                <div className="w-10 h-10 rounded-full bg-botanical-100 text-botanical-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-botanical-900">
                    {reorderNotice.title}
                  </h3>
                  <p className="text-xs text-stone-600">Fresh daily flower market update</p>
                </div>
              </div>

              <div className="space-y-2">
                {reorderNotice.messages.map((msg, i) => (
                  <div
                    key={i}
                    className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReorderNotice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200/60 transition"
                >
                  Close
                </button>
                <Link
                  href={reorderNotice.proceedPath}
                  onClick={() => setReorderNotice(null)}
                  className="px-4 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition flex items-center gap-1.5"
                >
                  <span>Review in Cart</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
