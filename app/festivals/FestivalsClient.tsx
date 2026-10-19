'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Plus,
  Minus,
  Flower2
} from 'lucide-react';
import { Festival, Product, FestivalBooking } from '@/types';
import { DEFAULT_SETTINGS, formatINR } from '@/lib/config';

interface Props {
  festivals: Festival[];
  products: Product[];
  initialSelectedFestivalId?: string;
}

export default function FestivalsClient({
  festivals,
  products,
  initialSelectedFestivalId,
}: Props) {
  const [selectedFestivalId, setSelectedFestivalId] = useState<string>(
    initialSelectedFestivalId || festivals[0]?.id || ''
  );

  // Selected items inside the festival booking: map of productId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    products.forEach((p) => {
      // Default 1 quantity for popular puja items
      if (p.id === 'prod-marigold' || p.id === 'prod-jasmine' || p.id === 'prod-lotus') {
        init[p.id] = 1;
      } else {
        init[p.id] = 0;
      }
    });
    return init;
  });

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [apartmentCommunity, setApartmentCommunity] = useState('');
  const [buildingTower, setBuildingTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [specialGarlandNotes, setSpecialGarlandNotes] = useState('');
  const [preferredSlot, setPreferredSlot] = useState<'early_morning' | 'morning' | 'evening'>('early_morning');

  // Booking state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<FestivalBooking | null>(null);

  const selectedFestival = festivals.find((f) => f.id === selectedFestivalId) || festivals[0];

  const handleQtyChange = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Selected items list
  const selectedItems = products
    .filter((p) => (quantities[p.id] || 0) > 0)
    .map((p) => ({
      productId: p.id,
      product: p,
      quantity: quantities[p.id],
      totalPaise: p.pricePaise * quantities[p.id],
    }));

  const subtotalPaise = selectedItems.reduce((sum, item) => sum + item.totalPaise, 0);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedItems.length === 0) {
      setErrorMessage('Please select at least one flower item for your festival booking.');
      return;
    }

    if (!customerName.trim() || !phone.trim() || !flatNumber.trim() || !buildingTower.trim()) {
      setErrorMessage('Please fill in all required customer details.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/festivals/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          festivalId: selectedFestival.id,
          customer: {
            customerName: customerName.trim(),
            phone: phone.trim(),
            apartmentCommunity,
            buildingTower: buildingTower.trim(),
            flatNumber: flatNumber.trim(),
          },
          items: selectedItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          specialGarlandNotes: specialGarlandNotes.trim() || undefined,
          preferredSlot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit festival booking.');
      }

      setConfirmedBooking(data.booking);
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION MODAL / VIEW
  if (confirmedBooking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-cream-100/90 border border-marigold-300 rounded-3xl p-6 sm:p-8 shadow-elevated text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-marigold-100 text-marigold-700 flex items-center justify-center mx-auto shadow-soft">
            <Sparkles className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Booking Requested Successfully
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 mt-2">
              Booking #{confirmedBooking.id}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Advance booking for <strong>{confirmedBooking.festivalName}</strong> on <strong>{confirmedBooking.festivalDate}</strong>
            </p>
          </div>

          {/* Lifecycle guide */}
          <div className="bg-cream-50 p-4 rounded-2xl border border-botanical-100 text-left space-y-2 text-xs">
            <div className="font-bold text-botanical-900 mb-1">Festival Booking Status:</div>
            <div className="flex items-center gap-2 text-botanical-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <strong>1. Booking Requested:</strong> Stored securely in Mahesh Flora database.
            </div>
            <div className="flex items-center gap-2 text-stone-500">
              <span className="w-2 h-2 rounded-full bg-stone-300"></span>
              <span><strong>2. Booking Confirmed:</strong> Florist verifies harvest quotas 48h before festival.</span>
            </div>
            <div className="flex items-center gap-2 text-stone-500">
              <span className="w-2 h-2 rounded-full bg-stone-300"></span>
              <span><strong>3. Payment & Delivery:</strong> Morning delivery slot confirmed via WhatsApp.</span>
            </div>
          </div>

          {confirmedBooking.whatsappLink && (
            <a
              href={confirmedBooking.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95"
            >
              <Phone className="w-4 h-4" />
              <span>Connect on WhatsApp for Priority Confirmation</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <div className="pt-2">
            <button
              onClick={() => setConfirmedBooking(null)}
              className="text-xs text-botanical-700 font-semibold hover:underline"
            >
              ← Book for Another Festival
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      {/* Header */}
      <div className="pb-4 border-b border-botanical-100 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold-100 text-marigold-800 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-marigold-600" />
          <span>Advance Reservations</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-botanical-900">
          Festival Flower Pre-Booking
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
          Reserve sacred lotuses, deity malas, and bulk decorative marigolds in advance to avoid festival morning rush and market inflation.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Festival Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {festivals.map((fest) => {
          const isSelected = fest.id === selectedFestivalId;
          return (
            <button
              key={fest.id}
              type="button"
              onClick={() => setSelectedFestivalId(fest.id)}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                isSelected
                  ? 'border-marigold-500 bg-amber-50/80 ring-2 ring-marigold-400/40 shadow-soft'
                  : 'border-botanical-200 bg-cream-50 hover:bg-cream-200/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                  <span className="font-bold text-botanical-900 bg-botanical-100 px-2 py-0.5 rounded">
                    {fest.festivalDate}
                  </span>
                  <span className="text-[10px] text-petal-600 font-semibold">
                    Cutoff: {fest.bookingDeadline}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-sm text-botanical-900 mt-1">
                  {fest.name}
                </h3>
                {fest.teluguName && (
                  <p className="text-[11px] text-botanical-700 font-medium">
                    {fest.teluguName}
                  </p>
                )}
              </div>
              {isSelected && (
                <div className="text-[11px] font-bold text-marigold-700 mt-3 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selected Festival</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Festival Details & Booking Form */}
      {selectedFestival && (
        <form onSubmit={handleSubmitBooking} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Flower Quantities & Special Notes */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Festival Banner Card */}
            <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 space-y-2">
              <h2 className="font-serif font-bold text-lg text-botanical-900">
                {selectedFestival.name} — Floral Kit Customization
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                {selectedFestival.description}
              </p>
              <div className="pt-2 flex items-center gap-3 text-xs text-stone-600">
                <span>Festival Date: <strong>{selectedFestival.festivalDate}</strong></span>
                <span>•</span>
                <span>Booking Deadline: <strong>{selectedFestival.bookingDeadline}</strong></span>
              </div>
            </div>

            {/* Product selection list */}
            <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 space-y-4">
              <h3 className="font-serif font-bold text-base text-botanical-900 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-botanical-700" />
                <span>1. Select Desired Flowers & Quantities</span>
              </h3>

              <div className="space-y-3">
                {products.map((product) => {
                  const qty = quantities[product.id] || 0;
                  return (
                    <div
                      key={product.id}
                      className="bg-cream-50 p-3.5 rounded-2xl border border-botanical-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-cream-200 shrink-0">
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-botanical-900 truncate">
                            {product.name}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatINR(product.pricePaise)} / {product.unit}
                          </div>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border border-botanical-200 rounded-xl bg-white shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(product.id, -1)}
                          className="p-1.5 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/50 rounded-l-xl transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-botanical-900 min-w-6 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(product.id, 1)}
                          className="p-1.5 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/50 rounded-r-xl transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Special Request or Custom Garland Notes */}
            <div className="bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 space-y-3">
              <h3 className="font-serif font-bold text-base text-botanical-900">
                2. Custom Garland or Special Requirements
              </h3>
              <p className="text-xs text-stone-600">
                Specify garland lengths, color themes, or specific pooja requirements (e.g. 5-foot Rose and Jasmine garland for idol, extra Lotus stems, fresh mango leaves toranam):
              </p>
              <textarea
                rows={3}
                value={specialGarlandNotes}
                onChange={(e) => setSpecialGarlandNotes(e.target.value)}
                placeholder="e.g. Please provide a pair of 4-foot thick garlands woven with red roses and white jasmine buds for deity idol."
                className="w-full p-3 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              />
            </div>
          </div>

          {/* Right Column: Slot Selection & Customer Address */}
          <div className="lg:col-span-5 bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 space-y-5 sticky top-24 shadow-soft">
            <h3 className="font-serif font-bold text-base sm:text-lg text-botanical-900 pb-2 border-b border-botanical-200">
              Delivery Slot & Flat Details
            </h3>

            {/* Delivery Slot */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700">
                Preferred Festival Delivery Slot *
              </label>
              <select
                value={preferredSlot}
                onChange={(e) => setPreferredSlot(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
              >
                <option value="early_morning">Brahma Muhurtham (5:00 AM – 6:30 AM)</option>
                <option value="morning">Morning Puja Slot (6:30 AM – 8:30 AM)</option>
                <option value="evening">Evening Sandhya Slot (5:00 PM – 7:30 PM)</option>
              </select>
            </div>

            {/* Customer Contact */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Sitaram Raju"
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  maxLength={14}
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Apartment / Gated Community Name *
                </label>
                <input
                  type="text"
                  required
                  value={apartmentCommunity}
                  onChange={(e) => setApartmentCommunity(e.target.value)}
                  placeholder="Type your apartment or gated community name"
                  className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Tower / Block *
                  </label>
                  <input
                    type="text"
                    required
                    value={buildingTower}
                    onChange={(e) => setBuildingTower(e.target.value)}
                    placeholder="Tower 2"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Flat No *
                  </label>
                  <input
                    type="text"
                    required
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    placeholder="Flat 1102"
                    className="w-full px-3 py-2 rounded-xl border border-botanical-200 bg-cream-50 text-xs sm:text-sm text-botanical-900 focus:outline-none focus:ring-2 focus:ring-botanical-600"
                  />
                </div>
              </div>
            </div>

            {/* Estimated Total */}
            <div className="pt-3 border-t border-botanical-200 flex justify-between items-baseline">
              <span className="text-xs font-bold text-stone-700">Estimated Total:</span>
              <span className="font-serif font-bold text-lg text-botanical-900">
                {formatINR(subtotalPaise)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedItems.length === 0}
              className="w-full py-3.5 px-4 rounded-xl bg-marigold-500 hover:bg-marigold-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Reserving Kit...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Reserve Festival Flower Kit</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-stone-500 text-center">
              Florist confirms harvest availability 48 hours prior to the festival date.
            </p>
          </div>

        </form>
      )}

    </div>
  );
}
