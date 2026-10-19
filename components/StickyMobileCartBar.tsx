'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatINR } from '@/lib/config';

export default function StickyMobileCartBar() {
  const { cartCount, totalPaise, isHydrated } = useCart();
  const pathname = usePathname();

  // Don't show bar on cart or checkout pages or admin
  if (!isHydrated || cartCount === 0 || pathname === '/cart' || pathname === '/checkout' || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <aside
      aria-label="Mobile cart checkout"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-cream-50/95 backdrop-blur-md border-t border-botanical-200 shadow-elevated"
    >
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-botanical-100 flex items-center justify-center text-botanical-800 shrink-0 relative">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 bg-petal-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">
              {cartCount} {cartCount === 1 ? 'item' : 'items'} in cart
            </div>
            <div className="text-sm font-bold text-botanical-900">
              {formatINR(totalPaise)}
            </div>
          </div>
        </div>

        <Link
          href="/cart"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-botanical-700 text-cream-50 font-semibold text-xs hover:bg-botanical-800 transition active:scale-95 shadow-soft"
        >
          <span>View Cart</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
}
