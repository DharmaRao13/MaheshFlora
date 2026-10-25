import React, { Suspense } from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import { getProducts } from '@/lib/db/store';
import FlowerCatalogueClient from './FlowerCatalogueClient';
import PromotionalBanner from '@/components/PromotionalBanner';

export const revalidate = 0; // Dynamic server fetch

export default async function FlowersPage() {
  const allProducts = await getProducts();
  const availableProducts = allProducts.filter((p) => p.inStock);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <PromotionalBanner />
      <div className="mb-6 sm:mb-8 text-center sm:text-left">
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-botanical-900 tracking-tight">
          Fresh Flower Catalogue
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
          Handpicked fresh puja flowers sourced daily from local Telangana farms for gated communities across Hyderabad.
        </p>
      </div>

      {/* Accessible Weekly Subscription Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-botanical-100/90 via-cream-100 to-petal-50 border border-botanical-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-botanical-700 text-cream-50 flex items-center justify-center shrink-0 shadow-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm sm:text-base text-botanical-900">
              Need Fresh Flowers Delivered Every Morning?
            </h2>
            <p className="text-xs text-stone-600">
              Set up a hassle-free Weekly Subscription plan tailored to your daily puja schedule.
            </p>
          </div>
        </div>
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 text-xs font-semibold shadow-soft transition active:scale-95 shrink-0"
        >
          <span>Explore Weekly Plans</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Loading flower catalogue...</div>}>
        <FlowerCatalogueClient initialProducts={availableProducts} />
      </Suspense>
    </div>
  );
}
