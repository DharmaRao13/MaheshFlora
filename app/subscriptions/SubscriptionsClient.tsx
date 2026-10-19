'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Phone,
  Search,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Package,
  CalendarX2,
  ShieldCheck
} from 'lucide-react';
import { Subscription } from '@/types';
import { formatINR } from '@/lib/config';

interface Props {
  initialSubscriptions: Subscription[];
}

export default function SubscriptionsClient({ initialSubscriptions }: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);
  const [searchPhone, setSearchPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Generate the next 14 calendar dates
  const generateUpcomingDates = () => {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const upcomingDates = generateUpcomingDates();

  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;

    setActionLoading('search');
    try {
      const res = await fetch(`/api/subscriptions?phone=${encodeURIComponent(searchPhone.trim())}`);
      const data = await res.json();
      if (data.subscriptions) {
        setSubscriptions(data.subscriptions);
      }
      setSearched(true);
    } catch {
      // error
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (subId: string, action: 'pause' | 'resume' | 'cancel' | 'skip', skipDate?: string) => {
    setActionLoading(`${subId}-${action}-${skipDate || ''}`);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, skipDate }),
      });

      const data = await res.json();
      if (data.subscription) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === subId ? data.subscription : s))
        );
        if (action === 'pause') {
          setFeedbackMessage('Subscription paused successfully. Future deliveries are held.');
        } else if (action === 'resume') {
          setFeedbackMessage('Subscription resumed! Deliveries will continue as scheduled.');
        } else if (action === 'skip') {
          setFeedbackMessage(`Date ${skipDate} has been skipped and excluded from your deliveries.`);
        } else if (action === 'cancel') {
          setFeedbackMessage('Subscription has been cancelled.');
        }
      }
    } catch (e: any) {
      setFeedbackMessage(`Failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-botanical-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-petal-100 text-petal-700 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Mandir Puja Service</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-botanical-900">
            Weekly Puja Flower Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-xl">
            Manage your scheduled puja deliveries, pause during vacations, or skip specific dates with ease.
          </p>
        </div>

        <Link
          href="/checkout"
          className="px-5 py-3 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto shadow-soft transition active:scale-95"
        >
          <span>Start a New Subscription</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Look Up by Phone Card */}
      <div className="bg-cream-100/80 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft space-y-3">
        <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-botanical-700" />
          <span>Look Up Your Existing Subscription</span>
        </h3>
        <p className="text-xs text-stone-600">
          Enter your registered 10-digit mobile number to view and manage your scheduled deliveries.
        </p>

        <form onSubmit={handlePhoneSearch} className="flex flex-col sm:flex-row gap-2 max-w-md">
          <div className="relative flex-1">
            <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
          </div>
          <button
            type="submit"
            disabled={actionLoading === 'search'}
            className="px-5 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs sm:text-sm transition active:scale-95 disabled:opacity-50"
          >
            {actionLoading === 'search' ? 'Searching...' : 'Find Subscription'}
          </button>
        </form>
      </div>

      {/* Subscriptions List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-xl text-botanical-900">
            {searched ? `Found ${subscriptions.length} Subscriptions` : 'Active Subscriptions'}
          </h2>
          {searched && (
            <button
              onClick={() => {
                setSearched(false);
                setSearchPhone('');
                setSubscriptions(initialSubscriptions);
              }}
              className="text-xs text-botanical-700 hover:underline"
            >
              Reset view
            </button>
          )}
        </div>

        {subscriptions.length === 0 ? (
          <div className="bg-cream-100/50 border border-botanical-200 rounded-3xl p-10 text-center max-w-md mx-auto space-y-3">
            <Calendar className="w-10 h-10 text-stone-400 mx-auto" />
            <h4 className="font-serif font-bold text-base text-botanical-900">
              No Subscriptions Found
            </h4>
            <p className="text-xs text-stone-600">
              {searched
                ? 'No subscriptions matching that phone number were found.'
                : 'There are currently no active subscriptions.'}
            </p>
            <Link
              href="/flowers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 text-xs font-semibold"
            >
              <span>Add Flowers to Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {subscriptions.map((sub) => {
              const isPaused = sub.status === 'paused';
              const isCancelled = sub.status === 'cancelled';
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

              return (
                <div
                  key={sub.id}
                  className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-7 shadow-soft space-y-6"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-botanical-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-lg text-botanical-900">
                          Subscription #{sub.id}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            sub.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isPaused
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Subscriber: <strong>{sub.customer.customerName}</strong> ({sub.customer.flatNumber}, {sub.customer.apartmentCommunity}) • Phone: {sub.customer.phone}
                      </p>
                    </div>

                    {/* Actions: Pause, Resume, Cancel */}
                    <div className="flex items-center gap-2">
                      {!isCancelled && (
                        <>
                          {isPaused ? (
                            <button
                              onClick={() => handleAction(sub.id, 'resume')}
                              disabled={actionLoading === `${sub.id}-resume-`}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(sub.id, 'pause')}
                              disabled={actionLoading === `${sub.id}-pause-`}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel this subscription?')) {
                                handleAction(sub.id, 'cancel');
                              }
                            }}
                            disabled={actionLoading === `${sub.id}-cancel-`}
                            className="px-3 py-1.5 rounded-xl bg-stone-200 hover:bg-rose-100 text-stone-600 hover:text-rose-700 font-semibold text-xs transition"
                          >
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Schedule Details Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-cream-50 p-3.5 rounded-2xl border border-botanical-100">
                      <div className="text-stone-500 font-medium">Delivery Days</div>
                      <div className="font-bold text-botanical-900 text-sm mt-0.5">
                        {sub.daysOfWeek.join(', ')}
                      </div>
                    </div>

                    <div className="bg-cream-50 p-3.5 rounded-2xl border border-botanical-100">
                      <div className="text-stone-500 font-medium">Time Slot</div>
                      <div className="font-bold text-botanical-900 text-sm mt-0.5">
                        {sub.timeSlot === 'morning' ? 'Morning Puja (6:00 AM – 8:30 AM)' : 'Evening Sandhya'}
                      </div>
                    </div>

                    <div className="bg-cream-50 p-3.5 rounded-2xl border border-botanical-100">
                      <div className="text-stone-500 font-medium">Estimated Weekly Total</div>
                      <div className="font-bold text-botanical-900 text-sm mt-0.5">
                        {formatINR(sub.estimatedWeeklyPaise)}
                      </div>
                    </div>
                  </div>

                  {/* Flowers in this subscription */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Flowers in Daily Package
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {sub.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-xl bg-botanical-100/70 border border-botanical-200 text-xs font-semibold text-botanical-900"
                        >
                          {item.name} ({item.quantity} {item.unit})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming 14-day schedule with Skip Date capability */}
                  <div className="pt-2 border-t border-botanical-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-botanical-900 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-botanical-700" />
                        <span>Upcoming Scheduled Deliveries (Next 14 Days)</span>
                      </h4>
                      {isPaused && (
                        <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                          Paused: Deliveries on hold
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {upcomingDates.map((dateStr) => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const dayName = dayNames[dateObj.getDay()];
                        const isScheduledDay = sub.daysOfWeek.includes(dayName as any);
                        const isSkipped = sub.skippedDates.includes(dateStr);
                        const isGenerating = !isPaused && !isCancelled && isScheduledDay && !isSkipped;

                        return (
                          <div
                            key={dateStr}
                            className={`p-2.5 rounded-xl border text-center transition flex flex-col justify-between ${
                              !isScheduledDay
                                ? 'bg-stone-50 border-stone-100 opacity-40 text-stone-400'
                                : isSkipped
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : isPaused
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-cream-50 border-botanical-200 text-botanical-900 shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="text-[10px] font-bold uppercase">{dayName}</div>
                              <div className="font-bold text-xs my-0.5">
                                {dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </div>
                            </div>

                            <div className="mt-1">
                              {!isScheduledDay ? (
                                <span className="text-[9px] text-stone-400">Off Day</span>
                              ) : isSkipped ? (
                                <span className="text-[10px] font-bold text-rose-600 block">
                                  Skipped
                                </span>
                              ) : isPaused ? (
                                <span className="text-[10px] text-amber-700 font-semibold block">
                                  On Hold
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAction(sub.id, 'skip', dateStr)}
                                  disabled={actionLoading === `${sub.id}-skip-${dateStr}`}
                                  className="w-full py-1 rounded bg-cream-200 hover:bg-rose-100 hover:text-rose-700 text-stone-700 text-[10px] font-semibold transition"
                                >
                                  {actionLoading === `${sub.id}-skip-${dateStr}` ? '...' : 'Skip Date'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skipped dates record list */}
                  {sub.skippedDates.length > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                      <CalendarX2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Excluded Skipped Dates: </span>
                        <span>{sub.skippedDates.join(', ')} (Deliveries will not be made or billed on these dates).</span>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
