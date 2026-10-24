'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Package,
  Truck,
  Calendar,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Filter,
  Receipt,
  Info,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Layers,
  ChevronDown,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Search,
  ExternalLink,
  Store,
} from 'lucide-react';
import {
  DatePreset,
  AnalyticsSummaryResponse,
  Expense,
  ExpenseCategory,
  FinancialMetric,
  FlowerPerformanceItem,
  AnalyticsView,
} from '@/types';
import { formatCurrencyPaise } from '@/lib/analytics';
import { formatHumanDate } from '@/lib/dateUtils';

interface AnalyticsDashboardProps {
  adminKey: string;
  initialView?: AnalyticsView;
  onNavigateToTab?: (tab: string) => void;
}

const PRESET_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; color: string }[] = [
  { id: 'flower_purchase', label: 'Flower Purchase', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'transport', label: 'Delivery & Transport', color: 'bg-blue-100 text-blue-900 border-blue-300' },
  { id: 'packaging', label: 'Packaging Materials', color: 'bg-purple-100 text-purple-900 border-purple-300' },
  { id: 'other', label: 'Other Operating Cost', color: 'bg-stone-100 text-stone-900 border-stone-300' },
];

export default function AnalyticsDashboard({ adminKey, initialView = 'combined', onNavigateToTab }: AnalyticsDashboardProps) {
  // Three Views: Combined (default), Stall, Online
  const [activeView, setActiveView] = useState<AnalyticsView>(initialView);

  // Filter state
  const [preset, setPreset] = useState<DatePreset>('last_7_days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Live data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);

  // Expenses management state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExpensesPanel, setShowExpensesPanel] = useState(false);
  const [expenseFormDate, setExpenseFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseFormCategory, setExpenseFormCategory] = useState<ExpenseCategory>('flower_purchase');
  const [expenseFormAmountRupees, setExpenseFormAmountRupees] = useState('');
  const [expenseFormDescription, setExpenseFormDescription] = useState('');
  const [expenseFormReference, setExpenseFormReference] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Flower performance table sorting/search
  const [flowerSearch, setFlowerSearch] = useState('');
  const [flowerSortBy, setFlowerSortBy] = useState<'revenue' | 'quantity' | 'profit'>('revenue');

  // Chart hover state
  const [activeTrendIndex, setActiveTrendIndex] = useState<number | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/admin/analytics?preset=${preset}&view=${activeView}`;
      if (preset === 'custom' && customFrom && customTo) {
        url += `&from=${customFrom}&to=${customTo}`;
      }

      const res = await fetch(url, {
        headers: {
          'x-admin-key': adminKey,
        },
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setSummary(data.summary);
      if (data.summary?.dateRange) {
        if (!customFrom) setCustomFrom(data.summary.dateRange.fromDate);
        if (!customTo) setCustomTo(data.summary.dateRange.toDate);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    setExpensesLoading(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        headers: { 'x-admin-key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (e) {
      console.warn('Failed to load expenses list', e);
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchExpenses();
  }, [preset, activeView, adminKey]);

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo) {
      setPreset('custom');
      setShowCustomPicker(false);
      fetchAnalytics();
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseSubmitting(true);
    setExpenseError(null);

    try {
      const amountRupees = parseFloat(expenseFormAmountRupees);
      if (isNaN(amountRupees) || amountRupees <= 0) {
        throw new Error('Please enter a valid amount greater than ₹0');
      }

      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          date: expenseFormDate,
          category: expenseFormCategory,
          amountRupees,
          description: expenseFormDescription,
          referenceReceipt: expenseFormReference.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save expense');
      }

      setShowExpenseModal(false);
      setExpenseFormAmountRupees('');
      setExpenseFormDescription('');
      setExpenseFormReference('');
      // Reload analytics and expenses
      await Promise.all([fetchAnalytics(), fetchExpenses()]);
    } catch (err: any) {
      setExpenseError(err.message || 'Error creating expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      if (res.ok) {
        await Promise.all([fetchAnalytics(), fetchExpenses()]);
      }
    } catch (err) {
      alert('Failed to delete expense');
    }
  };

  const handleExportCSV = () => {
    let url = `/api/admin/analytics/export?preset=${preset}&view=${activeView}`;
    if (preset === 'custom' && customFrom && customTo) {
      url += `&from=${customFrom}&to=${customTo}`;
    }
    fetch(url, {
      headers: { 'x-admin-key': adminKey },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `mahesh-flora-${activeView}-financial-report-${summary?.dateRange.fromDate || 'report'}-to-${summary?.dateRange.toDate || 'today'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert(err.message || 'Export failed'));
  };

  // Filtered flower performance
  const filteredFlowers = useMemo(() => {
    if (!summary?.flowerPerformance) return [];
    let list = [...summary.flowerPerformance];
    if (flowerSearch.trim()) {
      const q = flowerSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.teluguName && p.teluguName.includes(q)));
    }
    if (flowerSortBy === 'quantity') {
      list.sort((a, b) => b.quantitySold - a.quantitySold);
    } else if (flowerSortBy === 'profit') {
      list.sort((a, b) => b.profitContributionPaise - a.profitContributionPaise);
    } else {
      list.sort((a, b) => b.salesRevenuePaise - a.salesRevenuePaise);
    }
    return list;
  }, [summary?.flowerPerformance, flowerSearch, flowerSortBy]);

  // Loading Skeleton
  if (loading && !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-cream-200/70 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 bg-cream-100 rounded-2xl border border-botanical-100"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-cream-100 rounded-2xl"></div>
          <div className="h-72 bg-cream-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="font-serif font-bold text-lg text-rose-900">Failed to Load Analysis Dashboard</h3>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs inline-flex items-center gap-2 hover:bg-botanical-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const { kpis, dateRange, dailyTrend, monthlyBreakdown, paymentDistribution, orderStatusDistribution, subscriptions, festivals } = summary;

  return (
    <div className="space-y-6">
      
      {/* 1. FILTER & ACTION HEADER */}
      <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-botanical-100 text-botanical-900 uppercase tracking-wider">
                <Receipt className="w-3.5 h-3.5 text-botanical-700" />
                Financial Intelligence
              </span>
              <span className="text-[11px] font-semibold text-stone-500">
                IST Timezone • Asia/Kolkata
              </span>
            </div>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-botanical-900 mt-1">
              Sales, Profit & Operational Analysis
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Reporting Period: <strong className="text-botanical-900">{dateRange.label}</strong> ({formatHumanDate(dateRange.fromDate)} &ndash; {formatHumanDate(dateRange.toDate)})
              {' '}&bull; Comparing against: <span className="text-stone-500">{dateRange.previousLabel} ({formatHumanDate(dateRange.previousFromDate)} &ndash; {formatHumanDate(dateRange.previousToDate)})</span>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-3.5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs flex items-center gap-1.5 transition shadow-soft active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>

            <button
              onClick={() => setShowExpensesPanel(!showExpensesPanel)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                showExpensesPanel
                  ? 'border-botanical-600 bg-botanical-100 text-botanical-900'
                  : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/60 text-stone-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses ({expenses.length})</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 hover:bg-cream-200/60 text-stone-700 font-semibold text-xs flex items-center gap-1.5 transition"
              title="Export sanitized financial report as CSV"
            >
              <Download className="w-3.5 h-3.5 text-botanical-700" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 rounded-xl border border-botanical-200 bg-cream-50 hover:bg-cream-200/60 text-stone-700 transition"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-botanical-700' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Switcher: Combined Analysis (Default), Stall Analysis, Online Analysis */}
        <div className="pt-2 border-t border-botanical-200/60 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'combined', label: 'Combined Analysis', icon: Layers, desc: 'Stall + Online' },
            { id: 'stall', label: 'Stall Analysis', icon: Store, desc: 'Counter Only' },
            { id: 'online', label: 'Online Analysis', icon: ShoppingBag, desc: 'Website Only' },
          ].map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id as AnalyticsView)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition ${
                  isActive
                    ? 'bg-botanical-800 text-cream-50 shadow-soft'
                    : 'bg-cream-50 text-stone-600 hover:bg-cream-200/70 border border-botanical-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{v.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${isActive ? 'bg-cream-50/20 text-cream-100' : 'bg-cream-200 text-stone-500'}`}>
                  {v.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Presets Row */}
        <div className="pt-2 border-t border-botanical-200/40 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {PRESET_OPTIONS.map((item) => {
            const isSelected = preset === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'custom') {
                    setShowCustomPicker(true);
                  } else {
                    setPreset(item.id);
                    setShowCustomPicker(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-botanical-700 text-cream-50 shadow-soft font-semibold'
                    : 'bg-cream-50 text-stone-600 hover:bg-cream-200/70 border border-botanical-200/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Picker Dropdown */}
        {showCustomPicker && (
          <form onSubmit={handleApplyCustomRange} className="p-3 bg-white rounded-xl border border-botanical-200 space-y-3 mt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-botanical-900">
              <span>Select Custom Date Interval (Asia/Kolkata)</span>
              <button type="button" onClick={() => setShowCustomPicker(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">From Date</label>
                <input
                  type="date"
                  required
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-botanical-200 text-xs text-botanical-900 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">To Date</label>
                <input
                  type="date"
                  required
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-botanical-200 text-xs text-botanical-900 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCustomPicker(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs shadow-soft"
              >
                Apply Range
              </button>
            </div>
          </form>
        )}
      </div>

      {/* EXPENSE LOGGING DRAWER/PANEL (TOGGLEABLE) */}
      {showExpensesPanel && (
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-botanical-700" />
                <span>Operating Expenses Ledger</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Log wholesale flower purchases, transport, packaging, and operating costs to track true net profit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1.5 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs flex items-center gap-1 hover:bg-botanical-800 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
              <button onClick={() => setShowExpensesPanel(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-6 text-stone-500 text-xs space-y-2">
              <p>No expense records logged yet.</p>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="text-botanical-700 font-semibold hover:underline"
              >
                + Log your first wholesale flower purchase or transport receipt
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-botanical-200/80 text-stone-500 font-semibold">
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5">Category</th>
                    <th className="py-2 px-2.5">Description</th>
                    <th className="py-2 px-2.5">Reference / Receipt</th>
                    <th className="py-2 px-2.5 text-right">Amount</th>
                    <th className="py-2 px-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-botanical-100 font-mono text-[11px]">
                  {expenses.map((exp) => {
                    const catInfo = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                    return (
                      <tr key={exp.id} className="hover:bg-cream-50/70 transition">
                        <td className="py-2 px-2.5 font-sans whitespace-nowrap">{exp.date}</td>
                        <td className="py-2 px-2.5 font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catInfo?.color || 'bg-stone-100 text-stone-800'}`}>
                            {catInfo?.label || exp.category}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-sans text-botanical-900 max-w-xs truncate">{exp.description}</td>
                        <td className="py-2 px-2.5 text-stone-500">{exp.referenceReceipt || '—'}</td>
                        <td className="py-2 px-2.5 text-right font-bold text-rose-800">
                          {formatCurrencyPaise(exp.amountPaise)}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete record"
                            className="p-1 rounded text-stone-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* 2. 12 RESPONSIVE KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {activeView === 'stall' ? (
          <>
            <KPICard
              title="Total Stall Sales"
              metric={kpis.grossSalesPaise}
              icon={Store}
              iconColor="text-botanical-700 bg-botanical-100"
              tooltip="Total recorded daily counter flower sales"
            />
            <KPICard
              title="Total Collections"
              metric={kpis.netRevenuePaise}
              icon={CreditCard}
              iconColor="text-emerald-700 bg-emerald-100"
              tooltip="Cash + UPI + Other collections breakdown"
            />
            <KPICard
              title="Cash Collected"
              metric={summary.stallKPIs?.stallCashCollectionsPaise || kpis.netRevenuePaise}
              icon={Banknote}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Cash received at stall counter"
            />
            <KPICard
              title="UPI Collected"
              metric={summary.stallKPIs?.stallUpiCollectionsPaise || kpis.netRevenuePaise}
              icon={QrCode}
              iconColor="text-blue-700 bg-blue-100"
              tooltip="Digital QR and UPI collections at counter"
            />
            <KPICard
              title="Flower Purchases"
              metric={kpis.flowerPurchaseExpensesPaise}
              icon={Receipt}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Wholesale mandi procurement for stall"
            />
            <KPICard
              title="Delivery & Transport"
              metric={kpis.transportExpensesPaise}
              icon={Truck}
              iconColor="text-sky-700 bg-sky-100"
              tooltip="Stall transit and vehicle expenses"
            />
            <KPICard
              title="Packaging & Overhead"
              metric={kpis.otherExpensesPaise}
              icon={Package}
              iconColor="text-stone-700 bg-stone-200"
              tooltip="Packaging covers, bags, and counter overheads"
            />
            <KPICard
              title="Total Recorded Expenses"
              metric={kpis.totalExpensesPaise}
              icon={Receipt}
              iconColor="text-rose-700 bg-rose-100"
              tooltip="Sum of all recorded stall operating costs"
            />
            <KPICard
              title="Preliminary Operating Result"
              metric={kpis.netProfitPaise}
              icon={TrendingUp}
              iconColor={kpis.netProfitPaise.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Total Stall Sales minus Total Recorded Expenses"
              isProfit
            />
            <KPICard
              title="Preliminary Margin"
              metric={kpis.profitMarginPercent}
              icon={Percent}
              iconColor={kpis.profitMarginPercent.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Preliminary Operating Result as a % of Total Stall Sales"
              isProfit
            />
            <KPICard
              title="Recorded Days Count"
              metric={kpis.totalOrdersCount}
              icon={Calendar}
              iconColor="text-purple-700 bg-purple-100"
              tooltip="Number of business days recorded in period"
            />
            <KPICard
              title="Discrepancies"
              metric={summary.stallKPIs?.reconciliationDiscrepanciesCount || { value: 0, formatted: '0' }}
              icon={AlertCircle}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Days where collections differed from recorded sales"
            />
          </>
        ) : activeView === 'combined' ? (
          <>
            <KPICard
              title="Total Business Sales"
              metric={kpis.grossSalesPaise}
              icon={DollarSign}
              iconColor="text-botanical-700 bg-botanical-100"
              tooltip="Stall Sales + Online Gross Sales"
            />
            <KPICard
              title="Net Collected Revenue"
              metric={kpis.netRevenuePaise}
              icon={CreditCard}
              iconColor="text-emerald-700 bg-emerald-100"
              tooltip="Stall Collections + Online Verified Paid Revenue"
            />
            <KPICard
              title="Stall Sales"
              metric={summary.combinedKPIs?.stallSalesPaise || kpis.grossSalesPaise}
              icon={Store}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Counter sales from physical flower stall"
            />
            <KPICard
              title="Online Sales"
              metric={summary.combinedKPIs?.onlineSalesPaise || kpis.grossSalesPaise}
              icon={ShoppingBag}
              iconColor="text-blue-700 bg-blue-100"
              tooltip="Website orders and subscription sales"
            />
            <KPICard
              title="Total Business Expenses"
              metric={kpis.totalExpensesPaise}
              icon={Receipt}
              iconColor="text-rose-700 bg-rose-100"
              tooltip="Combined recorded stall and online operating expenses"
            />
            <KPICard
              title="Combined Operating Result"
              metric={kpis.netProfitPaise}
              icon={TrendingUp}
              iconColor={kpis.netProfitPaise.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Stall preliminary operating result + Online net recognized profit"
              isProfit
            />
            <KPICard
              title="Total Cash Collected"
              metric={summary.combinedKPIs?.totalCashCollectionsPaise || kpis.netRevenuePaise}
              icon={Banknote}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Stall Cash + Online COD Paid"
            />
            <KPICard
              title="Total UPI / Digital"
              metric={summary.combinedKPIs?.totalUpiCollectionsPaise || kpis.netRevenuePaise}
              icon={QrCode}
              iconColor="text-sky-700 bg-sky-100"
              tooltip="Stall UPI + Razorpay/WhatsApp digital collections"
            />
            <KPICard
              title="Online Orders Placed"
              metric={summary.combinedKPIs?.totalOnlineOrdersCount || kpis.totalOrdersCount}
              icon={ShoppingBag}
              iconColor="text-purple-700 bg-purple-100"
              tooltip="Total online customer orders placed in this period"
            />
            <KPICard
              title="Average Order Value"
              metric={kpis.aovPaise}
              icon={Layers}
              iconColor="text-indigo-700 bg-indigo-100"
              tooltip="Average transaction value across channels"
            />
            <KPICard
              title="Flower Purchases"
              metric={kpis.flowerPurchaseExpensesPaise}
              icon={Receipt}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Wholesale flower procurement expenses across channels"
            />
            <KPICard
              title="Combined Margin"
              metric={kpis.profitMarginPercent}
              icon={Percent}
              iconColor={kpis.profitMarginPercent.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Combined Operating Result as a percentage of Total Sales"
              isProfit
            />
          </>
        ) : (
          <>
            <KPICard
              title="Gross Sales"
              metric={kpis.grossSalesPaise}
              icon={DollarSign}
              iconColor="text-botanical-700 bg-botanical-100"
              tooltip="Total value of valid orders before refunds or cancellations"
            />
            <KPICard
              title="Net Collected Revenue"
              metric={kpis.netRevenuePaise}
              icon={CreditCard}
              iconColor="text-emerald-700 bg-emerald-100"
              tooltip="Successfully verified collected payments (COD delivered, UPI, Razorpay) minus refunds"
            />
            <KPICard
              title="Total Orders"
              metric={kpis.totalOrdersCount}
              icon={ShoppingBag}
              iconColor="text-blue-700 bg-blue-100"
              tooltip="Total count of customer orders placed within this reporting period"
            />
            <KPICard
              title="Completed Orders"
              metric={kpis.completedOrdersCount}
              icon={CheckCircle2}
              iconColor="text-emerald-700 bg-emerald-100"
              tooltip="Orders successfully fulfilled and marked as delivered to doorstep"
            />
            <KPICard
              title="Pending / In Transit"
              metric={kpis.pendingOrdersCount}
              icon={Truck}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Orders currently in packing, confirmed, or out for dawn delivery"
            />
            <KPICard
              title="Cancelled Orders"
              metric={kpis.cancelledOrdersCount}
              icon={XCircle}
              iconColor="text-rose-700 bg-rose-100"
              tooltip="Orders cancelled before fulfillment; excluded from net sales"
            />
            <KPICard
              title="Average Order Value"
              metric={kpis.aovPaise}
              icon={Layers}
              iconColor="text-purple-700 bg-purple-100"
              tooltip="Gross Sales divided by valid non-cancelled orders"
            />
            <KPICard
              title="Flower Purchase Costs"
              metric={kpis.flowerPurchaseExpensesPaise}
              icon={Receipt}
              iconColor="text-amber-700 bg-amber-100"
              tooltip="Recorded wholesale mandi flower purchase expenses"
            />
            <KPICard
              title="Delivery & Transport"
              metric={kpis.transportExpensesPaise}
              icon={Truck}
              iconColor="text-sky-700 bg-sky-100"
              tooltip="Recorded driver, vehicle, and fuel expenses for morning deliveries"
            />
            <KPICard
              title="Packaging & Other Costs"
              metric={kpis.otherExpensesPaise}
              icon={Package}
              iconColor="text-stone-700 bg-stone-200"
              tooltip="Recorded banana leaf, eco-packaging boxes, and operating overheads"
            />
            <KPICard
              title="Net Profit / Loss"
              metric={kpis.netProfitPaise}
              icon={TrendingUp}
              iconColor={kpis.netProfitPaise.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Net Collected Revenue minus all recorded operating expenses"
              isProfit
            />
            <KPICard
              title="Profit Margin"
              metric={kpis.profitMarginPercent}
              icon={Percent}
              iconColor={kpis.profitMarginPercent.value >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}
              tooltip="Net Profit as a percentage of Net Collected Revenue"
              isProfit
            />
          </>
        )}
      </div>

      {/* CHANNEL CONTRIBUTION & CATEGORY BREAKDOWN (COMBINED VIEW) */}
      {activeView === 'combined' && summary.channelContribution && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Contribution Card */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-botanical-700" />
                <span>Sales Channel Contribution</span>
              </h3>
              <span className="text-xs font-semibold text-stone-500">Stall vs Online</span>
            </div>

            <div className="space-y-3">
              {/* Contribution Progress Bar */}
              <div className="w-full h-4 rounded-full bg-cream-200 overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${summary.channelContribution.stallPercentage}%` }}
                  className="bg-amber-600 h-full transition-all duration-500"
                  title={`Stall: ${summary.channelContribution.stallPercentage}%`}
                ></div>
                <div
                  style={{ width: `${summary.channelContribution.onlinePercentage}%` }}
                  className="bg-botanical-700 h-full transition-all duration-500"
                  title={`Online: ${summary.channelContribution.onlinePercentage}%`}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                    <span>Physical Flower Stall</span>
                  </div>
                  <div className="font-serif font-bold text-lg text-amber-950 mt-1">
                    {formatCurrencyPaise(summary.channelContribution.stallSalesPaise)}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                    {summary.channelContribution.stallPercentage}% of total sales
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-botanical-50/80 border border-botanical-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-botanical-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-botanical-700"></span>
                    <span>Website & Subscriptions</span>
                  </div>
                  <div className="font-serif font-bold text-lg text-botanical-950 mt-1">
                    {formatCurrencyPaise(summary.channelContribution.onlineSalesPaise)}
                  </div>
                  <div className="text-[11px] font-semibold text-botanical-700 mt-0.5">
                    {summary.channelContribution.onlinePercentage}% of total sales
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Flower Category Breakdown */}
          {summary.categoryBreakdown && (
            <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-5 shadow-soft space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
                <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-botanical-700" />
                  <span>Flower Category Sales (Consolidated)</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500">Across Both Channels</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-botanical-200/60 text-stone-500 text-[11px] font-semibold">
                      <th className="py-2 px-2">Category</th>
                      <th className="py-2 px-2 text-right">Stall</th>
                      <th className="py-2 px-2 text-right">Online</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-botanical-100">
                    {summary.categoryBreakdown.map((cat) => (
                      <tr key={cat.category} className="hover:bg-cream-50/60">
                        <td className="py-2 px-2 font-semibold text-botanical-900">{cat.label}</td>
                        <td className="py-2 px-2 text-right font-mono text-stone-600">
                          {formatCurrencyPaise(cat.stallSalesPaise, false)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-stone-600">
                          {formatCurrencyPaise(cat.onlineSalesPaise, false)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-botanical-900">
                          {formatCurrencyPaise(cat.totalSalesPaise, false)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-botanical-700">
                          {cat.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. INTERACTIVE CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Daily Sales & Revenue Trend */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-botanical-700" />
                <span>Daily Sales & Revenue Trend</span>
              </h3>
              <p className="text-xs text-stone-500">Gross sales vs verified collected revenue by day</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-botanical-700 inline-block"></span>
                <span>Gross</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                <span>Net Collected</span>
              </span>
            </div>
          </div>

          <div className="h-60 pt-2">
            <InteractiveDualLineChart data={dailyTrend} onHoverPoint={setActiveTrendIndex} />
          </div>

          {activeTrendIndex !== null && dailyTrend[activeTrendIndex] && (
            <div className="p-2.5 rounded-xl bg-white/90 border border-botanical-200 text-xs flex items-center justify-between">
              <span className="font-semibold text-botanical-900">{dailyTrend[activeTrendIndex].label}</span>
              <div className="flex items-center gap-4">
                <span>Gross: <strong>{formatCurrencyPaise(dailyTrend[activeTrendIndex].grossSalesPaise)}</strong></span>
                <span className="text-emerald-700">Net: <strong>{formatCurrencyPaise(dailyTrend[activeTrendIndex].netRevenuePaise)}</strong></span>
                <span className="text-stone-500">Orders: <strong>{dailyTrend[activeTrendIndex].ordersCount}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Revenue vs Operating Expenses */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-700" />
                <span>Revenue vs Operating Expenses</span>
              </h3>
              <p className="text-xs text-stone-500">Daily net revenue compared against incurred operating costs</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span>
                <span>Revenue</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-600 inline-block"></span>
                <span>Expenses</span>
              </span>
            </div>
          </div>

          <div className="h-60 pt-2">
            <InteractiveBarComparisonChart data={dailyTrend} />
          </div>
        </div>

        {/* Chart 3: Net Profit & Loss Trend with Zero Baseline */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <span>Net Profit & Loss Trend</span>
              </h3>
              <p className="text-xs text-stone-500">Net cash generation after all wholesale & delivery deductions</p>
            </div>
            <span className="text-[11px] font-semibold text-stone-500">
              Zero Baseline
            </span>
          </div>

          <div className="h-60 pt-2">
            <NetProfitTrendChart data={dailyTrend} />
          </div>
        </div>

        {/* Chart 4: Monthly Revenue Breakdown */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-700" />
                <span>Monthly Revenue Breakdown ({dateRange.toDate.split('-')[0]})</span>
              </h3>
              <p className="text-xs text-stone-500">Annual trajectory tracking seasonal festival demand</p>
            </div>
          </div>

          <div className="h-60 pt-2">
            <MonthlyBreakdownBarChart data={monthlyBreakdown} />
          </div>
        </div>

      </div>

      {/* 4. PAYMENT METHODS & ORDER STATUS BREAKDOWNS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Payment Methods */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-botanical-700" />
            <span>Payment Method Distribution</span>
          </h3>
          <p className="text-xs text-stone-500">Breakdown of verified paid transactions</p>

          <div className="space-y-3 pt-1">
            {paymentDistribution.map((item) => (
              <div key={item.method} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-botanical-900 flex items-center gap-1.5">
                    {item.method === 'cod' && <Banknote className="w-3.5 h-3.5 text-amber-700" />}
                    {item.method === 'whatsapp_upi' && <QrCode className="w-3.5 h-3.5 text-emerald-700" />}
                    {item.method === 'razorpay' && <CreditCard className="w-3.5 h-3.5 text-blue-700" />}
                    <span>{item.label}</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-botanical-900">{formatCurrencyPaise(item.amountPaise)}</span>
                    <span className="text-stone-500 text-[11px] ml-1.5">({item.count} orders &bull; {item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-cream-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.method === 'cod'
                        ? 'bg-amber-600'
                        : item.method === 'whatsapp_upi'
                        ? 'bg-emerald-600'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
          <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-botanical-700" />
            <span>Order Fulfillment Distribution</span>
          </h3>
          <p className="text-xs text-stone-500">Pipeline progression of orders placed in reporting period</p>

          <div className="space-y-3 pt-1">
            {orderStatusDistribution.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-stone-700">{item.label}</span>
                  <div className="text-right">
                    <span className="font-bold text-botanical-900">{item.count}</span>
                    <span className="text-stone-500 text-[11px] ml-1.5">
                      ({formatCurrencyPaise(item.amountPaise)} &bull; {item.percentage}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-cream-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.status === 'delivered'
                        ? 'bg-emerald-600'
                        : item.status === 'cancelled'
                        ? 'bg-rose-500'
                        : 'bg-botanical-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 5. FLOWER PRODUCT PERFORMANCE SECTION */}
      <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-botanical-200/60">
          <div>
            <h3 className="font-serif font-bold text-lg text-botanical-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-botanical-700" />
              <span>Flower Variety Performance Ranking</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Sales, volume, estimated purchase cost, and profit contribution for each flower variety
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={flowerSearch}
                onChange={(e) => setFlowerSearch(e.target.value)}
                placeholder="Search flower..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-botanical-200 bg-white text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600 w-36 sm:w-48"
              />
            </div>

            <select
              value={flowerSortBy}
              onChange={(e) => setFlowerSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-botanical-200 bg-white text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600 font-medium"
            >
              <option value="revenue">Sort by Sales Revenue</option>
              <option value="quantity">Sort by Volume Sold</option>
              <option value="profit">Sort by Profit Contribution</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-botanical-200 text-stone-500 font-semibold">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Flower Variety</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                <th className="py-2.5 px-3 text-right">Wholesale Cost</th>
                <th className="py-2.5 px-3 text-right">Profit Contribution</th>
                <th className="py-2.5 px-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-botanical-100 text-botanical-900">
              {filteredFlowers.map((flower, idx) => (
                <tr key={flower.productId} className="hover:bg-cream-50/70 transition">
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                        : idx === 1
                        ? 'bg-stone-200 text-stone-800'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-900'
                        : 'text-stone-500'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-botanical-900">{flower.name}</div>
                    {flower.teluguName && (
                      <div className="text-[10px] text-stone-500 font-serif">{flower.teluguName}</div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-botanical-100 text-botanical-800">
                      {flower.category || 'Daily Puja'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">
                    {flower.quantitySold}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-600 font-mono">
                    {flower.ordersCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-botanical-900">
                    {formatCurrencyPaise(flower.salesRevenuePaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-600">
                    {formatCurrencyPaise(flower.estimatedCostPaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                    {formatCurrencyPaise(flower.profitContributionPaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[11px] font-semibold text-emerald-700">
                    {flower.marginPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. ORDERS, STALL ENTRIES, SUBSCRIPTIONS & FESTIVALS SECTION */}
      {activeView === 'stall' ? (
        <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
            <div>
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-botanical-700" />
                <span>Daily Stall Entries in Selected Period</span>
              </h3>
              <p className="text-xs text-stone-500">
                Counter sales, collections breakdown, wholesale expenses, and reconciliation audit
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('stall')}
                className="px-3 py-1.5 rounded-xl bg-botanical-700 text-cream-50 hover:bg-botanical-800 font-semibold text-xs flex items-center gap-1.5 transition shadow-soft"
              >
                <span>Open Stall Management</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {!summary.stallEntries || summary.stallEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-500">
              No stall records found for {dateRange.label}. Click &quot;Open Stall Management&quot; to log daily counter entries.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-botanical-200/60 text-stone-500 text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Date (IST)</th>
                    <th className="py-2.5 px-3 text-right">Sales</th>
                    <th className="py-2.5 px-3 text-right">Cash</th>
                    <th className="py-2.5 px-3 text-right">UPI</th>
                    <th className="py-2.5 px-3 text-right">Total Collections</th>
                    <th className="py-2.5 px-3 text-right">Expenses</th>
                    <th className="py-2.5 px-3 text-right">Operating Result</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-botanical-100">
                  {summary.stallEntries.map((s) => (
                    <tr key={s.id} className="hover:bg-cream-50/60">
                      <td className="py-2.5 px-3 font-semibold text-botanical-900">{s.date}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-botanical-900">
                        {formatCurrencyPaise(s.totalSalesPaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                        {formatCurrencyPaise(s.collections?.cashPaise || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                        {formatCurrencyPaise(s.collections?.upiPaise || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-botanical-900">
                        {formatCurrencyPaise(s.totalCollectionsPaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                        {formatCurrencyPaise(s.totalExpensesPaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={s.preliminaryOperatingResultPaise >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatCurrencyPaise(s.preliminaryOperatingResultPaise)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          s.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeView === 'combined' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Stall Entries Summary */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-botanical-700" />
                <span>Stall Daily Records ({summary.stallEntries?.length || 0})</span>
              </h3>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('stall')}
                  className="text-[11px] font-semibold text-botanical-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Stall Manager</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {!summary.stallEntries || summary.stallEntries.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-500">
                No stall records logged for {dateRange.label}.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {summary.stallEntries.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl bg-white/80 border border-botanical-100 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-botanical-900">{s.date}</div>
                      <div className="text-[10px] text-stone-500">
                        Cash: {formatCurrencyPaise(s.collections?.cashPaise || 0, false)} | UPI: {formatCurrencyPaise(s.collections?.upiPaise || 0, false)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-botanical-900 font-mono">{formatCurrencyPaise(s.totalSalesPaise)}</div>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                        s.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Online Orders */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-botanical-700" />
                <span>Recent Online Orders ({summary.recentOrders.length})</span>
              </h3>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('orders')}
                  className="text-[11px] font-semibold text-botanical-700 hover:underline flex items-center gap-0.5"
                >
                  <span>All Orders</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {summary.recentOrders.map((ord) => (
                <div key={ord.id} className="p-2.5 rounded-xl bg-white/80 border border-botanical-100 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-botanical-900">{ord.id}</div>
                    <div className="text-[10px] text-stone-500">{ord.customerName} &bull; {ord.paymentMethod.toUpperCase()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-botanical-900 font-mono">{formatCurrencyPaise(ord.totalPaise)}</div>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                      ord.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ord.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Subscriptions Card */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-botanical-700" />
                <span>Weekly Subscriptions</span>
              </h3>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('subscriptions')}
                  className="text-[11px] font-semibold text-botanical-700 hover:underline flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Active Recurring Subscribers</span>
                <strong className="text-emerald-800">{subscriptions.activeCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">New Joined in Period</span>
                <strong className="text-botanical-900">{subscriptions.newInPeriodCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Paused / Temporary Hold</span>
                <strong className="text-amber-800">{subscriptions.pausedCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Cancelled</span>
                <strong className="text-rose-800">{subscriptions.cancelledCount}</strong>
              </div>
              <div className="flex justify-between py-1.5 pt-2">
                <span className="font-semibold text-botanical-900">Estimated Weekly Revenue</span>
                <strong className="text-emerald-800 font-mono text-sm">{formatCurrencyPaise(subscriptions.estimatedWeeklyRevenuePaise)}</strong>
              </div>
            </div>
          </div>

          {/* Festival Bookings Card */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span>Festival Pre-Bookings</span>
              </h3>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('festivals')}
                  className="text-[11px] font-semibold text-purple-700 hover:underline flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Advance Bookings Placed</span>
                <strong className="text-botanical-900">{festivals.totalBookingsCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Pre-Paid Bookings</span>
                <strong className="text-emerald-800">{festivals.paidBookingsCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Payment Pending</span>
                <strong className="text-amber-800">{festivals.pendingPaymentCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-botanical-100">
                <span className="text-stone-600">Total Festival Booked Value</span>
                <strong className="text-botanical-900 font-mono">{formatCurrencyPaise(festivals.totalRevenuePaise)}</strong>
              </div>
              <div className="flex justify-between py-1.5 pt-2">
                <span className="font-semibold text-botanical-900">Collected Advance Cash</span>
                <strong className="text-emerald-800 font-mono text-sm">{formatCurrencyPaise(festivals.collectedRevenuePaise)}</strong>
              </div>
            </div>
          </div>

          {/* Recent Orders in Period */}
          <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200/60">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-botanical-700" />
                <span>Recent Orders ({summary.recentOrders.length})</span>
              </h3>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('orders')}
                  className="text-[11px] font-semibold text-botanical-700 hover:underline flex items-center gap-0.5"
                >
                  <span>All Orders</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {summary.recentOrders.map((ord) => (
                <div key={ord.id} className="p-2 rounded-xl bg-white/80 border border-botanical-100 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-botanical-900">{ord.id}</div>
                    <div className="text-[10px] text-stone-500">{ord.customerName} &bull; {ord.paymentMethod.toUpperCase()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-botanical-900 font-mono">{formatCurrencyPaise(ord.totalPaise)}</div>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                      ord.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ord.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOG NEW OPERATING EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-cream-50 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-botanical-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-botanical-200">
              <h3 className="font-serif font-bold text-lg text-botanical-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-botanical-700" />
                <span>Log Operating Expense</span>
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={expenseFormDate}
                  onChange={(e) => setExpenseFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Cost Category *</label>
                <select
                  value={expenseFormCategory}
                  onChange={(e) => setExpenseFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600 font-medium"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Amount in Rupees (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 1500"
                    value={expenseFormAmountRupees}
                    onChange={(e) => setExpenseFormAmountRupees(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-botanical-200 bg-white text-botanical-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description / Mandi Details *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Gudimalkapur wholesale jasmine 10kg batch"
                  value={expenseFormDescription}
                  onChange={(e) => setExpenseFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Receipt / Invoice Ref (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Mandi-Bill-#892 / UPI-Ref-49182"
                  value={expenseFormReference}
                  onChange={(e) => setExpenseFormReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-white text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold shadow-soft transition disabled:opacity-50"
                >
                  {expenseSubmitting ? 'Recording...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

interface KPICardProps {
  title: string;
  metric: FinancialMetric;
  icon: any;
  iconColor: string;
  tooltip?: string;
  isProfit?: boolean;
}

function KPICard({ title, metric, icon: Icon, iconColor, tooltip, isProfit }: KPICardProps) {
  const isPositiveValue = metric.value >= 0;
  const isDiffPositive = (metric.diff || 0) >= 0;

  return (
    <div className="bg-cream-100/90 border border-botanical-200 rounded-2xl p-4 shadow-soft hover:shadow-md transition flex flex-col justify-between relative group">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-stone-600 truncate mr-1" title={title}>
            {title}
          </span>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <div className={`font-serif font-bold text-xl sm:text-2xl ${
            isProfit
              ? isPositiveValue
                ? 'text-emerald-800'
                : 'text-rose-800'
              : 'text-botanical-900'
          }`}>
            {metric.formatted}
          </div>
          {metric.isEstimate && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Est
            </span>
          )}
        </div>
      </div>

      <div className="pt-2 mt-2 border-t border-botanical-200/60 flex items-center justify-between text-[10px]">
        {metric.percentChangeFormatted ? (
          <div className="flex items-center gap-1">
            <span className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[10px] ${
              metric.trend === 'up'
                ? metric.isPositiveGood
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
                : metric.trend === 'down'
                ? metric.isPositiveGood
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-stone-600'
            }`}>
              {metric.trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
              {metric.trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {metric.trend === 'neutral' && <Minus className="w-3 h-3 mr-0.5" />}
              {metric.percentChangeFormatted}
            </span>
            <span className="text-stone-500 truncate">vs prior period</span>
          </div>
        ) : (
          <span className="text-stone-400">Baseline period</span>
        )}

        {tooltip && (
          <div className="relative group/tip cursor-help ml-1">
            <Info className="w-3.5 h-3.5 text-stone-400 hover:text-stone-600" />
            <div className="absolute bottom-full right-0 mb-1 hidden group-hover/tip:block z-30 w-44 p-2 bg-stone-900 text-cream-50 text-[10px] rounded-lg shadow-xl leading-tight">
              {tooltip}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== INTERACTIVE NATIVE SVG CHARTS ====================

function InteractiveDualLineChart({
  data,
  onHoverPoint,
}: {
  data: Array<{ date: string; label: string; grossSalesPaise: number; netRevenuePaise: number }>;
  onHoverPoint: (idx: number | null) => void;
}) {
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-stone-400">No transactions in selected range</div>;
  }

  const maxVal = Math.max(
    10000,
    ...data.map((d) => Math.max(d.grossSalesPaise, d.netRevenuePaise))
  );

  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const width = 500;
  const height = 220;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxVal) * chartHeight;
  };

  const grossPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.grossSalesPaise)}`).join(' ');
  const netPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.netRevenuePaise)}`).join(' ');

  // Gradient area for Net Revenue
  const netAreaPath = data.length > 1
    ? `${netPath} L ${getX(data.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible select-none"
      onMouseLeave={() => onHoverPoint(null)}
    >
      <defs>
        <linearGradient id="netRevenueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Grid horizontal lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
        const y = paddingTop + chartHeight * (1 - pct);
        const rupeeVal = Math.round((maxVal * pct) / 100);
        return (
          <g key={idx}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-stone-400 font-mono">
              ₹{rupeeVal >= 1000 ? `${(rupeeVal / 1000).toFixed(0)}k` : rupeeVal}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      {netAreaPath && <path d={netAreaPath} fill="url(#netRevenueGrad)" />}

      {/* Lines */}
      <path d={grossPath} fill="none" stroke="#2a4536" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={netPath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points & Hover detectors */}
      {data.map((d, i) => {
        const cx = getX(i);
        const cyGross = getY(d.grossSalesPaise);
        const cyNet = getY(d.netRevenuePaise);
        return (
          <g
            key={i}
            onMouseEnter={() => onHoverPoint(i)}
            className="cursor-pointer group"
          >
            <circle cx={cx} cy={cyGross} r="3" fill="#2a4536" className="transition-transform group-hover:scale-150" />
            <circle cx={cx} cy={cyNet} r="3" fill="#059669" className="transition-transform group-hover:scale-150" />
            {/* Label along X axis */}
            {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
              <text x={cx} y={height - 6} textAnchor="middle" className="text-[9px] fill-stone-500">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function InteractiveBarComparisonChart({
  data,
}: {
  data: Array<{ date: string; label: string; netRevenuePaise: number; expensesPaise: number }>;
}) {
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-stone-400">No data available</div>;
  }

  const maxVal = Math.max(10000, ...data.map((d) => Math.max(d.netRevenuePaise, d.expensesPaise)));
  const width = 500;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barGroupWidth = chartWidth / data.length;
  const barWidth = Math.max(3, Math.min(14, (barGroupWidth - 4) / 2));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct, idx) => {
        const y = paddingTop + chartHeight * (1 - pct);
        const rupeeVal = Math.round((maxVal * pct) / 100);
        return (
          <g key={idx}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-stone-400 font-mono">
              ₹{rupeeVal >= 1000 ? `${(rupeeVal / 1000).toFixed(0)}k` : rupeeVal}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const groupCenterX = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
        const revHeight = (d.netRevenuePaise / maxVal) * chartHeight;
        const expHeight = (d.expensesPaise / maxVal) * chartHeight;

        const revX = groupCenterX - barWidth - 1;
        const expX = groupCenterX + 1;

        return (
          <g key={i} className="group">
            <title>{`${d.label}\nRevenue: ₹${(d.netRevenuePaise / 100).toFixed(2)}\nExpenses: ₹${(d.expensesPaise / 100).toFixed(2)}`}</title>
            {/* Revenue bar */}
            <rect
              x={revX}
              y={paddingTop + chartHeight - revHeight}
              width={barWidth}
              height={Math.max(1, revHeight)}
              fill="#059669"
              rx="2"
              className="hover:opacity-80 transition"
            />
            {/* Expense bar */}
            <rect
              x={expX}
              y={paddingTop + chartHeight - expHeight}
              width={barWidth}
              height={Math.max(1, expHeight)}
              fill="#d97706"
              rx="2"
              className="hover:opacity-80 transition"
            />
            {/* Date label */}
            {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
              <text x={groupCenterX} y={height - 6} textAnchor="middle" className="text-[9px] fill-stone-500">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function NetProfitTrendChart({
  data,
}: {
  data: Array<{ date: string; label: string; netProfitPaise: number }>;
}) {
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-stone-400">No data available</div>;
  }

  const maxAbs = Math.max(5000, ...data.map((d) => Math.abs(d.netProfitPaise)));
  const width = 500;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const zeroY = paddingTop + chartHeight / 2;

  const getX = (idx: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    // Top is +maxAbs, bottom is -maxAbs, middle is 0
    return zeroY - (val / maxAbs) * (chartHeight / 2);
  };

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.netProfitPaise)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      {/* Zero baseline */}
      <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#9ca3af" strokeWidth="1.5" />
      <text x={paddingLeft - 6} y={zeroY + 3} textAnchor="end" className="text-[9px] fill-stone-500 font-mono font-bold">
        ₹0
      </text>

      {/* Top and Bottom reference lines */}
      <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#e5e7eb" strokeDasharray="3 3" />
      <text x={paddingLeft - 6} y={paddingTop + 3} textAnchor="end" className="text-[9px] fill-emerald-600 font-mono">
        +₹{Math.round(maxAbs / 100)}
      </text>

      <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#e5e7eb" strokeDasharray="3 3" />
      <text x={paddingLeft - 6} y={paddingTop + chartHeight + 3} textAnchor="end" className="text-[9px] fill-rose-600 font-mono">
        -₹{Math.round(maxAbs / 100)}
      </text>

      {/* Line */}
      <path d={linePath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {data.map((d, i) => {
        const cx = getX(i);
        const cy = getY(d.netProfitPaise);
        const isPos = d.netProfitPaise >= 0;
        return (
          <g key={i} className="group">
            <title>{`${d.label}\nNet Profit: ${formatCurrencyPaise(d.netProfitPaise)}`}</title>
            <circle cx={cx} cy={cy} r="3" fill={isPos ? '#059669' : '#e11d48'} />
            {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
              <text x={cx} y={height - 6} textAnchor="middle" className="text-[9px] fill-stone-500">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyBreakdownBarChart({
  data,
}: {
  data: Array<{ monthKey: string; label: string; netRevenuePaise: number }>;
}) {
  const maxVal = Math.max(10000, ...data.map((d) => d.netRevenuePaise));
  const width = 500;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = chartWidth / data.length - 6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct, idx) => {
        const y = paddingTop + chartHeight * (1 - pct);
        const rupeeVal = Math.round((maxVal * pct) / 100);
        return (
          <g key={idx}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-stone-400 font-mono">
              ₹{rupeeVal >= 1000 ? `${(rupeeVal / 1000).toFixed(0)}k` : rupeeVal}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barHeight = (d.netRevenuePaise / maxVal) * chartHeight;
        const x = paddingLeft + i * (barWidth + 6) + 3;
        const y = paddingTop + chartHeight - barHeight;

        return (
          <g key={d.monthKey} className="group cursor-pointer">
            <title>{`${d.label}: ₹${(d.netRevenuePaise / 100).toFixed(2)}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(2, barHeight)}
              fill="#2a4536"
              rx="3"
              className="hover:fill-botanical-600 transition"
            />
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="text-[9px] fill-stone-500">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
