'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Home,
  Briefcase,
  Heart,
  Sparkles,
  Phone,
  User,
  ArrowLeft,
  LogIn,
} from 'lucide-react';
import { SavedAddress, AddressLabel } from '@/types';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { validateIndianPhone, validatePincode } from '@/lib/business';

const ADDRESS_LABELS: AddressLabel[] = ['Home', 'Work', 'Parents', 'Mandir/Pooja Room', 'Other'];

export default function SavedAddressesClient() {
  const { user, customerPhone, getIdToken, isAuthenticated, isLoading: isAuthLoading } = useCustomerAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [showConfirmEditModal, setShowConfirmEditModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<string | null>(null);

  // Form inputs
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [street, setStreet] = useState('');
  const [apartmentCommunity, setApartmentCommunity] = useState('');
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [label, setLabel] = useState<AddressLabel | string>('Home');
  const [isDefault, setIsDefault] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch addresses
  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (user?.uid) {
        headers['x-customer-uid'] = user.uid;
      }
      if (customerPhone) {
        headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);
      }

      const res = await fetch('/api/addresses', { headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch addresses');
      }
      setAddresses(data.addresses || []);
    } catch (err: any) {
      setError(err.message || 'Could not load your saved addresses.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getIdToken, user?.uid, customerPhone]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const resetForm = () => {
    setEditingAddress(null);
    setRecipientName(user?.displayName || '');
    setPhone(customerPhone ? customerPhone.replace(/[^0-9]/g, '').slice(-10) : '');
    setAlternatePhone('');
    setFlatNumber('');
    setStreet('');
    setApartmentCommunity('');
    setLocality('');
    setLandmark('');
    setCity('Bengaluru');
    setState('Karnataka');
    setPincode('');
    setDeliveryInstructions('');
    setLabel('Home');
    setIsDefault(addresses.length === 0);
    setFormError(null);
    setIsSaving(false);
  };

  const openAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setRecipientName(addr.recipientName);
    setPhone(addr.phone.replace(/[^0-9]/g, '').slice(-10));
    setAlternatePhone(addr.alternatePhone ? addr.alternatePhone.replace(/[^0-9]/g, '').slice(-10) : '');
    setFlatNumber(addr.flatNumber);
    setStreet(addr.street || '');
    setApartmentCommunity(addr.apartmentCommunity || '');
    setLocality(addr.locality);
    setLandmark(addr.landmark || '');
    setCity(addr.city || 'Bengaluru');
    setState(addr.state || 'Karnataka');
    setPincode(addr.pincode);
    setDeliveryInstructions(addr.deliveryInstructions || '');
    setLabel(addr.label || 'Home');
    setIsDefault(addr.isDefault);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmitAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!recipientName.trim() || recipientName.trim().length < 2) {
      setFormError('Please enter recipient name (minimum 2 characters)');
      return;
    }

    const phoneVal = validateIndianPhone(phone);
    if (!phoneVal.valid) {
      setFormError(phoneVal.error || 'Please enter a valid 10-digit mobile number');
      return;
    }

    if (alternatePhone.trim()) {
      const altVal = validateIndianPhone(alternatePhone);
      if (!altVal.valid) {
        setFormError(`Alternate Phone: ${altVal.error}`);
        return;
      }
    }

    if (!flatNumber.trim()) {
      setFormError('House / Flat number is required');
      return;
    }

    if (!locality.trim() && !apartmentCommunity.trim()) {
      setFormError('Street / Locality or Society name is required');
      return;
    }

    const pinVal = validatePincode(pincode);
    if (!pinVal.valid) {
      setFormError(pinVal.error || 'Please enter a valid 6-digit Indian PIN code');
      return;
    }

    if (editingAddress) {
      setShowConfirmEditModal(true);
    } else {
      submitAddressPayload();
    }
  };

  const submitAddressPayload = async () => {
    setIsSaving(true);
    setFormError(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.uid) headers['x-customer-uid'] = user.uid;
      if (customerPhone) headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);

      const payload = {
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        flatNumber: flatNumber.trim(),
        street: street.trim() || undefined,
        apartmentCommunity: apartmentCommunity.trim() || undefined,
        locality: locality.trim() || apartmentCommunity.trim(),
        landmark: landmark.trim() || undefined,
        city: city.trim() || 'Bengaluru',
        state: state.trim() || 'Karnataka',
        pincode: pincode.trim(),
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        label,
        isDefault,
      };

      const url = editingAddress ? `/api/addresses/${editingAddress.id}` : '/api/addresses';
      const method = editingAddress ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save address');
      }

      setSuccessMessage(
        editingAddress ? 'Address updated successfully!' : 'New address saved successfully!'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsFormOpen(false);
      setShowConfirmEditModal(false);
      fetchAddresses();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the address.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setIsSaving(true);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.uid) headers['x-customer-uid'] = user.uid;
      if (customerPhone) headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);

      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete address');
      }

      setShowConfirmDeleteModal(null);
      setSuccessMessage('Address removed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchAddresses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (addr: SavedAddress) => {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.uid) headers['x-customer-uid'] = user.uid;
      if (customerPhone) headers['x-customer-phone'] = customerPhone.replace(/[^0-9]/g, '').slice(-10);

      const res = await fetch(`/api/addresses/${addr.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to update default address');
      }

      fetchAddresses();
    } catch (err: any) {
      alert(err.message || 'Failed to set default address');
    }
  };

  const getLabelIcon = (lbl: string) => {
    switch (lbl) {
      case 'Work':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'Parents':
        return <Heart className="w-3.5 h-3.5" />;
      case 'Mandir/Pooja Room':
        return <Sparkles className="w-3.5 h-3.5" />;
      default:
        return <Home className="w-3.5 h-3.5" />;
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-stone-600">Loading your profile...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-botanical-100 flex items-center justify-center text-botanical-800 mx-auto shadow-sm">
          <MapPin className="w-8 h-8 text-botanical-700" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-botanical-900">
          Saved Delivery Addresses
        </h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          Please sign in with your mobile number to view, add, and manage your saved flower delivery addresses.
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/orders"
              className="text-stone-500 hover:text-botanical-800 text-xs flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Orders</span>
            </Link>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-botanical-700" />
            <span>Saved Delivery Addresses</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Manage your delivery locations for faster puja flower checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Address</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Addresses Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs text-stone-600">Loading addresses...</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-white/80 rounded-2xl border border-botanical-100 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-botanical-100/80 text-botanical-800 flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6 text-botanical-700" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-botanical-900">No Saved Addresses Found</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              You haven&apos;t added any delivery addresses yet. Add your home or mandir address for quick checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 text-xs font-semibold shadow-soft hover:bg-botanical-800 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Your First Address</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`relative bg-white rounded-2xl border p-4 sm:p-5 transition shadow-sm hover:shadow-md flex flex-col justify-between ${
                addr.isDefault
                  ? 'border-botanical-600 ring-2 ring-botanical-500/20'
                  : 'border-botanical-200/80 hover:border-botanical-400'
              }`}
            >
              <div>
                {/* Badges row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-botanical-100 text-botanical-900">
                    {getLabelIcon(addr.label)}
                    <span>{addr.label}</span>
                  </span>

                  {addr.isDefault ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Default</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr)}
                      className="text-[11px] text-stone-500 hover:text-botanical-700 underline font-medium transition"
                    >
                      Make Default
                    </button>
                  )}
                </div>

                {/* Recipient & Phone */}
                <div className="space-y-1 mb-2.5">
                  <h4 className="font-semibold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-botanical-700 shrink-0" />
                    <span>{addr.recipientName}</span>
                  </h4>
                  <p className="text-xs text-stone-600 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{addr.phone}</span>
                    {addr.alternatePhone && (
                      <span className="text-stone-400">/ {addr.alternatePhone}</span>
                    )}
                  </p>
                </div>

                {/* Address Details */}
                <div className="text-xs text-stone-700 space-y-0.5 leading-relaxed bg-stone-50/70 p-3 rounded-xl border border-stone-200/60 mb-3">
                  <p className="font-medium text-stone-900">
                    {addr.flatNumber}
                    {addr.street ? `, ${addr.street}` : ''}
                  </p>
                  <p>
                    {addr.apartmentCommunity ? `${addr.apartmentCommunity}, ` : ''}
                    {addr.locality}
                  </p>
                  {addr.landmark && (
                    <p className="text-stone-500 italic">Landmark: {addr.landmark}</p>
                  )}
                  <p className="font-medium text-botanical-900">
                    {addr.city}, {addr.state} – {addr.pincode}
                  </p>
                  {addr.deliveryInstructions && (
                    <p className="text-[11px] text-botanical-700 mt-1 border-t border-stone-200/50 pt-1">
                      Note: {addr.deliveryInstructions}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => openEditForm(addr)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-botanical-800 hover:bg-botanical-100/70 transition"
                  aria-label={`Edit address for ${addr.recipientName}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDeleteModal(addr.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                  aria-label={`Delete address for ${addr.recipientName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-cream-50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-botanical-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-botanical-100">
              <h3 className="font-serif font-bold text-lg text-botanical-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-botanical-700" />
                <span>{editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmitAttempt} className="space-y-3.5">
              {/* Address Label Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Address Type / Label *
                </label>
                <div className="flex flex-wrap gap-2">
                  {ADDRESS_LABELS.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                        label === lbl
                          ? 'bg-botanical-700 text-cream-50 shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-700 hover:bg-cream-100'
                      }`}
                    >
                      {getLabelIcon(lbl)}
                      <span>{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Number (10 Digits) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full pl-11 pr-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* House / Flat & Street */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    House / Flat / Villa No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    placeholder="e.g. Flat 402, Block A"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Street / Road / Lane
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. 5th Main, 2nd Cross"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              {/* Apartment Community & Locality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Apartment / Society Name
                  </label>
                  <input
                    type="text"
                    value={apartmentCommunity}
                    onChange={(e) => setApartmentCommunity(e.target.value)}
                    placeholder="e.g. Prestige Lake Ridge"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Locality / Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Jayanagar, BTM Layout"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>

              {/* Landmark, City, State, PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near Ganesha Temple"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    6-Digit PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="560001"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600 font-mono"
                  />
                </div>
              </div>

              {/* Delivery Instructions */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="Leave at doorstep / Ring bell twice"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              {/* Default Address Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-botanical-600 focus:ring-botanical-500 border-stone-300"
                />
                <label htmlFor="isDefault" className="text-xs font-medium text-stone-800">
                  Make this my default delivery address
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-botanical-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Updating Existing Address */}
      {showConfirmEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-cream-50 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-botanical-200 space-y-3">
            <h4 className="font-serif font-bold text-base text-botanical-900">
              Confirm Address Update
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to save changes to this address? Future deliveries will use these updated details. Past orders remain unchanged.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmEditModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Review
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={submitAddressPayload}
                className="px-4 py-1.5 rounded-lg bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft"
              >
                {isSaving ? 'Updating...' : 'Yes, Update Address'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Address */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-cream-50 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-botanical-200 space-y-3">
            <h4 className="font-serif font-bold text-base text-rose-900 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Address</span>
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to delete this saved delivery address? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeleteAddress(showConfirmDeleteModal)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-soft"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
