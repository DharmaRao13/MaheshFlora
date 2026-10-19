'use client';

import React, { useState } from 'react';
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
  X,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { DEFAULT_SETTINGS } from '@/lib/config';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { customerPhone, isAuthenticated, signOut } = useCustomerAuth();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const cleanPhone = customerPhone?.replace(/[^0-9]/g, '').slice(-10);

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
              accountSheetOpen || isActive('/orders')
                ? 'text-botanical-900 font-bold'
                : 'text-stone-500 hover:text-botanical-800'
            }`}
            aria-label="Open Account Menu"
          >
            <div className={`p-1 rounded-full ${accountSheetOpen || isActive('/orders') ? 'bg-botanical-100 text-botanical-800' : ''}`}>
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
                <div className="w-8 h-8 rounded-full bg-botanical-700 text-cream-50 flex items-center justify-center font-bold text-xs">
                  {isAuthenticated && cleanPhone ? cleanPhone.slice(-2) : <User className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-botanical-900">
                    {isAuthenticated ? `+91 ${cleanPhone}` : 'My Account'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isAuthenticated ? 'Verified Customer' : 'Manage your orders and subscriptions'}
                  </p>
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
                <span className="text-[11px] text-emerald-700 font-mono">+91 {cleanPhone}</span>
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

              {/* Weekly Subscription Highlight Card */}
              <div className="pt-2">
                <Link
                  href="/subscriptions"
                  onClick={() => setAccountSheetOpen(false)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-petal-50 via-cream-100 to-botanical-50 border border-petal-200 text-xs shadow-soft transition active:scale-95"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-petal-600 shrink-0" />
                    <div>
                      <p className="font-bold text-botanical-900">Weekly Puja Subscription</p>
                      <p className="text-[10px] text-stone-500">Scheduled fresh morning deliveries</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-petal-600" />
                </Link>
              </div>

              {/* Admin Divider & Link */}
              <div className="my-2 border-t border-botanical-200/70" />

              <Link
                href="/admin"
                onClick={() => setAccountSheetOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-cream-200/60 transition"
              >
                <ShieldCheck className="w-4 h-4 text-botanical-700" />
                <span>Admin Login</span>
              </Link>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50 transition text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            {/* WhatsApp Support Button */}
            <div className="pt-2">
              <a
                href={`https://wa.me/${DEFAULT_SETTINGS.whatsappNumber}?text=${encodeURIComponent(
                  'Hello Mahesh Flora, I need assistance with my account or flower delivery.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-medium text-xs shadow-sm hover:bg-emerald-700 transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Need Help? Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
