'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  ShieldCheck,
  Mail,
  MapPin,
  Edit2,
  Check,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  LogIn,
  Package,
  Calendar,
  Lock,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { UserProfile, SavedAddress } from '@/types';

export default function ProfileClient() {
  const { user, customerPhone, getIdToken, isAuthenticated, isLoading: isAuthLoading } = useCustomerAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProfileAndAddresses = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.uid) headers['x-customer-uid'] = user.uid;
      if (customerPhone) headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);

      // 1. Fetch Profile
      const profileRes = await fetch('/api/profile', { headers });
      if (profileRes.ok) {
        const pData = await profileRes.json();
        if (pData.profile) {
          setProfile(pData.profile);
          setDisplayNameInput(pData.profile.displayName || user?.displayName || '');
          setEmailInput(pData.profile.email || user?.email || '');
        }
      } else {
        // Fallback default
        setProfile({
          uid: user?.uid || '',
          phone: customerPhone || '',
          displayName: user?.displayName || '',
          email: user?.email || '',
        });
        setDisplayNameInput(user?.displayName || '');
        setEmailInput(user?.email || '');
      }

      // 2. Fetch Addresses
      const addrRes = await fetch('/api/addresses', { headers });
      if (addrRes.ok) {
        const aData = await addrRes.json();
        setAddresses(aData.addresses || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile details.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getIdToken, user, customerPhone]);

  useEffect(() => {
    fetchProfileAndAddresses();
  }, [fetchProfileAndAddresses]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) credentialsHeaders(headers, token);
      if (user?.uid) headers['x-customer-uid'] = user.uid;
      if (customerPhone) headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          displayName: displayNameInput.trim(),
          email: emailInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile details.');
      }

      setProfile(data.profile);
      setIsEditing(false);
      setSuccessMessage('Profile details updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const credentialsHeaders = (target: Record<string, string>, token: string) => {
    target['Authorization'] = `Bearer ${token}`;
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-xs text-stone-600">Verifying customer authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-botanical-100 text-botanical-800 flex items-center justify-center mx-auto">
          <User className="w-7 h-7 text-botanical-700" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-botanical-900">
          Customer Account & Profile
        </h2>
        <p className="text-sm text-stone-600">
          Please sign in with your mobile number to view your personal details, order history, and saved addresses.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs shadow-soft transition active:scale-95"
        >
          <LogIn className="w-4 h-4" />
          <span>Login / Sign Up</span>
        </Link>
      </div>
    );
  }

  const verifiedPhone = profile?.phone || customerPhone || user?.phoneNumber || '';
  const currentDisplayName = profile?.displayName || user?.displayName || 'Flower Devotee';
  const currentEmail = profile?.email || user?.email || '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-botanical-200/80 pb-5">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 flex items-center gap-2.5">
            <User className="w-7 h-7 text-botanical-700" />
            <span>My Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Manage your personal profile details, verified phone number, and delivery locations.
          </p>
        </div>

        {/* Quick Nav Badges */}
        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-cream-100 transition shadow-xs"
          >
            <Package className="w-3.5 h-3.5 text-botanical-700" />
            <span>My Orders</span>
          </Link>
          <Link
            href="/subscriptions"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-cream-100 transition shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-botanical-700" />
            <span>Subscriptions</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Details Card */}
      <div className="bg-white rounded-3xl border border-botanical-200 p-5 sm:p-7 shadow-soft space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-botanical-700 to-botanical-900 text-cream-50 font-bold flex items-center justify-center text-lg shadow-sm">
              {currentDisplayName ? currentDisplayName.charAt(0).toUpperCase() : 'M'}
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-stone-900 leading-tight">
                {currentDisplayName}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono mt-0.5">
                <span>{verifiedPhone}</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setDisplayNameInput(profile?.displayName || user?.displayName || '');
                setEmailInput(profile?.email || user?.email || '');
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-700 transition"
            >
              <Edit2 className="w-3.5 h-3.5 text-botanical-700" />
              <span>Edit Details</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>
            </div>

            {/* Read-Only Verified Mobile Number */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-stone-800">
                    Verified Mobile Number: <span className="font-mono text-botanical-800">{verifiedPhone}</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Locked to your verified SMS OTP login for account security.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Phone Verified
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormError(null);
                }}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-cream-50 border border-botanical-100 space-y-1">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Full Name
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {currentDisplayName || 'Not specified'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cream-50 border border-botanical-100 space-y-1">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Verified Mobile Number
              </div>
              <div className="text-sm font-semibold text-stone-900 font-mono flex items-center gap-2">
                <span>{verifiedPhone}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cream-50 border border-botanical-100 space-y-1">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Email Address
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {currentEmail ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span>{currentEmail}</span>
                  </span>
                ) : (
                  <span className="text-stone-400 italic">No email address added</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cream-50 border border-botanical-100 space-y-1">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Account Status
              </div>
              <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Active Customer (OTP Authenticated)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved Addresses Section */}
      <div className="bg-white rounded-3xl border border-botanical-200 p-5 sm:p-7 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-botanical-700" />
              <span>Saved Delivery Addresses</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Addresses automatically saved from your orders and checkout.
            </p>
          </div>

          <Link
            href="/addresses"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition active:scale-95"
          >
            <span>Manage Addresses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-botanical-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-xs text-stone-500">Loading saved addresses...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="p-6 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center space-y-3">
            <MapPin className="w-8 h-8 text-stone-400 mx-auto" />
            <div>
              <p className="text-xs font-semibold text-stone-700">No Saved Delivery Addresses Yet</p>
              <p className="text-[11px] text-stone-500 mt-0.5 max-w-sm mx-auto">
                When you place your first order or add an address, it will automatically appear here as your default delivery location.
              </p>
            </div>
            <Link
              href="/addresses"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-botanical-300 bg-white text-xs font-semibold text-botanical-800 hover:bg-cream-50 transition"
            >
              <span>Add Delivery Address</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-4 rounded-2xl border transition relative ${
                  addr.isDefault
                    ? 'border-botanical-500 bg-cream-50/80 ring-1 ring-botanical-500/20'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-botanical-900 bg-botanical-100 px-2.5 py-0.5 rounded-full">
                    {addr.label || 'Delivery'}
                  </span>
                  {addr.isDefault && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      Default Address
                    </span>
                  )}
                </div>

                <div className="text-xs text-stone-800 font-semibold mb-1">
                  {addr.recipientName} • <span className="font-mono font-normal text-stone-600">{addr.phone}</span>
                </div>

                <div className="text-xs text-stone-600 leading-relaxed">
                  <p>
                    {addr.flatNumber}
                    {addr.tower ? `, Tower ${addr.tower}` : ''}
                    {addr.block ? `, Block ${addr.block}` : ''}
                    {addr.street ? `, ${addr.street}` : ''}
                  </p>
                  <p>
                    {addr.apartmentCommunity ? `${addr.apartmentCommunity}, ` : ''}
                    {addr.locality}
                  </p>
                  <p className="text-stone-500 text-[11px]">
                    {addr.city || 'Bengaluru'} - {addr.pincode}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
