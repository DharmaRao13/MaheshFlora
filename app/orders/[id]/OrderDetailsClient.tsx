'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Banknote,
  XCircle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types';
import { formatINR, formatINRWithDecimals, DEFAULT_SETTINGS, buildUpiPaymentUri } from '@/lib/config';
import { canCancelOrder } from '@/lib/business';
import { subscribeToOrder } from '@/lib/firebase/client';

interface Props {
  initialOrder: Order;
  paymentTestMode?: boolean;
}

const LIFECYCLE_STEPS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: 'pending_confirmation', label: 'Order Received', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing Order', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function OrderDetailsClient({ initialOrder, paymentTestMode }: Props) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationNote, setSimulationNote] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Secure access verification state for guest orders
  const [isAccessVerified, setIsAccessVerified] = useState<boolean>(true);
  const [verifyPhoneInput, setVerifyPhoneInput] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Check if current user is an authorized admin/developer (to restrict simulation tools)
  useEffect(() => {
    try {
      const key = localStorage.getItem('mahesh_admin_key');
      if (key) {
        fetch('/api/admin/metrics', { headers: { 'x-admin-key': key } })
          .then((res) => {
            if (res.ok) setIsAdmin(true);
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  // Verify customer authorization to view this specific order
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If order does not have an access token (e.g. legacy order / test mock), permit
    if (!order.accessToken) {
      setIsAccessVerified(true);
      return;
    }

    // 1. Check if token in URL query parameter matches
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken && urlToken === order.accessToken) {
      setIsAccessVerified(true);
      return;
    }

    // 2. Check if admin key in localStorage
    if (localStorage.getItem('mahesh_admin_key')) {
      setIsAccessVerified(true);
      return;
    }

    // 3. Check guest orders token store in localStorage
    try {
      const guestOrders = JSON.parse(localStorage.getItem('mahesh_guest_orders') || '{}');
      if (guestOrders[order.id] === order.accessToken) {
        setIsAccessVerified(true);
        return;
      }
    } catch {}

    // 4. Check saved customer phone in localStorage
    try {
      const savedPhone = localStorage.getItem('mahesh_customer_phone');
      if (savedPhone) {
        const cleanSaved = savedPhone.replace(/[^0-9]/g, '').slice(-10);
        const cleanOrder = order.customer.phone.replace(/[^0-9]/g, '').slice(-10);
        if (cleanSaved === cleanOrder && cleanSaved.length === 10) {
          setIsAccessVerified(true);
          return;
        }
      }
    } catch {}

    // If neither matched, require phone verification
    setIsAccessVerified(false);
  }, [order.id, order.accessToken, order.customer.phone]);

  const handleVerifyPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    const cleanEntered = verifyPhoneInput.replace(/[^0-9]/g, '').slice(-10);
    const cleanOrderPhone = order.customer.phone.replace(/[^0-9]/g, '').slice(-10);

    if (cleanEntered.length !== 10) {
      setVerifyError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (cleanEntered !== cleanOrderPhone) {
      setVerifyError('The mobile number entered does not match this order. Access denied.');
      return;
    }

    setIsAccessVerified(true);
    try {
      localStorage.setItem('mahesh_customer_phone', cleanEntered);
      const guestOrders = JSON.parse(localStorage.getItem('mahesh_guest_orders') || '{}');
      if (order.accessToken) {
        guestOrders[order.id] = order.accessToken;
        localStorage.setItem('mahesh_guest_orders', JSON.stringify(guestOrders));
      }
    } catch {}
  };

  // Poll for real-time status updates from Firebase / server store
  const refreshOrderStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const token =
        order.accessToken ||
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('token') || ''
          : '');
      const phone =
        typeof window !== 'undefined'
          ? localStorage.getItem('mahesh_customer_phone') || ''
          : '';

      const headers: Record<string, string> = {};
      if (token) headers['x-order-token'] = token;
      if (phone) headers['x-customer-phone'] = phone;

      const res = await fetch(`/api/orders/${order.id}?token=${encodeURIComponent(token)}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setOrder(data.order);
        }
      }
    } catch {} finally {
      setIsRefreshing(false);
    }
  }, [order.id, order.accessToken]);

  useEffect(() => {
    // If order is already completed, no need to auto-poll or subscribe
    if (['delivered', 'cancelled'].includes(order.orderStatus)) return;

    // Real-time Firestore subscription (active when Firebase is configured)
    const unsubscribe = subscribeToOrder(order.id, (updatedOrder) => {
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    });

    const interval = setInterval(() => {
      refreshOrderStatus();
    }, 6000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [order.id, order.orderStatus, refreshOrderStatus]);

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const token =
        order.accessToken ||
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('token') || ''
          : '');
      const phone =
        typeof window !== 'undefined'
          ? localStorage.getItem('mahesh_customer_phone') || ''
          : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['x-order-token'] = token;
      if (phone) headers['x-customer-phone'] = phone;

      const res = await fetch(`/api/orders/${order.id}?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'cancel',
          reason: 'Customer cancelled from order details page',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel order.');
      }

      if (data.order) {
        setOrder(data.order);
      }
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Determine if order is Cash on Delivery vs Online payment
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const isOnlinePayment = !isCod;

  // Determine if safe ₹1 test mode is active (strictly for online payments)
  const isTestMode = isOnlinePayment && (paymentTestMode ?? (DEFAULT_SETTINGS.isPaymentTestMode || false));
  const payableAmountPaise = isTestMode ? 100 : order.totalPaise; // Exactly ₹1.00 in test mode
  const payableRupeesStr = (payableAmountPaise / 100).toFixed(2); // "1.00"

  // Standard UPI URI and app-specific intents
  const universalUpiUri = buildUpiPaymentUri(
    DEFAULT_SETTINGS.upiId || 'Q062496934@ybl',
    payableAmountPaise,
    order.id,
    'Mahesh Flora',
    'upi'
  );
  const phonepeUri = buildUpiPaymentUri(
    DEFAULT_SETTINGS.upiId || 'Q062496934@ybl',
    payableAmountPaise,
    order.id,
    'Mahesh Flora',
    'phonepe'
  );
  const gpayUri = buildUpiPaymentUri(
    DEFAULT_SETTINGS.upiId || 'Q062496934@ybl',
    payableAmountPaise,
    order.id,
    'Mahesh Flora',
    'tez'
  );
  const paytmUri = buildUpiPaymentUri(
    DEFAULT_SETTINGS.upiId || 'Q062496934@ybl',
    payableAmountPaise,
    order.id,
    'Mahesh Flora',
    'paytmmp'
  );

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending_confirmation': return 0;
      case 'confirmed': return 1;
      case 'preparing': return 2;
      case 'out_for_delivery': return 3;
      case 'delivered': return 4;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(order.orderStatus);

  const handleSimulatePayment = async (result: 'success' | 'failed') => {
    setIsSimulating(true);
    setSimulationNote(null);

    try {
      const adminKey = typeof window !== 'undefined' ? localStorage.getItem('mahesh_admin_key') || '' : '';
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          orderId: order.id,
          isSimulation: true,
          simulationResult: result,
        }),
      });

      const data = await res.json();
      if (data.order) {
        setOrder(data.order);
        setSimulationNote(
          result === 'success'
            ? '✓ Verified payment simulation succeeded! Order marked as PAID.'
            : '✕ Unsuccessful payment simulation executed. Order remains UNPAID/FAILED.'
        );
      } else {
        setSimulationNote(`Error: ${data.error || 'Failed to simulate payment'}`);
      }
    } catch (e: any) {
      setSimulationNote(`Error: ${e.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isAccessVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-6">
        <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-botanical-100 text-botanical-800 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-botanical-700" />
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold text-botanical-900">
              Order Verification Required
            </h2>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              For your privacy, please enter the mobile number used when placing Order #{order.id} to view tracking details.
            </p>
          </div>

          <form onSubmit={handleVerifyPhoneSubmit} className="space-y-3 pt-2 text-left">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Customer Mobile Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-xs font-semibold">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="Enter 10-digit phone"
                  value={verifyPhoneInput}
                  onChange={(e) => setVerifyPhoneInput(e.target.value)}
                  maxLength={10}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-botanical-500 text-sm bg-white"
                />
              </div>
            </div>

            {verifyError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                {verifyError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 text-xs font-semibold transition shadow-soft"
            >
              Verify & View Order
            </button>
          </form>

          <div className="pt-2 border-t border-botanical-200">
            <Link
              href="/orders"
              className="text-xs text-botanical-700 hover:text-botanical-900 underline font-medium"
            >
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      
      {/* Navigation & Live Refresh Header */}
      <div className="flex items-center justify-between text-xs">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-botanical-700 hover:text-botanical-900 font-semibold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Orders</span>
        </Link>

        <button
          onClick={() => refreshOrderStatus()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-botanical-200 hover:bg-botanical-50 text-[11px] text-botanical-800 font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Top Banner / Order ID */}
      <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-botanical-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-botanical-100 text-botanical-800">
              {order.orderStatus === 'cancelled' ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-stone-500" />
                  <span>Order Cancelled</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-botanical-600" />
                  <span>Order Placed Successfully</span>
                </>
              )}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 mt-1">
              Order #{order.id}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Payment Status Pill */}
          <div className="self-start sm:self-auto">
            {order.orderStatus === 'cancelled' ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-stone-200 text-stone-800 border border-stone-300">
                <XCircle className="w-4 h-4 text-stone-600" />
                <span>CANCELLED</span>
              </span>
            ) : order.paymentStatus === 'paid' ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isCod ? 'PAID IN CASH' : 'PAYMENT CONFIRMED'}</span>
              </span>
            ) : order.paymentStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>PAYMENT FAILED</span>
              </span>
            ) : isCod ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Banknote className="w-4 h-4 text-amber-600" />
                <span>CASH ON DELIVERY • PAYMENT DUE</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>
                  {isTestMode && isAdmin
                    ? 'PAYMENT PENDING (₹1 TEST MODE)'
                    : 'PAYMENT PENDING'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Order Lifecycle Progress Bar or Cancellation Notice */}
        {order.orderStatus === 'cancelled' ? (
          <div className="pt-6">
            <div className="p-4 rounded-2xl bg-stone-100 border border-stone-300 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-stone-900">
                  This Order Has Been Cancelled
                </h3>
                <p className="text-xs text-stone-600">
                  {order.cancellationReason || 'The order was cancelled prior to flower preparation.'}
                </p>
                <div className="text-[11px] text-stone-500 pt-1">
                  Cancelled on:{' '}
                  {new Date(order.cancelledAt || order.statusUpdatedAt || order.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-stone-700">Order Status</div>
              {order.statusUpdatedAt && (
                <div className="text-[11px] text-stone-500">
                  Status Updated:{' '}
                  {new Date(order.statusUpdatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1 relative">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPast = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition mb-1.5 ${
                        isPast
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-botanical-700 text-white ring-4 ring-botanical-200'
                          : 'bg-stone-200 text-stone-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] leading-tight ${
                        isCurrent
                          ? 'font-bold text-botanical-900'
                          : isPast
                          ? 'text-stone-700'
                          : 'text-stone-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Customer Self-Cancellation Action */}
            {canCancelOrder(order).allowed && (
              <div className="pt-3 border-t border-botanical-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-stone-500">
                  Need to change your plan? You can cancel before morning preparation begins.
                </span>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </div>
            )}

            {cancelError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {cancelError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. CASH ON DELIVERY (COD) CONFIRMATION PANEL */}
      {isCod && (
        <div className="bg-amber-50/80 border-2 border-amber-300 rounded-3xl p-5 sm:p-7 shadow-soft space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-amber-950">
                Cash on Delivery (COD)
              </h2>
              <p className="text-xs sm:text-sm text-amber-900 font-semibold mt-0.5">
                Pay cash when your flowers are delivered.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-stone-600">Total Cash Due on Delivery:</span>
              <span className="font-bold text-base sm:text-lg text-botanical-900">
                {formatINR(order.totalPaise)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm border-t border-amber-100 pt-2 text-stone-600">
              <span>Payment Timing:</span>
              <span className="font-semibold text-amber-900">
                {order.paymentStatus === 'paid' ? 'Paid in Cash' : 'Pay cash when your flowers are delivered.'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm border-t border-amber-100 pt-2 text-stone-600">
              <span>Delivery Address:</span>
              <span className="font-medium text-stone-800 text-right truncate max-w-[200px] sm:max-w-none">
                {order.customer.flatNumber}, {order.customer.apartmentCommunity}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-100/70 rounded-xl text-xs text-amber-950 leading-relaxed border border-amber-200">
            ℹ️ No online payment is required. Our delivery team will hand over your fresh flowers at your doorstep and collect <strong>{formatINR(order.totalPaise)}</strong> in cash.
          </div>

          {order.whatsappLink && (
            <a
              href={order.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 text-center"
            >
              <Phone className="w-4 h-4" />
              <span>Message Mahesh Flora on WhatsApp</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* 2. ONLINE PAYMENT PANEL (Only for Online Payment Orders) */}
      {isOnlinePayment && order.paymentStatus !== 'paid' && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-7 shadow-soft space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-emerald-950">
                Complete Payment via WhatsApp UPI ({DEFAULT_SETTINGS.upiId})
              </h2>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Scan the UPI QR code below with any UPI App (Google Pay, PhonePe, Paytm), or tap the button to pay directly.
              </p>
            </div>
          </div>

          {/* TEST PAYMENT MODE BANNER - Shown only when test mode is active AND viewer is admin */}
          {isTestMode && isAdmin && (
            <div className="bg-amber-100/90 border-2 border-amber-400 rounded-2xl p-4 text-amber-950 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-600 text-white font-mono text-[11px] font-bold tracking-wide uppercase">
                  TEST PAYMENT MODE ACTIVE
                </span>
                <span className="text-xs text-amber-900 font-semibold">Development & Mobile Testing</span>
              </div>
              <div className="bg-white/90 rounded-xl p-3 border border-amber-300 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Original Order Total:</span>
                  <span className="font-semibold text-stone-900">{formatINR(order.totalPaise)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-sm text-amber-950 border-t border-amber-200 pt-1.5">
                  <span>Test Amount Payable Now:</span>
                  <span className="text-emerald-700 font-mono text-base">₹1.00</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ <strong>Notice:</strong> This transaction uses an authorized test amount of <strong>₹1.00</strong> to test mobile UPI redirect and payment flow.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-white p-5 rounded-2xl border border-emerald-200">
            {/* Dynamic UPI QR Code */}
            <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-2">
              <div className="p-2 bg-white rounded-xl border border-emerald-200 shadow-xs inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(universalUpiUri)}`}
                  alt="UPI Payment QR Code"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain mx-auto"
                />
              </div>
              <span className="text-[11px] font-semibold text-emerald-900 block">
                Scan to pay {isTestMode && isAdmin ? '₹1.00 (Test Mode)' : formatINR(order.totalPaise)}
              </span>
            </div>

            {/* UPI App & WhatsApp Action Column */}
            <div className="md:col-span-8 space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <div><strong>Business UPI ID:</strong> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">{DEFAULT_SETTINGS.upiId}</code></div>
                <div><strong>Original Order Total:</strong> <span className="font-semibold text-stone-700">{formatINR(order.totalPaise)}</span></div>
                {isTestMode && isAdmin ? (
                  <div><strong>Test Amount Payable:</strong> <span className="font-bold text-emerald-700">₹1.00 (Test Mode)</span></div>
                ) : (
                  <div><strong>Exact Amount:</strong> <span className="font-bold">{formatINR(order.totalPaise)}</span></div>
                )}
                <div><strong>Order Reference:</strong> <span className="font-mono font-bold">{order.id}</span></div>
              </div>

              {/* Direct UPI Intent Link for Mobile (Opens Android App Chooser) */}
              <a
                href={universalUpiUri}
                className="w-full py-3 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 text-center"
              >
                <span>Pay {isTestMode && isAdmin ? '₹1.00' : formatINR(order.totalPaise)} via UPI (PhonePe / GPay / Paytm)</span>
              </a>

              {/* Dedicated App Quick Redirect Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={phonepeUri}
                  className="py-2.5 px-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] text-center shadow-xs transition active:scale-95 flex items-center justify-center"
                >
                  <span>PhonePe {isTestMode && isAdmin ? '(₹1)' : ''}</span>
                </a>
                <a
                  href={gpayUri}
                  className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] text-center shadow-xs transition active:scale-95 flex items-center justify-center"
                >
                  <span>Google Pay {isTestMode && isAdmin ? '(₹1)' : ''}</span>
                </a>
                <a
                  href={paytmUri}
                  className="py-2.5 px-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[11px] text-center shadow-xs transition active:scale-95 flex items-center justify-center"
                >
                  <span>Paytm {isTestMode && isAdmin ? '(₹1)' : ''}</span>
                </a>
              </div>

              {/* WhatsApp Button */}
              {order.whatsappLink && (
                <a
                  href={order.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 text-center"
                >
                  <Phone className="w-4 h-4" />
                  <span>Open WhatsApp to Confirm with Mahesh Flora</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <p className="text-[10px] text-stone-500 text-center">
                Payment is only confirmed upon verification. Opening an app does not mark an order as paid.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. SAFE DEV MODE PAYMENT SIMULATOR - Restricted exclusively to authorized admin/developers */}
      {isAdmin && isOnlinePayment && order.paymentStatus !== 'paid' && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-3xl p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-xs sm:text-sm text-amber-950">
                🧪 Developer & Mobile Tester Tool: Safe Payment Simulation
              </h3>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Test server-side payment transitions without real transactions or external gateway credentials.
              </p>
            </div>
          </div>

          {simulationNote && (
            <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs font-semibold text-stone-800">
              {simulationNote}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleSimulatePayment('success')}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              {isSimulating ? 'Processing...' : 'Simulate Verified Payment (TEST 11)'}
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleSimulatePayment('failed')}
              className="flex-1 py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold transition"
            >
              {isSimulating ? 'Processing...' : 'Simulate Unsuccessful Payment (TEST 10)'}
            </button>
          </div>
        </div>
      )}

      {/* Details Grid: Delivery Schedule & Address */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Delivery Schedule */}
        <div className="bg-cream-100/80 border border-botanical-200 rounded-2xl p-4 space-y-2 text-xs">
          <div className="font-bold text-botanical-900 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-botanical-700" />
            <span>Delivery Schedule</span>
          </div>
          <div className="text-stone-700">
            <div>
              <strong>Mode:</strong> {order.orderType === 'subscription' ? 'Weekly Subscription' : 'One-Time Delivery'}
            </div>
            {order.deliverySchedule.date && (
              <div>
                <strong>Date:</strong> {order.deliverySchedule.date}
              </div>
            )}
            {order.deliverySchedule.daysOfWeek && (
              <div>
                <strong>Days:</strong> {order.deliverySchedule.daysOfWeek.join(', ')}
              </div>
            )}
            <div>
              <strong>Slot:</strong> {order.deliverySchedule.timeSlot === 'morning' ? 'Morning Puja Slot (6:00 AM – 8:30 AM)' : 'Evening Sandhya Slot (5:00 PM – 7:30 PM)'}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-cream-100/80 border border-botanical-200 rounded-2xl p-4 space-y-2 text-xs">
          <div className="font-bold text-botanical-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-botanical-700" />
            <span>Delivery Address</span>
          </div>
          <div className="text-stone-700 space-y-0.5">
            <div className="font-semibold text-botanical-900">{order.customer.customerName || order.customer.recipientName}</div>
            <div>
              {order.customer.flatNumber}
              {order.customer.tower ? `, Tower ${order.customer.tower}` : ''}
              {order.customer.block ? `, Block ${order.customer.block}` : ''}
              {order.customer.buildingTower && !order.customer.tower && !order.customer.block ? `, ${order.customer.buildingTower}` : ''}
              {order.customer.street ? `, ${order.customer.street}` : ''}
            </div>
            <div>
              {order.customer.apartmentCommunity ? `${order.customer.apartmentCommunity}, ` : ''}
              {order.customer.locality || ''}
            </div>
            {order.customer.landmark && (
              <div className="text-stone-500">Landmark: {order.customer.landmark}</div>
            )}
            {(order.customer.city || order.customer.pincode) && (
              <div className="text-stone-500">{order.customer.city || 'Bengaluru'} - {order.customer.pincode}</div>
            )}
            <div>Phone: {order.customer.phone}</div>
            {order.customer.deliveryInstructions && (
              <div className="text-[11px] text-stone-500 italic mt-1">
                Note: {order.customer.deliveryInstructions}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Items Summary & Financial Breakdown */}
      <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-serif font-bold text-base text-botanical-900 border-b border-botanical-200 pb-2">
          Ordered Flowers
        </h3>

        <div className="space-y-2 text-xs">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-1 border-b border-botanical-100/70">
              <div>
                <span className="font-semibold text-botanical-900">{item.name}</span>
                <span className="text-stone-500 ml-2">
                  ({item.quantity} × {formatINR(item.pricePaise)} / {item.unit})
                </span>
              </div>
              <span className="font-bold text-botanical-900">
                {formatINR(item.itemTotalPaise)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-1.5 text-xs text-stone-700">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-botanical-900">{formatINR(order.subtotalPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery Fee</span>
            <span>
              {order.deliveryFeePaise === 0 ? (
                <span className="text-emerald-700 font-bold">FREE</span>
              ) : (
                formatINR(order.deliveryFeePaise)
              )}
            </span>
          </div>
          <div className="pt-2 border-t border-botanical-200 flex justify-between items-baseline text-sm font-bold text-botanical-900">
            <span>Total Amount</span>
            <span className="text-lg font-serif">{formatINR(order.totalPaise)}</span>
          </div>
        </div>
      </div>

      {/* Return home link */}
      <div className="text-center pt-2">
        <Link
          href="/"
          className="text-xs font-semibold text-botanical-700 hover:text-botanical-900"
        >
          ← Return to Mahesh Flora Home
        </Link>
      </div>

    </div>
  );
}
