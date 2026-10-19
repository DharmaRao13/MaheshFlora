'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Flower2,
  Sparkles,
  User,
  Calendar,
  Package,
  ShieldCheck,
  LogOut,
  LogIn,
  Phone,
  ArrowRight,
  MapPin,
  X,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { maskPhoneNumber } from '@/lib/business';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, customerPhone, isAuthenticated, signOut } = useCustomerAuth();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [savedCustomerName, setSavedCustomerName] = useState<string | null>(null);

  const cleanPhone = customerPhone?.replace(/[^0-9]/g, '').slice(-10);
  const maskedPhone = maskPhoneNumber(customerPhone);
  const displayName = user?.displayName || savedCustomerName;

  useEffect(() => {
    try {
      const name = localStorage.getItem('mahesh_customer_name');
      if (name) setSavedCustomerName(name);
    } catch {}
  }, [isAuthenticated]);

  // Listen to open-mobile-account-sheet custom events from Header or other controls
  useEffect(() => {
    const handleOpen = () => setAccountSheetOpen(true);
    window.addEventListener('open-mobile-account-sheet', handleOpen);
    return () => window.removeEventListener('open-mobile-account-sheet', handleOpen);
  }, []);

  // Close sheet on route changes
  useEffect(() => {
    setAccountSheetOpen(false);
  }, [pathname]);

  // Hide on admin routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const isActive = (path: string) => {
    if (!pathname) return path === '/';
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed:', err);
    } finally {
      setAccountSheetOpen(false);
    }
  };

  return (
    <>
      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream-50/95 backdrop-blur-md border-t border-botanical-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] pt-1"
      >
        <div className="grid grid-cols-4 items-center max-w-md mx-auto px-2">
          
          {/* Tab 1: Home */}
          <Link
            href="/"
            className={`min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition active:scale-95 ${
              isActive('/')
                ? 'text-botanical-900 font-bold'
                : 'text-stone-500 hover:text-botanical-800'
            }`}
          >
            <div className={`p-1 rounded-full ${isActive('/') ? 'bg-botanical-100 text-botanical-800' : ''}`}>
              <Home className="w-5 h-5" />
            </div>
            <span>Home</span>
          </Link>

          {/* Tab 2: Flowers */}
          <Link
            href="/flowers"
            className={`min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition active:scale-95 ${
              isActive('/flowers')
                ? 'text-botanical-900 font-bold'
                : 'text-stone-500 hover:text-botanical-800'
            }`}
          >
            <div className={`p-1 rounded-full ${isActive('/flowers') ? 'bg-botanical-100 text-botanical-800' : ''}`}>
              <Flower2 className="w-5 h-5" />
            </div>
            <span>Flowers</span>
          </Link>

          {/* Tab 3: Festivals */}
          <Link
            href="/festivals"
            className={`min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition active:scale-95 ${
              isActive('/festivals')
                ? 'text-botanical-900 font-bold'
                : 'text-stone-500 hover:text-botanical-800'
            }`}
          >
            <div className={`p-1 rounded-full ${isActive('/festivals') ? 'bg-botanical-100 text-marigold-600' : ''}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span>Festivals</span>
          </Link>

          {/* Tab 4: Account */}
          <button
            type="button"
            onClick={() => setAccountSheetOpen(true)}
            className={`min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition active:scale-95 ${
              accountSheetOpen || isActive('/orders') || isActive('/addresses')
                ? 'text-botanical-900 font-bold'
                : 'text-stone-500 hover:text-botanical-800'
            }`}
            aria-label="Open Account Menu"
          >
            <div className={`p-1 rounded-full ${accountSheetOpen || isActive('/orders') || isActive('/addresses') ? 'bg-botanical-100 text-botanical-800' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span>Account</span>
          </button>
        </div>
      </nav>

      {/* Mobile Account Bottom Sheet Modal */}
      {accountSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setAccountSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account Sheet"
            className="relative z-50 bg-cream-50 rounded-t-3xl border-t border-botanical-200/90 shadow-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            {/* Grab Bar */}
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto" />

            {/* Header with Title and Close button */}
            <div className="flex items-center justify-between pb-2 border-b border-botanical-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-botanical-700 text-cream-50 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                  {displayName ? displayName.slice(0, 2) : cleanPhone ? cleanPhone.slice(-2) : <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-base text-botanical-900 truncate">
                    {isAuthenticated ? (displayName || (cleanPhone ? `+91 ${cleanPhone}` : 'Verified Customer')) : 'My Account'}
                  </h3>
                  {isAuthenticated ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Verified Customer</span>
                      {maskedPhone && <span className="text-stone-500 font-mono">({maskedPhone})</span>}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500">Manage your orders and subscriptions</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountSheetOpen(false)}
                className="p-1.5 rounded-full text-stone-500 hover:bg-cream-200 transition"
                aria-label="Close account menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Logged Out / In Action Box */}
            {!isAuthenticated ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-botanical-100/80 to-cream-100 border border-botanical-200/70 space-y-2.5">
                <div>
                  <p className="text-xs font-bold text-botanical-900">Sign in with Mobile OTP</p>
                  <p className="text-[11px] text-stone-600">Track active orders and manage flower deliveries easily.</p>
                </div>
                <Link
                  href="/orders"
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-xs shadow-soft transition active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login / Sign Up</span>
                </Link>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Customer Session
                </span>
                <span className="text-[11px] text-emerald-700 font-mono">{maskedPhone || cleanPhone}</span>
              </div>
            )}

            {/* Menu Links */}
            <div className="space-y-1">
              {isAuthenticated && (
                <Link
                  href="/orders"
                  onClick={() => setAccountSheetOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                    isActive('/orders') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                  }`}
                >
                  <User className="w-4 h-4 text-botanical-700" />
                  <span>My Profile</span>
                </Link>
              )}

              <Link
                href="/orders"
                onClick={() => setAccountSheetOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                  isActive('/orders') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                }`}
              >
                <Package className="w-4 h-4 text-botanical-700" />
                <span>My Orders</span>
              </Link>

              {isAuthenticated && (
                <Link
                  href="/addresses"
                  onClick={() => setAccountSheetOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                    isActive('/addresses') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-botanical-700" />
                  <span>Saved Addresses</span>
                </Link>
              )}

              <Link
                href="/subscriptions"
                onClick={() => setAccountSheetOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                  isActive('/subscriptions') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                }`}
              >
                <Calendar className="w-4 h-4 text-botanical-700" />
                <span>My Subscriptions</span>
              </Link>

              <Link
                href="/festivals"
                onClick={() => setAccountSheetOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                  isActive('/festivals') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                }`}
              >
                <Sparkles className="w-4 h-4 text-marigold-500" />
                <span>My Festival Bookings</span>
              </Link>

              <div className="my-1.5 border-t border-botanical-200/60" />

              <Link
                href="/admin"
                onClick={() => setAccountSheetOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                  isActive('/admin') ? 'bg-botanical-100 text-botanical-900 font-semibold' : 'text-stone-700 hover:bg-cream-200/60'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-botanical-700" />
                <span>Admin Login</span>
              </Link>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50 transition text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            {/* WhatsApp Contact Bar */}
            <div className="pt-2 border-t border-botanical-100">
              <a
                href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}?text=${encodeURIComponent(
                  'Hello Mahesh Flora, I would like to inquire about fresh flower delivery in Hyderabad.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition text-xs sm:text-sm"
              >
                <Phone className="w-4 h-4" />
                <span>WhatsApp: {DEFAULT_SETTINGS.businessPhone}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
