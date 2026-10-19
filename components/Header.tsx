'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Menu,
  X,
  Flower2,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  Package,
  User,
  ChevronDown,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { DEFAULT_SETTINGS } from '@/lib/config';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const { cartCount, isHydrated } = useCart();
  const { customerPhone, isAuthenticated, signOut } = useCustomerAuth();
  const pathname = usePathname();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanPhone = customerPhone?.replace(/[^0-9]/g, '').slice(-10);

  // Flipkart-inspired primary navigation links
  const primaryNavLinks = [
    { href: '/', label: 'Home' },
    { href: '/flowers', label: 'Flowers' },
    { href: '/subscriptions', label: 'Weekly Subscription' },
    { href: '/festivals', label: 'Festivals' },
  ];

  const isActive = (path: string) => {
    if (!pathname) return path === '/';
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setAccountDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setAccountDropdownOpen(false);
    }, 150);
  };

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Close menus on route change
  useEffect(() => {
    setAccountDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed:', err);
    } finally {
      setAccountDropdownOpen(false);
      setMobileMenuOpen(false);
    }
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
            {primaryNavLinks.map((link) => (
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

            {/* Account / Profile Dropdown (Flipkart inspired) */}
            <div
              className="relative"
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setAccountDropdownOpen(true);
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${
                  accountDropdownOpen || isActive('/orders')
                    ? 'text-botanical-900 bg-botanical-100/70 font-semibold'
                    : 'text-stone-600 hover:text-botanical-800 hover:bg-cream-200/50'
                }`}
                aria-haspopup="menu"
                aria-expanded={accountDropdownOpen}
                aria-label="Account and Profile Menu"
              >
                <div className="w-5 h-5 rounded-full bg-botanical-100 text-botanical-800 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span>
                  {isAuthenticated && cleanPhone ? `+91 ${cleanPhone.slice(0, 5)}...` : 'Account'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    accountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              <div
                aria-label="Account options"
                className={`absolute right-0 sm:left-0 sm:right-auto mt-2 w-64 bg-cream-50 rounded-2xl shadow-elevated border border-botanical-200/80 p-2 z-50 transition-all duration-150 origin-top ${
                  accountDropdownOpen
                    ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                    : 'opacity-0 invisible -translate-y-2 pointer-events-none'
                }`}
              >
                {/* Flipkart-style top triangle pointer */}
                <div className="absolute -top-1.5 left-6 w-3 h-3 bg-cream-50 border-t border-l border-botanical-200/80 rotate-45 pointer-events-none" />

                {/* Header Profile / Welcome section */}
                {isAuthenticated ? (
                  <div className="p-3 bg-gradient-to-br from-botanical-100/70 to-cream-100 rounded-xl mb-1.5 border border-botanical-200/60 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-botanical-700 text-cream-50 flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                      {cleanPhone ? cleanPhone.slice(-2) : 'MF'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-botanical-900 truncate">
                        +91 {cleanPhone || 'Customer'}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Verified Customer
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gradient-to-br from-botanical-100/60 to-cream-100 rounded-xl mb-1.5 border border-botanical-200/60">
                    <div className="flex items-center justify-between text-xs text-botanical-900 font-medium mb-1.5">
                      <span>Welcome to Mahesh Flora</span>
                    </div>
                    <Link
                      href="/orders"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition active:scale-95"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login / Sign Up</span>
                    </Link>
                  </div>
                )}

                {/* Dropdown Items List */}
                <div className="space-y-0.5">
                  {isAuthenticated && (
                    <Link
                      href="/orders"
                      onClick={() => setAccountDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                        isActive('/orders')
                          ? 'bg-botanical-100/80 text-botanical-900 font-semibold'
                          : 'text-stone-700 hover:bg-botanical-100/60 hover:text-botanical-900'
                      }`}
                    >
                      <User className="w-4 h-4 text-botanical-700 shrink-0" />
                      <span>My Profile</span>
                    </Link>
                  )}

                  <Link
                    href="/orders"
                    onClick={() => setAccountDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive('/orders')
                        ? 'bg-botanical-100/80 text-botanical-900 font-semibold'
                        : 'text-stone-700 hover:bg-botanical-100/60 hover:text-botanical-900'
                    }`}
                  >
                    <Package className="w-4 h-4 text-botanical-700 shrink-0" />
                    <span>My Orders</span>
                  </Link>

                  <Link
                    href="/subscriptions"
                    onClick={() => setAccountDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive('/subscriptions')
                        ? 'bg-botanical-100/80 text-botanical-900 font-semibold'
                        : 'text-stone-700 hover:bg-botanical-100/60 hover:text-botanical-900'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-botanical-700 shrink-0" />
                    <span>My Subscriptions</span>
                  </Link>

                  <Link
                    href="/festivals"
                    onClick={() => setAccountDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive('/festivals')
                        ? 'bg-botanical-100/80 text-botanical-900 font-semibold'
                        : 'text-stone-700 hover:bg-botanical-100/60 hover:text-botanical-900'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-marigold-500 shrink-0" />
                    <span>My Festival Bookings</span>
                  </Link>

                  {/* Divider */}
                  <div className="my-1 border-t border-botanical-200/60" />

                  <Link
                    href="/admin"
                    onClick={() => setAccountDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive('/admin')
                        ? 'bg-botanical-100/80 text-botanical-900 font-semibold'
                        : 'text-stone-700 hover:bg-botanical-100/60 hover:text-botanical-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-botanical-700 shrink-0" />
                    <span>Admin Login</span>
                  </Link>

                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
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
          {/* Main Navigation Links */}
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
          </div>

          {/* Account / Profile Section (Mobile Flipkart style) */}
          <div className="mt-4 pt-3 border-t border-botanical-200/80 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-botanical-700 flex items-center justify-between">
              <span>Account & Profile</span>
              {isAuthenticated && cleanPhone && (
                <span className="text-[10px] bg-botanical-100 text-botanical-800 px-2 py-0.5 rounded-full font-semibold">
                  +91 {cleanPhone}
                </span>
              )}
            </div>

            {isAuthenticated ? (
              <>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/orders') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <User className="w-4 h-4 text-botanical-700" />
                  <span>My Profile</span>
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/orders') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Package className="w-4 h-4 text-botanical-700" />
                  <span>My Orders</span>
                </Link>
                <Link
                  href="/subscriptions"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/subscriptions') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-botanical-700" />
                  <span>My Subscriptions</span>
                </Link>
                <Link
                  href="/festivals"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/festivals') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-marigold-500" />
                  <span>My Festival Bookings</span>
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/admin') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-botanical-700" />
                  <span>Admin Login</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-700 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-sm shadow-soft"
                >
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    <span>Login / Sign Up</span>
                  </span>
                  <span className="text-[11px] text-cream-200 font-normal">Phone OTP</span>
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/orders') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Package className="w-4 h-4 text-botanical-700" />
                  <span>My Orders</span>
                </Link>
                <Link
                  href="/subscriptions"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/subscriptions') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-botanical-700" />
                  <span>My Subscriptions</span>
                </Link>
                <Link
                  href="/festivals"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/festivals') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-marigold-500" />
                  <span>My Festival Bookings</span>
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive('/admin') ? 'bg-botanical-100 font-semibold text-botanical-900' : 'text-stone-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-botanical-700" />
                  <span>Admin Login</span>
                </Link>
              </>
            )}
          </div>

          {/* WhatsApp Contact Bar */}
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
