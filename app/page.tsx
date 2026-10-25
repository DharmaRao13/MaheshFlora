import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flower2,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  Truck,
  CheckCircle2,
  Phone,
  Heart
} from 'lucide-react';
import { getProducts, getFestivals } from '@/lib/db/store';
import { DEFAULT_SETTINGS, formatINR } from '@/lib/config';
import ProductCard from '@/components/ProductCard';
import PromotionalBanner from '@/components/PromotionalBanner';

export const revalidate = 0; // Dynamic data

export default async function HomePage() {
  const products = await getProducts();
  const festivals = await getFestivals();

  // Today's available flowers (strictly the 5 active products)
  const availableFlowers = products.filter((p) => p.inStock);

  return (
    <div className="space-y-12 sm:space-y-20">
      <PromotionalBanner />
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-botanical-50/60 via-cream-50 to-cream-50 pt-6 sm:pt-12 pb-12 sm:pb-20 border-b border-botanical-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left copy */}
            <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-botanical-100/80 text-botanical-800 text-xs font-semibold tracking-wide border border-botanical-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Fresh Morning Delivery • Hyderabad</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-botanical-900 tracking-tight leading-[1.15]">
                Fresh Flowers for Your Home & Pooja
              </h1>

              <p className="text-stone-700 text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Fresh yellow and orange marigolds, fragrant jasmine, vibrant roses, and delicate chamanthi delivered for your daily pooja rituals, home decor, and festive celebrations.
              </p>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                <Link
                  href="/flowers"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-soft transition active:scale-95"
                >
                  <span>Browse Flowers</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/subscriptions"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-petal-50 hover:bg-petal-100 text-petal-600 border border-petal-200 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Weekly Puja Plan</span>
                </Link>
              </div>

              {/* Delivery cutoff note */}
              <div className="pt-2 flex items-center justify-center lg:justify-start gap-2 text-xs text-stone-600">
                <Clock className="w-4 h-4 text-botanical-600 shrink-0" />
                <span>
                  Order before <strong>8:00 PM</strong> for next morning delivery
                </span>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[4/3] sm:aspect-square md:aspect-[4/3] lg:aspect-square w-full max-h-[380px] sm:max-h-none rounded-3xl overflow-hidden shadow-elevated border-4 border-cream-100">
                <Image
                  src="/images/mahesh-flora-hero.png"
                  alt="Fresh marigold, jasmine, rose and chamanthi flowers at Mahesh Flora"
                  fill
                  priority
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-botanical-950/80 via-transparent to-transparent flex flex-col justify-end p-5 sm:p-6 text-cream-50">
                  <span className="text-petal-200 text-xs font-semibold uppercase tracking-wider">
                    Daily Mandir & Pooja
                  </span>
                  <h3 className="font-serif text-lg sm:text-xl font-bold">
                    Pure & Fragrant Blooms
                  </h3>
                  <p className="text-xs text-stone-200 mt-1">
                    Yellow Marigold • Orange Marigold • Mixed Marigold • Jasmine • Rose • Chamanthi
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. TODAY'S FRESH FLOWERS SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-3">
          <div>
            <div className="text-xs font-semibold text-botanical-600 uppercase tracking-wider">
              Available Daily
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 mt-1">
              Today&apos;s Available Flowers
            </h2>
          </div>
          <Link
            href="/flowers"
            className="text-sm font-semibold text-botanical-700 hover:text-botanical-900 flex items-center gap-1 group self-start sm:self-auto"
          >
            <span>View All 6 Flowers</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-8">
          {availableFlowers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 3. WEEKLY FLOWER SUBSCRIPTION SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-botanical-900 text-cream-50 rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden shadow-elevated">
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-botanical-800/40 pointer-events-none blur-2xl"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-botanical-800 text-petal-300 text-xs font-medium border border-botanical-700">
                <Calendar className="w-3.5 h-3.5" />
                <span>Zero Daily Hassle</span>
              </div>

              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-cream-50 leading-tight">
                Daily Mandir & Puja Flower Subscriptions
              </h2>

              <p className="text-sm sm:text-base text-botanical-200 leading-relaxed">
                Never miss your morning puja preparation. Choose your delivery days (e.g. Mon, Wed, Fri), your preferred flowers, and wake up to fresh morning blooms delivered before 8:30 AM.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-cream-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Choose any delivery days you want</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-cream-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Skip upcoming dates anytime</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-cream-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pause & resume with 1-click</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-cream-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No auto-deductions; clear weekly billing</span>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/subscriptions"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-petal-500 hover:bg-petal-600 text-white font-semibold text-sm transition active:scale-95 shadow-soft"
                >
                  <span>Set Up Your Subscription</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 bg-botanical-800/80 backdrop-blur-sm rounded-2xl p-5 border border-botanical-700/60 space-y-4">
              <h4 className="text-sm font-semibold text-cream-50 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-petal-400" />
                Popular Daily Puja Combo
              </h4>
              <ul className="space-y-2.5 text-xs text-botanical-200">
                <li className="flex justify-between items-center py-1.5 border-b border-botanical-700/60">
                  <span>Madurai Jasmine (100g)</span>
                  <span className="font-semibold text-cream-100">Mon, Wed, Fri</span>
                </li>
                <li className="flex justify-between items-center py-1.5 border-b border-botanical-700/60">
                  <span>Golden Marigold (250g)</span>
                  <span className="font-semibold text-cream-100">Tue, Thu, Sat</span>
                </li>
                <li className="flex justify-between items-center py-1.5">
                  <span>Mixed Flowers + Tulasi (Daily)</span>
                  <span className="font-semibold text-cream-100">Every Morning</span>
                </li>
              </ul>
              <div className="p-3 rounded-xl bg-botanical-950/60 text-[12px] text-cream-200 flex items-center justify-between">
                <span>Estimated weekly total:</span>
                <span className="font-bold text-petal-300 text-sm">~ ₹180 – ₹240</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FESTIVAL PRE-BOOKING SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-marigold-400/40 bg-gradient-to-r from-amber-50/70 via-cream-100 to-amber-50/70 rounded-3xl p-6 sm:p-10 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold-100 text-marigold-800 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-marigold-600" />
                <span>Special Occasions</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900">
                Festival Advance Pre-Bookings
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
                Reserve your pooja lotuses, deity malas, and bulk decorative marigolds before festival market shortages and price spikes.
              </p>
            </div>
            <Link
              href="/festivals"
              className="px-5 py-2.5 rounded-xl bg-marigold-500 hover:bg-marigold-600 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
            >
              <span>View All Festivals</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {festivals.slice(0, 3).map((fest) => (
              <div
                key={fest.id}
                className="bg-cream-50 rounded-2xl p-5 border border-marigold-200/60 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                    <span className="font-semibold text-botanical-800 bg-botanical-100 px-2 py-0.5 rounded">
                      {fest.festivalDate}
                    </span>
                    <span className="text-[11px] text-petal-600">
                      Book by: {fest.bookingDeadline}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-base text-botanical-900">
                    {fest.name}
                  </h3>
                  {fest.teluguName && (
                    <p className="text-xs text-botanical-700 font-medium mt-0.5">
                      {fest.teluguName}
                    </p>
                  )}
                  <p className="text-xs text-stone-600 mt-2 line-clamp-2">
                    {fest.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-cream-200 flex items-center justify-between">
                  <span className="text-xs text-stone-500">Early booking open</span>
                  <Link
                    href={`/festivals?select=${fest.id}`}
                    className="text-xs font-bold text-botanical-800 hover:text-petal-600 flex items-center gap-1"
                  >
                    <span>Reserve Kit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-semibold text-botanical-600 uppercase tracking-wider">
            Simple 3-Step Process
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900 mt-1">
            How Mahesh Flora Works
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-2">
            Freshness guaranteed through our farm-to-mandir daily supply route in Hyderabad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-cream-100/70 p-6 rounded-2xl border border-botanical-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-botanical-700 text-cream-50 flex items-center justify-center font-bold font-serif text-lg mx-auto shadow-soft">
              1
            </div>
            <h3 className="font-serif font-bold text-base text-botanical-900">
              Select Your Flowers
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Choose your required quantities of daily puja flowers or schedule your recurring weekly delivery days.
            </p>
          </div>

          <div className="bg-cream-100/70 p-6 rounded-2xl border border-botanical-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-botanical-700 text-cream-50 flex items-center justify-center font-bold font-serif text-lg mx-auto shadow-soft">
              2
            </div>
            <h3 className="font-serif font-bold text-base text-botanical-900">
              Dawn Harvest & Packing
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Every morning at 5:00 AM, our fresh arrivals are cleaned, weighed, strung into strings or packeted in breathable eco-bags.
            </p>
          </div>

          <div className="bg-cream-100/70 p-6 rounded-2xl border border-botanical-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-botanical-700 text-cream-50 flex items-center justify-center font-bold font-serif text-lg mx-auto shadow-soft">
              3
            </div>
            <h3 className="font-serif font-bold text-base text-botanical-900">
              Doorstep Handover
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Our delivery executive drops the package at your apartment door or security desk before 8:30 AM, ready for your morning prayer.
            </p>
          </div>
        </div>
      </section>



      {/* 7. WHATSAPP FAST ASSIST BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-emerald-950">
                Need customized garlands or immediate assistance?
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800">
                Speak directly with our florist family on WhatsApp for wedding garlands, satyanarayana vratam sets, or bulk orders.
              </p>
            </div>
          </div>
          <a
            href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}?text=${encodeURIComponent(
              'Hello Mahesh Flora, I would like to speak with you regarding a custom flower order.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm transition"
          >
            <span>Message on WhatsApp</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

    </div>
  );
}
