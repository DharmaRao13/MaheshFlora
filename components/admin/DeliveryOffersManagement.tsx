'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Gift,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Save,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { BusinessSettings, DeliveryPromotion, DeliveryPromotionType } from '@/types';
import { formatINR } from '@/lib/config';

interface DeliveryOffersManagementProps {
  settings: BusinessSettings;
  onSettingsUpdated: (updated: BusinessSettings) => void;
  adminKey?: string;
}

export default function DeliveryOffersManagement({
  settings,
  onSettingsUpdated,
  adminKey,
}: DeliveryOffersManagementProps) {
  const initialPromo: DeliveryPromotion = settings.deliveryPromotion || {
    id: 'promo-free-delivery',
    enabled: true,
    title: 'Free Delivery for First Time Customers',
    type: 'first_time_customers',
    minOrderAmountPaise: 0,
    maxQualifyingOrders: 100,
    currentQualifyingOrdersCount: 0,
    maxUsesPerCustomer: 1,
    isCombinable: true,
    bannerWording: '🎉 Free Delivery on your first order! Welcome to Mahesh Flora.',
  };

  const [promo, setPromo] = useState<DeliveryPromotion>(initialPromo);
  const [minOrderRupees, setMinOrderRupees] = useState<number>(
    Math.round((initialPromo.minOrderAmountPaise || 0) / 100)
  );
  const [normalDeliveryFeeRupees, setNormalDeliveryFeeRupees] = useState<number>(
    Math.round((settings.standardDeliveryFeePaise || 3000) / 100)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings.deliveryPromotion) {
      setPromo(settings.deliveryPromotion);
      setMinOrderRupees(Math.round((settings.deliveryPromotion.minOrderAmountPaise || 0) / 100));
    }
    if (typeof settings.standardDeliveryFeePaise === 'number') {
      setNormalDeliveryFeeRupees(Math.round(settings.standardDeliveryFeePaise / 100));
    }
  }, [settings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const updatedPromo: DeliveryPromotion = {
      ...promo,
      minOrderAmountPaise: Math.max(0, Math.round(minOrderRupees * 100)),
    };

    try {
      const key = adminKey || (typeof window !== 'undefined' ? localStorage.getItem('mahesh_admin_key') || '' : '');
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': key,
        },
        body: JSON.stringify({
          deliveryPromotion: updatedPromo,
          standardDeliveryFeePaise: Math.max(0, Math.round(normalDeliveryFeeRupees * 100)),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update delivery promotion settings');
      }

      const data = await res.json();
      setSuccessMessage('Delivery offer settings saved successfully!');
      if (data.settings) {
        onSettingsUpdated(data.settings);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-botanical-200 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-botanical-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-botanical-700" />
            <span>Delivery Offers & Free Delivery Promotions</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Configure automated free delivery discounts, early-bird limits, and promotional banners
          </p>
        </div>

        {/* Master ON/OFF Toggle */}
        <div className="flex items-center gap-3 bg-cream-100 p-2 rounded-xl border border-botanical-200 self-start sm:self-auto">
          <span className="text-xs font-bold text-botanical-900">
            Promotion Status:
          </span>
          <button
            type="button"
            onClick={() => setPromo((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              promo.enabled
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-stone-300 text-stone-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${promo.enabled ? 'bg-white animate-pulse' : 'bg-stone-500'}`}
            ></span>
            <span>{promo.enabled ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Live Customer Preview Banner */}
      <div className="bg-white p-5 rounded-2xl border border-botanical-200 shadow-soft space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-saffron-500" />
          <span>Live Customer Website Banner Preview</span>
        </div>
        {promo.enabled ? (
          <div className="bg-gradient-to-r from-emerald-800 via-botanical-800 to-emerald-900 text-cream-50 px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-between text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-full bg-saffron-400 text-botanical-950 font-bold shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>{promo.bannerWording || promo.title || 'Free Delivery on your order!'}</span>
              {minOrderRupees > 0 && (
                <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                  Min ₹{minOrderRupees}
                </span>
              )}
            </div>
            <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-mono">
              PREVIEW
            </span>
          </div>
        ) : (
          <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-500 italic text-center">
            Promotion is currently switched OFF. Standard delivery fee of {formatINR(settings.standardDeliveryFeePaise)} (or free above {formatINR(settings.freeDeliveryThresholdPaise)}) applies.
          </div>
        )}
      </div>

      {/* Promotion Config Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-botanical-200 shadow-soft space-y-6">
        <h3 className="font-serif font-bold text-base text-botanical-900 pb-2 border-b border-botanical-100">
          Promotion Rules & Qualification Criteria
        </h3>

        {/* Offer Type Selection */}
        <div>
          <label className="block text-xs font-semibold text-botanical-900 mb-2">
            Offer Qualification Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'all_orders',
                label: 'All Eligible Orders',
                desc: 'Free delivery applies to all qualifying orders meeting the minimum amount.',
              },
              {
                id: 'first_time_customers',
                label: 'First-Time Customers Only',
                desc: 'Only applies to a customer’s very first order across their verified account.',
              },
              {
                id: 'first_n_orders',
                label: 'First N Orders (Cap)',
                desc: 'Storewide early-bird cap (e.g. first 50 or 100 orders).',
              },
              {
                id: 'first_time_and_first_n_orders',
                label: 'Both (First-Time & Cap)',
                desc: 'Applies to first-time customers who are among the first N qualifying orders.',
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPromo((p) => ({ ...p, type: t.id as DeliveryPromotionType }))}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  promo.type === t.id
                    ? 'border-botanical-700 bg-botanical-50/70 ring-2 ring-botanical-600/30'
                    : 'border-stone-200 bg-white hover:border-botanical-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-botanical-900">{t.label}</div>
                  <div className="text-[11px] text-stone-500 mt-1">{t.desc}</div>
                </div>
                {promo.type === t.id && (
                  <CheckCircle2 className="w-4 h-4 text-botanical-700 mt-2 self-end" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Promotion Title & Banner Copy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5">
              Internal Promotion Name
            </label>
            <input
              type="text"
              value={promo.title}
              onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Diwali Free Delivery Week"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5">
              Banner Wording (Customer-Facing)
            </label>
            <input
              type="text"
              value={promo.bannerWording || ''}
              onChange={(e) => setPromo((p) => ({ ...p, bannerWording: e.target.value }))}
              placeholder="e.g. 🎉 Free Delivery on your first order!"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
          </div>
        </div>

        {/* Numerical Rules & Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5">
              Minimum Purchase Amount (₹)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[0, 99, 149, 199, 249].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setMinOrderRupees(amt)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                    minOrderRupees === amt
                      ? 'bg-botanical-700 text-cream-50 border-botanical-700 shadow-xs'
                      : 'bg-cream-100 text-stone-700 border-stone-300 hover:bg-cream-200'
                  }`}
                >
                  {amt === 0 ? '₹0 (None)' : `₹${amt}`}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500 font-bold text-xs">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={minOrderRupees}
                onChange={(e) => setMinOrderRupees(Math.max(0, Math.floor(Number(e.target.value))))}
                placeholder="Enter custom amount (e.g. 149)"
                className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono font-bold bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              {minOrderRupees === 0
                ? 'No minimum required (applies to any order total).'
                : `Customers must purchase at least ₹${minOrderRupees} of flowers to qualify.`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5">
              Maximum Orders Cap (Storewide)
            </label>
            <input
              type="number"
              min={1}
              value={promo.maxQualifyingOrders || 100}
              onChange={(e) =>
                setPromo((p) => ({ ...p, maxQualifyingOrders: Number(e.target.value) }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
            <p className="text-[10px] text-stone-500 mt-1">
              Current redeemed count:{' '}
              <span className="font-bold text-botanical-900 font-mono">
                {promo.currentQualifyingOrdersCount || 0}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5">
              Max Redemptions Per Customer
            </label>
            <input
              type="number"
              min={1}
              value={promo.maxUsesPerCustomer || 1}
              onChange={(e) =>
                setPromo((p) => ({ ...p, maxUsesPerCustomer: Number(e.target.value) }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
            <p className="text-[10px] text-stone-500 mt-1">Default 1 for first-time or welcome offers.</p>
          </div>
        </div>

        {/* Normal Delivery Fee Configuration */}
        <div className="bg-cream-100/70 p-4 rounded-xl border border-botanical-200">
          <label className="block text-xs font-semibold text-botanical-900 mb-1">
            Normal Delivery Fee (₹)
          </label>
          <p className="text-[11px] text-stone-600 mb-2">
            The delivery charge customers pay when they do not qualify for free delivery.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative w-40">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500 font-bold text-xs">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={normalDeliveryFeeRupees}
                onChange={(e) => setNormalDeliveryFeeRupees(Math.max(0, Math.floor(Number(e.target.value))))}
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-mono font-bold bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>
            <span className="text-xs text-stone-600">
              Currently {formatINR(normalDeliveryFeeRupees * 100)} per delivery
            </span>
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-botanical-700" />
              <span>Start Date (Optional)</span>
            </label>
            <input
              type="date"
              value={promo.startDate || ''}
              onChange={(e) => setPromo((p) => ({ ...p, startDate: e.target.value || undefined }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-botanical-900 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-botanical-700" />
              <span>End Date (Optional)</span>
            </label>
            <input
              type="date"
              value={promo.endDate || ''}
              onChange={(e) => setPromo((p) => ({ ...p, endDate: e.target.value || undefined }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-botanical-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setPromo((p) => ({
                ...p,
                currentQualifyingOrdersCount: 0,
              }))
            }
            className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-medium transition flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Redemption Counter</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 disabled:opacity-50 text-cream-50 font-semibold text-xs shadow-soft transition flex items-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Promotion...' : 'Save Promotion Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
