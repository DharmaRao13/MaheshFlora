'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Phone,
  Calendar,
  ShoppingBag,
  MapPin,
  Sparkles,
  Tag,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building,
  RefreshCw,
} from 'lucide-react';
import { AdminCustomerSummary, AdminCustomerDetail, Order, SavedAddress } from '@/types';
import { formatINR } from '@/lib/config';

interface CustomerManagementProps {
  adminKey?: string;
}

export default function CustomerManagement({ adminKey }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<AdminCustomerSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected customer for detail drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const getHeaders = () => {
    const key = adminKey || (typeof window !== 'undefined' ? localStorage.getItem('mahesh_admin_key') || '' : '');
    return {
      'Content-Type': 'application/json',
      'x-admin-key': key,
    };
  };

  const fetchCustomers = async (search = '') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(search)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch customers');
      }
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchTerm);
  }, [searchTerm]);

  const loadCustomerDetail = async (id: string) => {
    setSelectedCustomerId(id);
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(id)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to load customer details');
      }
      const data = await res.json();
      setCustomerDetail(data.customer);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-botanical-200 shadow-soft">
        <div>
          <h2 className="text-xl font-serif font-bold text-botanical-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-botanical-700" />
            <span>Customer Management</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Registered customer directory, order histories, addresses & promotion claims
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-botanical-200 rounded-xl text-xs text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchCustomers(searchTerm)}
            className="p-2 rounded-xl border border-botanical-200 hover:bg-cream-100 text-stone-600 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Customers Table / Grid */}
      <div className="bg-white border border-botanical-200 rounded-2xl shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-stone-500 space-y-2">
            <div className="w-6 h-6 border-2 border-botanical-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading customer accounts...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <Users className="w-8 h-8 text-botanical-300 mx-auto" />
            <p className="text-sm font-semibold text-botanical-900">No Customers Found</p>
            <p className="text-xs text-stone-500">
              {searchTerm ? 'No customer matched your search terms.' : 'No customers have placed orders yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-cream-100/80 border-b border-botanical-200 text-stone-700 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Total Spent</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">First Order</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((c) => (
                  <tr
                    key={c.uid}
                    className="hover:bg-cream-50/80 transition cursor-pointer"
                    onClick={() => loadCustomerDetail(c.uid)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-botanical-900">{c.name || 'Customer'}</div>
                      <div className="text-[10px] text-stone-400 font-mono">UID: {c.uid.slice(0, 12)}...</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-stone-800">
                      {c.phone || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-botanical-100 text-botanical-800">
                        {c.completedOrdersCount} / {c.totalOrdersCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-serif font-bold text-botanical-900 text-sm">
                      {formatINR(c.totalSpendingPaise)}
                    </td>
                    <td className="py-3 px-4">
                      {c.hasActiveSubscription ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active Weekly</span>
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-600 text-[11px]">
                      {new Date(c.firstOrderDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadCustomerDetail(c.uid);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-botanical-100 hover:bg-botanical-200 text-botanical-900 font-semibold text-xs transition"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-botanical-950/60 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-cream-50 w-full max-w-2xl h-full shadow-2xl overflow-y-auto border-l border-botanical-200 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-botanical-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-botanical-600">
                  Customer Profile
                </span>
                <h3 className="text-xl font-serif font-bold text-botanical-900">
                  {customerDetail?.name || 'Customer Details'}
                </h3>
                {customerDetail?.phone && (
                  <p className="text-xs text-stone-600 font-mono mt-0.5">{customerDetail.phone}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerDetail(null);
                }}
                className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailLoading || !customerDetail ? (
              <div className="p-12 text-center text-xs text-stone-500 space-y-2">
                <div className="w-6 h-6 border-2 border-botanical-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p>Loading customer history...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-botanical-200">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">Total Spend</div>
                    <div className="text-base font-serif font-bold text-botanical-900 mt-0.5">
                      {formatINR(customerDetail.totalSpendingPaise)}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-botanical-200">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">Completed Orders</div>
                    <div className="text-base font-serif font-bold text-botanical-900 mt-0.5">
                      {customerDetail.completedOrdersCount}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-botanical-200">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">Weekly Subscription</div>
                    <div className="text-xs font-bold text-emerald-800 mt-1">
                      {customerDetail.hasActiveSubscription ? 'Active' : 'None'}
                    </div>
                  </div>
                </div>

                {/* Saved Delivery Addresses (with Tower & Block) */}
                <div className="bg-white p-5 rounded-2xl border border-botanical-200 space-y-3">
                  <h4 className="text-xs font-bold text-botanical-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-botanical-700" />
                    <span>Saved Delivery Addresses</span>
                  </h4>

                  {customerDetail.savedAddresses.length === 0 ? (
                    <p className="text-xs text-stone-500 italic">No saved addresses on file.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {customerDetail.savedAddresses.map((addr, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-stone-200 bg-cream-50/50 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold text-botanical-900">
                            <span>{addr.recipientName || customerDetail.name}</span>
                            <span className="text-[10px] bg-botanical-100 text-botanical-800 px-2 py-0.5 rounded-full">
                              {addr.label || 'Home'}
                            </span>
                          </div>
                          <div className="text-stone-700">
                            {addr.flatNumber && <span>Flat {addr.flatNumber}, </span>}
                            {addr.tower && <span>Tower {addr.tower}, </span>}
                            {addr.block && <span>Block {addr.block}, </span>}
                            <span>{addr.apartmentCommunity || addr.locality}</span>
                          </div>
                          <div className="text-stone-500 text-[11px]">
                            {addr.city}, {addr.state} - {addr.pincode}
                          </div>
                          {addr.phone && (
                            <div className="text-stone-600 text-[11px] font-mono">
                              Contact: {addr.phone}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Promotion Redemption History */}
                <div className="bg-white p-5 rounded-2xl border border-botanical-200 space-y-3">
                  <h4 className="text-xs font-bold text-botanical-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-botanical-700" />
                    <span>Promotion Redemptions</span>
                  </h4>

                  {customerDetail.promotionRedemptions.length === 0 ? (
                    <p className="text-xs text-stone-500 italic">No promotions claimed yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {customerDetail.promotionRedemptions.map((promo, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-emerald-900">
                              {promo.eligibilityReason || 'Free Delivery Promotion'}
                            </div>
                            <div className="text-[11px] text-emerald-700">
                              Order #{promo.orderId} • {new Date(promo.date).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                          <span className="font-bold text-emerald-800 text-xs">
                            Saved {formatINR(promo.discountAmountPaise)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order History */}
                <div className="bg-white p-5 rounded-2xl border border-botanical-200 space-y-3">
                  <h4 className="text-xs font-bold text-botanical-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-botanical-700" />
                    <span>Order History ({customerDetail.orders.length})</span>
                  </h4>

                  <div className="space-y-3">
                    {customerDetail.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl border border-stone-200 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-botanical-900">
                            #{ord.id}
                          </span>
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-botanical-100 text-botanical-800">
                            {ord.orderStatus}
                          </span>
                        </div>

                        <div className="text-stone-600 text-[11px]">
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          • {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-stone-100 font-medium">
                          <span className="text-stone-500">Total</span>
                          <span className="font-bold text-botanical-900 text-sm">
                            {formatINR(ord.totalPaise)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
