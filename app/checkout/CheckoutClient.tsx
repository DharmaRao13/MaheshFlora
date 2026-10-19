'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Building,
  Info
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { DEFAULT_SETTINGS, formatINR } from '@/lib/config';
import { DeliveryTimeSlot, PaymentMethod } from '@/types';

const DAYS_OF_WEEK = [
  { id: 'Mon', label: 'Mon', name: 'Monday' },
  { id: 'Tue', label: 'Tue', name: 'Tuesday' },
  { id: 'Wed', label: 'Wed', name: 'Wednesday' },
  { id: 'Thu', label: 'Thu', name: 'Thursday' },
  { id: 'Fri', label: 'Fri', name: 'Friday' },
  { id: 'Sat', label: 'Sat', name: 'Saturday' },
  { id: 'Sun', label: 'Sun', name: 'Sunday' },
] as const;

export default function CheckoutClient() {
  const router = useRouter();
  const { items, subtotalPaise, deliveryFeePaise, totalPaise, clearCart, syncCartPrices, isHydrated } = useCart();
  const { user, customerPhone, idToken, getIdToken, sendOtp, verifyOtp } = useCustomerAuth();

  // Mode: one-time or subscription
  const [orderMode, setOrderMode] = useState<'one-time' | 'subscription'>('one-time');

  // Customer Address form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [apartmentCommunity, setApartmentCommunity] = useState('');
  const [buildingTower, setBuildingTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Prefill phone from customerPhone if available
  useEffect(() => {
    if (customerPhone && !phone) {
      setPhone(customerPhone.replace(/[^0-9]/g, '').slice(-10));
    }
  }, [customerPhone, phone]);

  // Phone OTP Verification modal & state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  const cleanVerifiedPhone = customerPhone ? customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
  const isPhoneVerified = Boolean(cleanPhone && cleanPhone.length === 10 && cleanPhone === cleanVerifiedPhone);

  // One-time scheduling state (default tomorrow's date)
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [deliveryDate, setDeliveryDate] = useState(tomorrowStr);
  const [timeSlot, setTimeSlot] = useState<DeliveryTimeSlot>('morning');

  // Subscription scheduling state
  const [selectedDays, setSelectedDays] = useState<('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[]>([
    'Mon',
    'Wed',
    'Fri',
  ]);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(tomorrowStr);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('whatsapp_upi');

  // Form submission, error & price change alert state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priceChangeAlert, setPriceChangeAlert] = useState<{
    previousSubtotalPaise: number;
    currentSubtotalPaise: number;
    differencePaise: number;
    message: string;
  } | null>(null);

  if (!isHydrated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm text-stone-600">Preparing checkout...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-botanical-100 flex items-center justify-center text-botanical-800 mx-auto">
          <AlertCircle className="w-8 h-8 text-botanical-700" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-botanical-900">
          Your cart is empty
        </h2>
        <p className="text-xs sm:text-sm text-stone-600">
          Please add flowers to your basket before proceeding to checkout.
        </p>
        <Link
          href="/flowers"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs shadow-soft"
        >
          <span>Browse Flower Catalogue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const toggleDay = (day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun') => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const executeOrderPlacement = async (authToken?: string | null, forceConfirmPriceChange = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const tokenToUse = authToken || (await getIdToken());
      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }
      if (phone) {
        headers['x-customer-phone'] = phone.replace(/[^0-9]/g, '').slice(-10);
      }
      if (user?.uid) {
        headers['x-customer-uid'] = user.uid;
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer: {
            customerName: customerName.trim(),
            phone: phone.trim(),
            apartmentCommunity: apartmentCommunity.trim(),
            buildingTower: buildingTower.trim(),
            flatNumber: flatNumber.trim(),
            deliveryInstructions: deliveryInstructions.trim() || undefined,
          },
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          expectedSubtotalPaise: subtotalPaise,
          confirmPriceChange: forceConfirmPriceChange,
          deliverySchedule: {
            type: orderMode,
            ...(orderMode === 'one-time'
              ? { date: deliveryDate, timeSlot }
              : {
                  daysOfWeek: selectedDays,
                  subscriptionStartDate,
                  timeSlot,
                }),
          },
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.code === 'PRICE_CHANGED') {
        if (data.updatedItems && Array.isArray(data.updatedItems)) {
          syncCartPrices(data.updatedItems);
        }
        setPriceChangeAlert({
          previousSubtotalPaise: data.previousSubtotalPaise,
          currentSubtotalPaise: data.currentSubtotalPaise,
          differencePaise: data.differencePaise,
          message: data.message,
        });
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      // Clear the local cart
      clearCart();

      // Securely store guest order token and phone on client for 'My Orders' recall
      try {
        const stored = JSON.parse(localStorage.getItem('mahesh_guest_orders') || '{}');
        if (data.order?.id && data.order?.accessToken) {
          stored[data.order.id] = data.order.accessToken;
          localStorage.setItem('mahesh_guest_orders', JSON.stringify(stored));
        }
        if (phone) {
          localStorage.setItem('mahesh_customer_phone', phone.replace(/[^0-9]/g, '').slice(-10));
        }
      } catch {}

      // Redirect to order confirmation page with secure token
      const tokenParam = data.order?.accessToken ? `?token=${encodeURIComponent(data.order.accessToken)}` : '';
      router.push(`/orders/${data.order.id}${tokenParam}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please check your details.');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtpAndPlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpError('Please enter the 6-digit verification code received via SMS.');
      return;
    }

    setIsOtpVerifying(true);
    try {
      const result = await verifyOtp(otpCode);
      if (result.success) {
        setShowOtpModal(false);
        const freshToken = await getIdToken();
        await executeOrderPlacement(freshToken);
      } else {
        setOtpError(result.error || 'Invalid OTP code. Please check and try again.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, forceConfirmPriceChange = false) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Basic frontend verification
    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    if (!apartmentCommunity.trim()) {
      setErrorMessage('Please type your apartment or gated community name');
      return;
    }

    if (!buildingTower.trim()) {
      setErrorMessage('Please enter your building or tower name');
      return;
    }

    if (!flatNumber.trim()) {
      setErrorMessage('Please enter your flat or door number');
      return;
    }

    if (orderMode === 'subscription' && selectedDays.length === 0) {
      setErrorMessage('Please select at least one delivery day for your subscription');
      return;
    }

    // Check phone verification
    if (!isPhoneVerified) {
      setIsOtpSending(true);
      setOtpError(null);
      setOtpMessage(null);
      setShowOtpModal(true);
      try {
        const res = await sendOtp(phone);
        if (res.success) {
          setOtpMessage(`Verification code sent via SMS to +91 ${cleanPhone}`);
        } else {
          setOtpError(res.error || 'Failed to send OTP SMS.');
        }
      } catch (err: any) {
        setOtpError(err.message || 'Error sending verification code.');
      } finally {
        setIsOtpSending(false);
      }
      return;
    }

    // If phone is already verified, proceed directly
    await executeOrderPlacement(null, forceConfirmPriceChange);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      
      <div className="mb-6 pb-3 border-b border-botanical-100">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900">
          Delivery & Checkout
        </h1>
        <p className="text-xs text-stone-600 mt-0.5">
          Schedule your flower delivery to your gated community flat in Hyderabad
        </p>
      </div>

      {priceChangeAlert && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-amber-900 text-sm">
                Market Price Update Notice
              </h3>
              <p className="text-amber-800">
                {priceChangeAlert.message}
              </p>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200 flex flex-wrap gap-4 text-xs font-medium">
                <div>
                  <span className="text-stone-500">Previous Subtotal: </span>
                  <span className="line-through text-stone-600">{formatINR(priceChangeAlert.previousSubtotalPaise)}</span>
                </div>
                <div>
                  <span className="text-stone-500">Today&apos;s Updated Subtotal: </span>
                  <span className="text-botanical-800 font-bold">{formatINR(priceChangeAlert.currentSubtotalPaise)}</span>
                </div>
                <div>
                  <span className="text-stone-500">Difference: </span>
                  <span className={priceChangeAlert.differencePaise > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                    {priceChangeAlert.differencePaise > 0 ? `+${formatINR(priceChangeAlert.differencePaise)}` : formatINR(priceChangeAlert.differencePaise)}
                  </span>
                </div>
              </div>
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-4 py-2 bg-botanical-800 hover:bg-botanical-900 text-cream-50 rounded-xl font-semibold text-xs transition-colors shadow-soft"
                >
                  {isSubmitting ? 'Confirming...' : 'Accept New Prices & Place Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceChangeAlert(null)}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl font-medium text-xs transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECTION 1: DELIVERY MODE SELECTOR */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
            <h2 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-botanical-700" />
              1. Choose Delivery Schedule Mode
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderMode('one-time')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  orderMode === 'one-time'
                    ? 'border-botanical-700 bg-botanical-50/90 ring-2 ring-botanical-600/30'
                    : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs sm:text-sm text-botanical-900">
                    One-Time Delivery
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Delivered on a specific date for puja or decoration
                  </div>
                </div>
                {orderMode === 'one-time' && (
                  <CheckCircle2 className="w-4 h-4 text-botanical-700 mt-2 self-end" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setOrderMode('subscription')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  orderMode === 'subscription'
                    ? 'border-petal-500 bg-petal-50/80 ring-2 ring-petal-400/30'
                    : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs sm:text-sm text-petal-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Weekly Subscription</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Recurring on chosen days (e.g. Mon, Wed, Fri)
                  </div>
                </div>
                {orderMode === 'subscription' && (
                  <CheckCircle2 className="w-4 h-4 text-petal-600 mt-2 self-end" />
                )}
              </button>
            </div>

            {/* DETAILS FOR MODE 1: ONE-TIME */}
            {orderMode === 'one-time' && (
              <div className="pt-3 border-t border-botanical-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Delivery Date *
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Time Slot *
                    </label>
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value as DeliveryTimeSlot)}
                      className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                    >
                      <option value="morning">{DEFAULT_SETTINGS.timeSlots.morning.label} ({DEFAULT_SETTINGS.timeSlots.morning.time})</option>
                      <option value="evening">{DEFAULT_SETTINGS.timeSlots.evening.label} ({DEFAULT_SETTINGS.timeSlots.evening.time})</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-botanical-50/70 border border-botanical-200/60 text-[11px] text-stone-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-botanical-600 shrink-0" />
                  <span>
                    Cut-off note: Orders for tomorrow morning must be placed before 8:00 PM tonight.
                  </span>
                </div>
              </div>
            )}

            {/* DETAILS FOR MODE 2: WEEKLY SUBSCRIPTION */}
            {orderMode === 'subscription' && (
              <div className="pt-3 border-t border-petal-100 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">
                    Select Weekly Delivery Days *
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = selectedDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          className={`py-2 rounded-xl text-xs font-bold transition flex flex-col items-center ${
                            isSelected
                              ? 'bg-botanical-700 text-white shadow-xs'
                              : 'bg-cream-50 text-stone-600 border border-botanical-200 hover:bg-cream-200/50'
                          }`}
                        >
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1.5">
                    Selected: {selectedDays.length === 0 ? 'None' : selectedDays.join(', ')} ({selectedDays.length} days/week)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Preferred Time Slot *
                    </label>
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value as DeliveryTimeSlot)}
                      className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                    >
                      <option value="morning">{DEFAULT_SETTINGS.timeSlots.morning.label} (Morning Puja)</option>
                      <option value="evening">{DEFAULT_SETTINGS.timeSlots.evening.label} (Evening Sandhya)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Subscription Start Date *
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={subscriptionStartDate}
                      onChange={(e) => setSubscriptionStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                    />
                  </div>
                </div>

                {/* Subscription schedule preview box */}
                <div className="p-3 rounded-xl bg-petal-50/80 border border-petal-200/70 text-xs text-petal-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-petal-600" />
                    <span>Subscription Summary:</span>
                  </div>
                  <p>
                    Delivering fresh blooms every <strong>{selectedDays.join(', ') || 'No days selected'}</strong> during the{' '}
                    <strong>{timeSlot === 'morning' ? 'Morning Puja Slot (6:00 AM – 8:30 AM)' : 'Evening Slot'}</strong>.
                  </p>
                  <p className="text-[11px] text-stone-600 pt-0.5">
                    You can skip any date or pause deliveries anytime in your subscription dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: CUSTOMER CONTACT & APARTMENT ADDRESS */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
            <h2 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-botanical-700" />
              2. Hyderabad Delivery Address
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Your Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Radhika Sharma"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Indian Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    maxLength={14}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                {isPhoneVerified ? (
                  <span className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Mobile number verified with OTP
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-500 mt-0.5 block">
                    SMS OTP will be sent to confirm your order and phone identity
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Apartment / Gated Community Name *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={apartmentCommunity}
                  onChange={(e) => setApartmentCommunity(e.target.value)}
                  placeholder="Type your apartment or gated community name (e.g. My Home Bhooja, Rainbow Vistas)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Building / Tower / Block *
                </label>
                <input
                  type="text"
                  required
                  value={buildingTower}
                  onChange={(e) => setBuildingTower(e.target.value)}
                  placeholder="e.g. Tower 3 / Block B"
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Flat / Door Number *
                </label>
                <input
                  type="text"
                  required
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  placeholder="e.g. Flat 804"
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Optional Delivery Instructions
              </label>
              <input
                type="text"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder="e.g. Leave in basket on door hook / Ring bell after 6:30 AM"
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>
          </div>

          {/* SECTION 3: PAYMENT METHOD */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
            <h2 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-botanical-700" />
              3. Payment Method
            </h2>

            <div className="space-y-2.5">
              <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                paymentMethod === 'whatsapp_upi'
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                  : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/50'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="whatsapp_upi"
                  checked={paymentMethod === 'whatsapp_upi'}
                  onChange={() => setPaymentMethod('whatsapp_upi')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <span>WhatsApp-Assisted UPI Payment (Recommended)</span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Order confirmation is generated immediately. Pay directly via Google Pay, PhonePe, or Paytm UPI using our payment link on WhatsApp.
                  </p>
                </div>
              </label>

              <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                paymentMethod === 'cod'
                  ? 'border-botanical-700 bg-botanical-50/80 ring-2 ring-botanical-600/20'
                  : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/50'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="mt-1 text-botanical-700 focus:ring-botanical-500"
                />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900">
                    Cash on Doorstep Delivery (COD)
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Pay in cash when our delivery executive arrives at your apartment door.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Review & Confirmation CTA */}
        <div className="lg:col-span-5 bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft space-y-5 sticky top-24">
          <h3 className="font-serif font-bold text-lg text-botanical-900 pb-3 border-b border-botanical-200">
            Review Your Items
          </h3>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-botanical-900">{i.product.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {i.quantity} × {formatINR(i.product.pricePaise)} ({i.product.unit})
                  </div>
                </div>
                <div className="font-bold text-botanical-900">
                  {formatINR(i.product.pricePaise * i.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-3 border-t border-botanical-200 text-xs sm:text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-botanical-900">{formatINR(subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Doorstep Delivery</span>
              <span>
                {deliveryFeePaise === 0 ? (
                  <span className="text-emerald-700 font-bold">FREE</span>
                ) : (
                  formatINR(deliveryFeePaise)
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-botanical-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-botanical-900">Total to Pay</span>
              <span className="text-xl font-serif font-bold text-botanical-900">
                {formatINR(totalPaise)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 rounded-xl text-cream-50 font-semibold text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 ${
              isSubmitting
                ? 'bg-stone-400 cursor-not-allowed'
                : 'bg-botanical-700 hover:bg-botanical-800'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cream-50 border-t-transparent rounded-full animate-spin"></div>
                <span>Securing Order...</span>
              </div>
            ) : (
              <>
                <span>Place Order & Confirm Delivery</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="space-y-1.5 pt-2 text-[11px] text-stone-500 text-center">
            <p>✓ No account creation required for one-time orders</p>
            <p>✓ Direct WhatsApp updates with your unique Order ID</p>
          </div>
        </div>

      </form>

      {/* Phone OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cream-50 border border-botanical-200 rounded-3xl p-6 max-w-md w-full shadow-soft space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-botanical-900">
                  Verify Mobile Number
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  We sent a 6-digit SMS verification code to <strong>+91 {cleanPhone}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 font-bold text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {otpMessage && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{otpMessage}</span>
              </div>
            )}

            {otpError && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndPlaceOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 text-center">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 text-center font-mono text-2xl tracking-[0.5em] rounded-xl border border-botanical-300 bg-white text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isOtpVerifying || otpCode.length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs hover:bg-botanical-800 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft"
                >
                  {isOtpVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-cream-50 border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying & Placing Order...</span>
                    </>
                  ) : (
                    <span>Verify & Place Order</span>
                  )}
                </button>

                <div className="flex justify-between items-center text-[11px] pt-1 px-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsOtpSending(true);
                      setOtpError(null);
                      const res = await sendOtp(phone);
                      setIsOtpSending(false);
                      if (res.success) {
                        setOtpMessage(`New code sent via SMS to +91 ${cleanPhone}`);
                      } else {
                        setOtpError(res.error || 'Failed to resend code.');
                      }
                    }}
                    disabled={isOtpSending}
                    className="text-botanical-700 hover:underline font-medium disabled:opacity-50"
                  >
                    {isOtpSending ? 'Sending...' : 'Resend SMS code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="text-stone-500 hover:text-stone-800"
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
