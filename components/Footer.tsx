import React from 'react';
import Link from 'next/link';
import { Flower2, MapPin, Phone, Clock, Truck, ShieldCheck, Heart } from 'lucide-react';
import { DEFAULT_SETTINGS } from '@/lib/config';

export default function Footer() {
  return (
    <footer className="bg-botanical-900 text-cream-100 border-t border-botanical-800 mt-auto">
      {/* Trust bar */}
      <div className="border-b border-botanical-800/80 bg-botanical-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded-full bg-botanical-700/60 flex items-center justify-center text-cream-200 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cream-50">Morning Altar Delivery</h4>
                <p className="text-xs text-botanical-200">6:00 AM – 8:30 AM before morning puja</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded-full bg-botanical-700/60 flex items-center justify-center text-cream-200 shrink-0">
                <Flower2 className="w-5 h-5 text-petal-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cream-50">Farm Fresh Daily</h4>
                <p className="text-xs text-botanical-200">Handpicked blooms directly from local growers</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded-full bg-botanical-700/60 flex items-center justify-center text-cream-200 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cream-50">Apartment Doorstep Drop</h4>
                <p className="text-xs text-botanical-200">Gated communities across West Hyderabad</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cream-50 text-botanical-900 flex items-center justify-center">
                <Flower2 className="w-4 h-4" />
              </div>
              <span className="font-serif font-bold text-xl text-cream-50">
                {DEFAULT_SETTINGS.businessName}
              </span>
            </div>
            <p className="text-xs text-botanical-200 leading-relaxed">
              A local family-run flower delivery service starting in Hyderabad, bringing farm-fresh daily puja flowers and temple garlands directly to your doorstep.
            </p>
            <div className="pt-2">
              <span className="inline-block text-[11px] bg-botanical-800 text-botanical-200 px-3 py-1 rounded-full border border-botanical-700">
                Fresh Farm Harvest • Hyderabad
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm text-cream-50 mb-3 tracking-wide uppercase text-xs">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-botanical-200">
              <li>
                <Link href="/" className="hover:text-cream-50 transition">Home</Link>
              </li>
              <li>
                <Link href="/flowers" className="hover:text-cream-50 transition">Fresh Flower Catalogue</Link>
              </li>
              <li>
                <Link href="/subscriptions" className="hover:text-cream-50 transition">Weekly Puja Subscription</Link>
              </li>
              <li>
                <Link href="/festivals" className="hover:text-cream-50 transition">Festival Advance Booking</Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-cream-50 transition">My Orders & Tracking</Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-cream-50 transition">Shopping Cart</Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-cream-50 transition">Store Administration</Link>
              </li>
            </ul>
          </div>

          {/* Store Hours & Delivery */}
          <div>
            <h4 className="font-semibold text-sm text-cream-50 mb-3 tracking-wide uppercase text-xs">
              Store Timings & Cutoff
            </h4>
            <div className="space-y-2.5 text-xs text-botanical-200">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-cream-200 shrink-0 mt-0.5" />
                <span>{DEFAULT_SETTINGS.openingHoursText}</span>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-cream-200 shrink-0 mt-0.5" />
                <span>
                  Order before <strong>8:00 PM</strong> for next morning delivery (6:00 AM – 8:30 AM).
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="font-semibold text-sm text-cream-50 mb-3 tracking-wide uppercase text-xs">
              Visit or Contact Us
            </h4>
            <div className="space-y-2.5 text-xs text-botanical-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-cream-200 shrink-0 mt-0.5" />
                <span>{DEFAULT_SETTINGS.addressText}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-cream-200 shrink-0" />
                <a href={`tel:${DEFAULT_SETTINGS.businessPhone}`} className="hover:text-cream-50 transition">
                  {DEFAULT_SETTINGS.businessPhone}
                </a>
              </div>
              <div className="pt-2">
                <a
                  href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-700/70 text-cream-50 hover:bg-emerald-600 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp Helpdesk</span>
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-botanical-800 text-center text-[11px] text-botanical-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {DEFAULT_SETTINGS.businessName}. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Carefully cultivated with <Heart className="w-3 h-3 text-petal-400 fill-petal-400" /> for Hyderabad homes.
          </p>
        </div>
      </div>
    </footer>
  );
}
