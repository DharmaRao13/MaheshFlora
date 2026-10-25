'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Truck, Tag, X } from 'lucide-react';
import { formatINR } from '@/lib/config';

interface PromoData {
  id: string;
  title: string;
  type: string;
  minOrderAmountPaise: number;
  bannerWording?: string;
}

export default function PromotionalBanner() {
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const p = fetch('/api/promotions/active');
      if (p && typeof p.then === 'function') {
        p.then((res) => (res && typeof res.json === 'function' && res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.active && data.promotion) {
              setPromo(data.promotion);
            } else {
              setPromo(null);
            }
          })
          .catch(() => setPromo(null));
      }
    } catch {
      setPromo(null);
    }
  }, []);

  if (!promo || isDismissed) return null;

  const defaultText =
    promo.type === 'first_time_customers'
      ? '🎉 Special Offer: Free morning delivery on your first flower order!'
      : promo.type === 'first_n_orders'
      ? '⚡ Early Bird Special: Free morning delivery for today’s early orders!'
      : '🚚 Free delivery on all fresh puja flower deliveries!';

  const displayText = promo.bannerWording || promo.title || defaultText;

  return (
    <div className="bg-gradient-to-r from-emerald-800 via-botanical-800 to-emerald-900 text-cream-50 px-4 py-2.5 shadow-sm border-b border-emerald-700/60 relative animate-fade-in">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
          <span className="p-1 rounded-full bg-saffron-400 text-botanical-950 font-bold shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span className="font-semibold text-cream-50">{displayText}</span>
          {promo.minOrderAmountPaise > 0 && (
            <span className="hidden md:inline-block text-xs bg-emerald-700/70 border border-emerald-500/40 px-2 py-0.5 rounded-full text-cream-100">
              Min order {formatINR(promo.minOrderAmountPaise)}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition shrink-0"
          aria-label="Dismiss offer banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
