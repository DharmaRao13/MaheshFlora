'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Menu, X, Flower2, Phone, Calendar, Sparkles, ShieldCheck, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { DEFAULT_SETTINGS } from '@/lib/config';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { cartCount, isHydrated } = useCart();
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/flowers', label: 'Flowers' },
    { href: '/subscriptions', label: 'Weekly Subscription' },
    { href: '/festivals', label: 'Festivals' },
    { href: '/orders', label: 'My Orders' },
    { href: '/admin', label: 'Admin' },
  ];

  const isActive = (path: string) => {
    if (!pathname) return path === '/';
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur-md border-b border-botanical-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-full bg-botanical-700 flex items-center justify-center text-cream-50 shadow-soft group-hover:bg-botanical-800 transition">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl sm:text-2xl text-botanical-900 tracking-tight block leading-tight">
                Mahesh Flora
              </span>
              <span className="text-[10px] sm:text-xs text-botanical-600 tracking-wider uppercase font-medium block">
                Fresh Flowers • Hyderabad
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(link.href)
                    ? 'text-botanical-900 bg-botanical-100/70 font-semibold'
                    : 'text-stone-600 hover:text-botanical-800 hover:bg-cream-200/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* WhatsApp Quick Chat */}
            <a
              href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}?text=${encodeURIComponent(
                'Hello Mahesh Flora, I have an inquiry regarding flower delivery.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Contact on WhatsApp"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition shadow-sm"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            {/* Cart Link */}
            <Link
              href="/cart"
              className="relative p-2.5 sm:px-3 sm:py-2 rounded-xl text-botanical-900 bg-botanical-100/60 hover:bg-botanical-200/70 transition flex items-center gap-2"
              aria-label="View Cart"
            >
              <ShoppingBag className="w-5 h-5 text-botanical-700" />
              <span className="hidden sm:inline text-xs font-semibold text-botanical-800">Cart</span>
              {isHydrated && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-petal-500 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-botanical-800 hover:bg-cream-200/80 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-botanical-100 bg-cream-50 px-4 pt-3 pb-6 shadow-elevated">
          <div className="flex flex-col space-y-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <Flower2 className="w-4 h-4 text-botanical-700" />
              Home
            </Link>
            <Link
              href="/flowers"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/flowers') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <Flower2 className="w-4 h-4 text-botanical-700" />
              Flower Catalogue
            </Link>
            <Link
              href="/subscriptions"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/subscriptions') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <Calendar className="w-4 h-4 text-botanical-700" />
              Weekly Subscription
            </Link>
            <Link
              href="/festivals"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/festivals') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-marigold-500" />
              Festival Pre-Booking
            </Link>
            <Link
              href="/orders"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/orders') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <Package className="w-4 h-4 text-botanical-700" />
              My Orders & Tracking
            </Link>
            <Link
              href="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-base text-stone-700"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-botanical-700" />
                Shopping Cart
              </span>
              {cartCount > 0 && (
                <span className="bg-petal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {cartCount} items
                </span>
              )}
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base ${
                isActive('/admin') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-botanical-700" />
              Store Admin
            </Link>
          </div>

          <div className="mt-4 pt-3 border-t border-botanical-100">
            <a
              href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}?text=${encodeURIComponent(
                'Hello Mahesh Flora, I would like to inquire about fresh flower delivery in Hyderabad.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition"
            >
              <Phone className="w-4 h-4" />
              <span>Chat on WhatsApp: {DEFAULT_SETTINGS.businessPhone}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
