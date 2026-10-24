'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  TrendingUp,
  Receipt,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Edit3,
  Check,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { StallDailyEntry, StallFlowerSales, StallCollections, StallExpenses } from '@/types';
import { formatINR } from '@/lib/config';
import { getISTDateComponents, formatYYYYMMDD } from '@/lib/dateUtils';

interface StallManagementProps {
  adminKey: string;
  onNavigateToTab?: (tab: string) => void;
}

type StallSection = 'daily-entry' | 'entry-history' | 'expense-summary' | 'stall-summary';

export default function StallManagement({ adminKey, onNavigateToTab }: StallManagementProps) {
  const [activeSection, setActiveSection] = useState<StallSection>('daily-entry');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<StallDailyEntry[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Today in IST
  const todayIST = useMemo(() => {
    const { year, month, day } = getISTDateComponents(new Date());
    return formatYYYYMMDD(year, month, day);
  }, []);

  // Form State
  const [businessDate, setBusinessDate] = useState<string>(todayIST);
  const [existingEntry, setExistingEntry] = useState<StallDailyEntry | null>(null);

  // Sales in Rupees
  const [jasmineRupees, setJasmineRupees] = useState<string>('0');
  const [marigoldRupees, setMarigoldRupees] = useState<string>('0');
  const [mixedRupees, setMixedRupees] = useState<string>('0');
  const [otherFlowersRupees, setOtherFlowersRupees] = useState<string>('0');

  // Collections in Rupees
  const [cashRupees, setCashRupees] = useState<string>('0');
  const [upiRupees, setUpiRupees] = useState<string>('0');
  const [otherColRupees, setOtherColRupees] = useState<string>('0');

  // Expenses in Rupees
  const [flowerCostRupees, setFlowerCostRupees] = useState<string>('0');
  const [transportRupees, setTransportRupees] = useState<string>('0');
  const [packagingRupees, setPackagingRupees] = useState<string>('0');
  const [otherExpRupees, setOtherExpRupees] = useState<string>('0');

  // Reconciliation & Metadata
  const [notes, setNotes] = useState<string>('');
  const [reconciliationAcknowledged, setReconciliationAcknowledged] = useState<boolean>(false);
  const [reconciliationReason, setReconciliationReason] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [viewAuditModal, setViewAuditModal] = useState<StallDailyEntry | null>(null);

  const adminHeaders = useMemo(() => {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
    };
  }, [adminKey]);

  // Load entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stall/entries', {
        headers: adminHeaders,
      });
      const data = await res.json();
      if (res.ok && data.entries) {
        setEntries(data.entries);
      }
    } catch (err: any) {
      console.error('Failed to load stall entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // When business date changes, check if existing record exists
  useEffect(() => {
    const found = entries.find((e) => e.date === businessDate);
    if (found) {
      setExistingEntry(found);
      setJasmineRupees(((found.flowerSales?.jasminePaise || 0) / 100).toString());
      setMarigoldRupees(((found.flowerSales?.marigoldPaise || 0) / 100).toString());
      setMixedRupees(((found.flowerSales?.mixedFlowersPaise || 0) / 100).toString());
      setOtherFlowersRupees(((found.flowerSales?.otherFlowersPaise || 0) / 100).toString());

      setCashRupees(((found.collections?.cashPaise || 0) / 100).toString());
      setUpiRupees(((found.collections?.upiPaise || 0) / 100).toString());
      setOtherColRupees(((found.collections?.otherPaise || 0) / 100).toString());

      setFlowerCostRupees(((found.expenses?.flowerPurchasePaise || 0) / 100).toString());
      setTransportRupees(((found.expenses?.transportPaise || 0) / 100).toString());
      setPackagingRupees(((found.expenses?.packagingPaise || 0) / 100).toString());
      setOtherExpRupees(((found.expenses?.otherPaise || 0) / 100).toString());

      setNotes(found.notes || '');
      setReconciliationAcknowledged(Boolean(found.reconciliationAcknowledged));
      setReconciliationReason(found.reconciliationReason || '');
      setCorrectionReason('');
    } else {
      setExistingEntry(null);
      setJasmineRupees('0');
      setMarigoldRupees('0');
      setMixedRupees('0');
      setOtherFlowersRupees('0');

      setCashRupees('0');
      setUpiRupees('0');
      setOtherColRupees('0');

      setFlowerCostRupees('0');
      setTransportRupees('0');
      setPackagingRupees('0');
      setOtherExpRupees('0');

      setNotes('');
      setReconciliationAcknowledged(false);
      setReconciliationReason('');
      setCorrectionReason('');
    }
  }, [businessDate, entries]);

  // Derived Calculations
  const parseSafeRupees = (val: string) => {
    const n = parseFloat(val);
    return isNaN(n) || n < 0 ? 0 : n;
  };

  const calculatedSalesRupees = useMemo(() => {
    return (
      parseSafeRupees(jasmineRupees) +
      parseSafeRupees(marigoldRupees) +
      parseSafeRupees(mixedRupees) +
      parseSafeRupees(otherFlowersRupees)
    );
  }, [jasmineRupees, marigoldRupees, mixedRupees, otherFlowersRupees]);

  const calculatedCollectionsRupees = useMemo(() => {
    return (
      parseSafeRupees(cashRupees) +
      parseSafeRupees(upiRupees) +
      parseSafeRupees(otherColRupees)
    );
  }, [cashRupees, upiRupees, otherColRupees]);

  const calculatedExpensesRupees = useMemo(() => {
    return (
      parseSafeRupees(flowerCostRupees) +
      parseSafeRupees(transportRupees) +
      parseSafeRupees(packagingRupees) +
      parseSafeRupees(otherExpRupees)
    );
  }, [flowerCostRupees, transportRupees, packagingRupees, otherExpRupees]);

  const preliminaryOperatingResultRupees = calculatedSalesRupees - calculatedExpensesRupees;
  const reconciliationDifferenceRupees = calculatedCollectionsRupees - calculatedSalesRupees;
  const hasReconciliationMismatch = Math.abs(reconciliationDifferenceRupees) >= 0.01;

  // Handle Form Submission
  const handleSubmitEntry = async (status: 'draft' | 'finalized') => {
    setMessage(null);
    if (!businessDate) {
      setMessage({ type: 'error', text: 'Business date is required.' });
      return;
    }

    if (hasReconciliationMismatch && !reconciliationAcknowledged) {
      setMessage({
        type: 'error',
        text: `Collections (₹${formatINR(calculatedCollectionsRupees)}) do not match sales (₹${formatINR(calculatedSalesRupees)}). Please verify or check explicit acknowledgement.`,
      });
      return;
    }

    if (hasReconciliationMismatch && !reconciliationReason.trim()) {
      setMessage({
        type: 'error',
        text: 'Please provide an explanation reason for the sales vs collections difference.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        stallId: 'main',
        stallName: 'Main Flower Stall',
        date: businessDate,
        flowerSales: {
          jasminePaise: Math.round(parseSafeRupees(jasmineRupees) * 100),
          marigoldPaise: Math.round(parseSafeRupees(marigoldRupees) * 100),
          mixedFlowersPaise: Math.round(parseSafeRupees(mixedRupees) * 100),
          otherFlowersPaise: Math.round(parseSafeRupees(otherFlowersRupees) * 100),
        },
        collections: {
          cashPaise: Math.round(parseSafeRupees(cashRupees) * 100),
          upiPaise: Math.round(parseSafeRupees(upiRupees) * 100),
          otherPaise: Math.round(parseSafeRupees(otherColRupees) * 100),
        },
        expenses: {
          flowerPurchasePaise: Math.round(parseSafeRupees(flowerCostRupees) * 100),
          transportPaise: Math.round(parseSafeRupees(transportRupees) * 100),
          packagingPaise: Math.round(parseSafeRupees(packagingRupees) * 100),
          otherPaise: Math.round(parseSafeRupees(otherExpRupees) * 100),
        },
        reconciliationAcknowledged,
        reconciliationReason,
        notes,
        status,
        expectedVersion: existingEntry?.version,
        correctionReason: correctionReason.trim() || undefined,
      };

      const res = await fetch('/api/admin/stall/entries', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save daily stall entry');
      }

      setMessage({
        type: 'success',
        text: `Daily stall record for ${businessDate} successfully saved as ${status.toUpperCase()}!`,
      });
      await fetchEntries();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving entry' });
    } finally {
      setSubmitting(false);
    }
  };

  // Section 3: Expense Summary aggregated
  const expenseSummary = useMemo(() => {
    let flowerPurchaseTotal = 0;
    let transportTotal = 0;
    let packagingTotal = 0;
    let otherTotal = 0;
    let totalAll = 0;

    for (const e of entries) {
      flowerPurchaseTotal += (e.expenses?.flowerPurchasePaise || 0) / 100;
      transportTotal += (e.expenses?.transportPaise || 0) / 100;
      packagingTotal += (e.expenses?.packagingPaise || 0) / 100;
      otherTotal += (e.expenses?.otherPaise || 0) / 100;
      totalAll += (e.totalExpensesPaise || 0) / 100;
    }

    return {
      flowerPurchaseTotal,
      transportTotal,
      packagingTotal,
      otherTotal,
      totalAll,
    };
  }, [entries]);

  // Section 4: Stall Summary aggregated
  const stallSummary = useMemo(() => {
    let totalSales = 0;
    let totalCollections = 0;
    let totalExpenses = 0;
    let totalCash = 0;
    let totalUpi = 0;
    let discrepanciesCount = 0;

    for (const e of entries) {
      totalSales += (e.totalSalesPaise || 0) / 100;
      totalCollections += (e.totalCollectionsPaise || 0) / 100;
      totalExpenses += (e.totalExpensesPaise || 0) / 100;
      totalCash += (e.collections?.cashPaise || 0) / 100;
      totalUpi += (e.collections?.upiPaise || 0) / 100;
      if ((e.reconciliationDifferencePaise || 0) !== 0) {
        discrepanciesCount += 1;
      }
    }

    const operatingResult = totalSales - totalExpenses;
    const avgDailySales = entries.length > 0 ? totalSales / entries.length : 0;
    const upiShare = totalCollections > 0 ? (totalUpi / totalCollections) * 100 : 0;

    return {
      totalSales,
      totalCollections,
      totalExpenses,
      operatingResult,
      avgDailySales,
      totalCash,
      totalUpi,
      upiShare,
      entriesCount: entries.length,
      discrepanciesCount,
    };
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Subtab Navigation */}
      <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-4 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-botanical-800 text-cream-50 flex items-center justify-center shadow-soft">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-botanical-900">
                Stall Management
              </h2>
              <p className="text-xs text-stone-500">
                Physical counter daily revenue, payment collections, operating expenses, and audit history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchEntries}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl border border-botanical-200 bg-cream-50 text-botanical-800 hover:bg-cream-200/60 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('analytics')}
                className="px-3 py-1.5 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 font-semibold text-xs flex items-center gap-1.5 transition shadow-soft"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>View Analytics</span>
              </button>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-botanical-100 pt-3">
          {[
            { id: 'daily-entry', label: 'Daily Entry', icon: Edit3 },
            { id: 'entry-history', label: `Entry History (${entries.length})`, icon: History },
            { id: 'expense-summary', label: 'Expense Summary', icon: Receipt },
            { id: 'stall-summary', label: 'Stall Summary', icon: TrendingUp },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id as any);
                  setMessage(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-botanical-800 text-cream-50 shadow-soft'
                    : 'text-stone-600 hover:bg-cream-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-soft border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : message.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : message.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* ==================== 1. DAILY ENTRY FORM ==================== */}
      {activeSection === 'daily-entry' && (
        <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-7 shadow-elevated space-y-6">
          {/* Header Row: Date & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-botanical-100">
            <div>
              <span className="text-[11px] font-bold tracking-wider text-botanical-700 uppercase">
                Manual Counter Entry
              </span>
              <h3 className="font-serif font-bold text-xl text-botanical-900">
                {existingEntry ? `Edit Record for ${businessDate}` : `New Entry for ${businessDate}`}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-stone-600">Business Date (IST):</label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-botanical-200 bg-cream-50 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
              {existingEntry && (
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    existingEntry.status === 'finalized'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {existingEntry.status}
                </span>
              )}
            </div>
          </div>

          {/* Form Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: FLOWER SALES REVENUE */}
            <div className="bg-cream-50 border border-botanical-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-soft">
              <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
                <h4 className="font-serif font-bold text-sm text-botanical-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-botanical-600"></span>
                  Flower Sales Revenue
                </h4>
                <span className="text-[10px] text-stone-500 font-semibold">Total Category Revenue</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Jasmine (Mallepoovu) ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={jasmineRupees}
                    onChange={(e) => setJasmineRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Marigold (Banthipoovu) ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={marigoldRupees}
                    onChange={(e) => setMarigoldRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mixed Flowers & Petals ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={mixedRupees}
                    onChange={(e) => setMixedRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Other Flowers & Garlands ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otherFlowersRupees}
                    onChange={(e) => setOtherFlowersRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-botanical-100 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">Total Stall Sales:</span>
                <span className="font-serif font-bold text-base text-botanical-900">
                  ₹{formatINR(calculatedSalesRupees)}
                </span>
              </div>
            </div>

            {/* COLUMN 2: PAYMENT COLLECTIONS */}
            <div className="bg-cream-50 border border-botanical-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-soft">
              <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
                <h4 className="font-serif font-bold text-sm text-botanical-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-gold-500"></span>
                  Payment Collections
                </h4>
                <span className="text-[10px] text-stone-500 font-semibold">Payment Breakdown</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cash Collected ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={cashRupees}
                    onChange={(e) => setCashRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    UPI Collected (QR / Mobile) ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={upiRupees}
                    onChange={(e) => setUpiRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Other Collections ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otherColRupees}
                    onChange={(e) => setOtherColRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-botanical-100 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">Total Collections:</span>
                <span className="font-serif font-bold text-base text-botanical-900">
                  ₹{formatINR(calculatedCollectionsRupees)}
                </span>
              </div>

              {/* Real-time Reconciliation Indicator */}
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  !hasReconciliationMismatch
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {!hasReconciliationMismatch ? (
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Reconciled: Collections match sales perfectly.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Diff: {reconciliationDifferenceRupees > 0 ? '+' : ''}₹{formatINR(reconciliationDifferenceRupees)}
                      </span>
                    </div>
                    <p className="text-[11px] leading-tight">
                      Collections are ₹{Math.abs(reconciliationDifferenceRupees).toFixed(2)}{' '}
                      {reconciliationDifferenceRupees > 0 ? 'higher' : 'lower'} than recorded flower sales.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: STALL EXPENSES */}
            <div className="bg-cream-50 border border-botanical-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-soft">
              <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
                <h4 className="font-serif font-bold text-sm text-botanical-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Stall Expenses
                </h4>
                <span className="text-[10px] text-stone-500 font-semibold">Wholesale & Logistics</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Flower Purchase Cost ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={flowerCostRupees}
                    onChange={(e) => setFlowerCostRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Transport & Fuel ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={transportRupees}
                    onChange={(e) => setTransportRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Packaging Materials ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={packagingRupees}
                    onChange={(e) => setPackagingRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Other Operating Expenses ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otherExpRupees}
                    onChange={(e) => setOtherExpRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-100 text-xs font-semibold text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-botanical-100 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">Total Stall Expenses:</span>
                <span className="font-serif font-bold text-base text-rose-700">
                  ₹{formatINR(calculatedExpensesRupees)}
                </span>
              </div>
            </div>
          </div>

          {/* Preliminary Result Banner */}
          <div className="bg-botanical-900 text-cream-50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-botanical-300">
                Preliminary Operating Result
              </span>
              <div className="font-serif font-bold text-2xl text-cream-50 mt-0.5">
                {preliminaryOperatingResultRupees < 0 ? '-' : ''}₹{formatINR(Math.abs(preliminaryOperatingResultRupees))}
              </div>
              <p className="text-[10px] text-cream-200/70 mt-1 max-w-lg">
                Calculated as (Total Stall Sales - Total Recorded Expenses). Preliminary operating result only; does not factor in unsold inventory, spoilage, or unrecorded credit.
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold text-cream-200/80 block">Estimated Operating Margin</span>
              <span className="text-lg font-bold text-accent-gold-400">
                {calculatedSalesRupees > 0
                  ? `${((preliminaryOperatingResultRupees / calculatedSalesRupees) * 100).toFixed(1)}%`
                  : '0.0%'}
              </span>
            </div>
          </div>

          {/* Discrepancy Acknowledgement if Mismatch */}
          {hasReconciliationMismatch && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ack-reconciliation"
                  checked={reconciliationAcknowledged}
                  onChange={(e) => setReconciliationAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded text-botanical-700 border-amber-400 focus:ring-botanical-600 cursor-pointer"
                />
                <label htmlFor="ack-reconciliation" className="text-xs font-bold text-amber-900 cursor-pointer">
                  I explicitly acknowledge this sales-to-collections difference of ₹{formatINR(Math.abs(reconciliationDifferenceRupees))}
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                  Reason for discrepancy (required for audit):
                </label>
                <input
                  type="text"
                  placeholder="e.g., Change shortage, rounded down cash, customer credit settled next morning"
                  value={reconciliationReason}
                  onChange={(e) => setReconciliationReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-cream-50 text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            </div>
          )}

          {/* Notes & Correction Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Notes / Daily Observations
              </label>
              <textarea
                rows={2}
                placeholder="Weather, festival footfall, bulk puja inquiry..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>

            {existingEntry && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Correction Reason (Audit Trail)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Corrected marigold wholesale receipt from supplier"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-botanical-100">
            {existingEntry?.auditHistory && existingEntry.auditHistory.length > 0 ? (
              <button
                type="button"
                onClick={() => setViewAuditModal(existingEntry)}
                className="text-xs text-botanical-700 hover:text-botanical-900 font-semibold flex items-center gap-1.5 transition"
              >
                <History className="w-3.5 h-3.5" />
                <span>View Audit History ({existingEntry.auditHistory.length} revisions)</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitEntry('draft')}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-botanical-300 bg-cream-50 text-botanical-900 hover:bg-cream-200/60 font-semibold text-xs transition active:scale-95 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitEntry('finalized')}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-soft"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : 'Finalize Daily Entry'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. ENTRY HISTORY ==================== */}
      {activeSection === 'entry-history' && (
        <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-7 shadow-elevated space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-botanical-100">
            <div>
              <h3 className="font-serif font-bold text-lg text-botanical-900">
                Stall Daily Entries History
              </h3>
              <p className="text-xs text-stone-500">
                Showing all logged counter records, reconciliation status, and revision history
              </p>
            </div>
            <span className="text-xs font-semibold text-stone-600">
              Total Records: {entries.length}
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              No stall entries found. Use the &quot;Daily Entry&quot; tab to record your first day.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-botanical-200 text-stone-500 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Date (IST)</th>
                    <th className="py-3 px-3">Sales (INR)</th>
                    <th className="py-3 px-3">Collections</th>
                    <th className="py-3 px-3">Expenses</th>
                    <th className="py-3 px-3">Operating Result</th>
                    <th className="py-3 px-3">Reconciliation</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-botanical-100">
                  {entries.map((item) => {
                    const diff = item.reconciliationDifferencePaise || 0;
                    return (
                      <tr key={item.id} className="hover:bg-cream-50 transition">
                        <td className="py-3 px-3 font-semibold text-botanical-900">
                          {item.date}
                        </td>
                        <td className="py-3 px-3 font-bold text-botanical-900">
                          ₹{formatINR(item.totalSalesPaise / 100)}
                        </td>
                        <td className="py-3 px-3 text-stone-600">
                          <div>₹{formatINR(item.totalCollectionsPaise / 100)}</div>
                          <span className="text-[10px] text-stone-400">
                            Cash: ₹{formatINR((item.collections?.cashPaise || 0) / 100)} | UPI: ₹{formatINR((item.collections?.upiPaise || 0) / 100)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-rose-700 font-semibold">
                          ₹{formatINR(item.totalExpensesPaise / 100)}
                        </td>
                        <td className="py-3 px-3 font-bold">
                          <span
                            className={
                              item.preliminaryOperatingResultPaise >= 0
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }
                          >
                            ₹{formatINR(item.preliminaryOperatingResultPaise / 100)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {diff === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <Check className="w-3 h-3" /> Balanced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              {diff > 0 ? '+' : ''}₹{formatINR(diff / 100)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'finalized'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setBusinessDate(item.date);
                                setActiveSection('daily-entry');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-botanical-200 bg-cream-50 text-botanical-800 hover:bg-cream-200 font-semibold text-[11px] transition"
                            >
                              Edit
                            </button>
                            {item.auditHistory && item.auditHistory.length > 0 && (
                              <button
                                onClick={() => setViewAuditModal(item)}
                                className="p-1 rounded-lg border border-botanical-200 bg-cream-50 text-stone-600 hover:bg-cream-200 transition"
                                title="View Audit Trail"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== 3. EXPENSE SUMMARY ==================== */}
      {activeSection === 'expense-summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Flower Purchases</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                ₹{formatINR(expenseSummary.flowerPurchaseTotal)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Wholesale mandi procurement</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Transport & Fuel</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                ₹{formatINR(expenseSummary.transportTotal)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Local stall transit</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Packaging</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                ₹{formatINR(expenseSummary.packagingTotal)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Paper covers & bags</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Total Recorded</span>
              <div className="font-serif font-bold text-xl text-rose-700 mt-1">
                ₹{formatINR(expenseSummary.totalAll)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">All stall expenses</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. STALL SUMMARY ==================== */}
      {activeSection === 'stall-summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Cumulative Sales</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                ₹{formatINR(stallSummary.totalSales)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Across {stallSummary.entriesCount} logged days</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Avg Daily Sales</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                ₹{formatINR(stallSummary.avgDailySales)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Counter daily average</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">UPI Share</span>
              <div className="font-serif font-bold text-xl text-botanical-900 mt-1">
                {stallSummary.upiShare.toFixed(1)}%
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Digital payment ratio</span>
            </div>

            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Operating Result</span>
              <div
                className={`font-serif font-bold text-xl mt-1 ${
                  stallSummary.operatingResult >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                ₹{formatINR(stallSummary.operatingResult)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-0.5">Sales minus expenses</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {viewAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cream-100 border border-botanical-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-elevated max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-botanical-200">
              <div>
                <h4 className="font-serif font-bold text-base text-botanical-900">
                  Audit History: {viewAuditModal.date}
                </h4>
                <p className="text-[11px] text-stone-500">Immutable revision log for this daily stall record</p>
              </div>
              <button
                onClick={() => setViewAuditModal(null)}
                className="px-2.5 py-1 rounded-xl bg-cream-200 text-stone-700 text-xs font-semibold hover:bg-cream-300 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {viewAuditModal.auditHistory?.map((audit, i) => (
                <div key={i} className="p-3 rounded-xl bg-cream-50 border border-botanical-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-botanical-900 uppercase text-[10px] tracking-wider">
                      Action: {audit.action}
                    </span>
                    <span className="text-[10px] text-stone-500">{audit.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-stone-700">
                    <span className="font-semibold">Admin:</span> {audit.adminName}
                  </div>
                  {audit.reason && (
                    <div className="text-[11px] text-stone-600 bg-cream-100 p-2 rounded-lg">
                      <span className="font-semibold text-stone-800">Reason:</span> {audit.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
