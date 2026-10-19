'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { Product, ProductCategory, DailyPriceRecord } from '@/types';
import ProductCard from '@/components/ProductCard';
import { subscribeToDailyPrices } from '@/lib/firebase/client';

interface Props {
  initialProducts: Product[];
}

export default function FlowerCatalogueClient({ initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyDailyPricesRecord = (record: DailyPriceRecord) => {
    if (record && record.items) {
      if (record.publishedAt) {
        setLastPublishedAt(record.publishedAt);
      }
      setProducts((prev) =>
        prev.map((p) => {
          const item = record.items[p.id];
          if (item) {
            return {
              ...p,
              pricePaise: item.pricePaise,
              inStock: item.inStock,
              unit: item.unit || p.unit,
            };
          }
          return p;
        })
      );
    }
  };

  const fetchDailyPrices = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/daily-prices', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const record: DailyPriceRecord | undefined = data.dailyPrices;
        if (record) {
          applyDailyPricesRecord(record);
        }
      }
    } catch (err) {
      console.error('Failed to load fresh daily prices', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDailyPrices();

    // Real-time Firestore subscription (active when Firebase is configured)
    const unsubscribe = subscribeToDailyPrices((record) => {
      if (record) {
        applyDailyPricesRecord(record);
      }
    });

    // Periodically re-sync every 60 seconds as fallback
    const interval = setInterval(fetchDailyPrices, 60000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All 6 Flowers' },
    { id: 'marigold', label: 'Marigold Varieties' },
    { id: 'jasmine', label: 'Jasmine' },
    { id: 'rose', label: 'Rose' },
    { id: 'chamanthi', label: 'Chamanthi' },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category / Type filter
      if (selectedCategory === 'marigold') {
        if (!product.id.includes('marigold')) return false;
      } else if (selectedCategory === 'jasmine') {
        if (!product.id.includes('jasmine')) return false;
      } else if (selectedCategory === 'rose') {
        if (!product.id.includes('rose')) return false;
      } else if (selectedCategory === 'chamanthi') {
        if (!product.id.includes('chamanthi')) return false;
      } else if (selectedCategory !== 'all') {
        if (product.category !== selectedCategory) return false;
      }

      // Stock filter
      if (showInStockOnly && !product.inStock) {
        return false;
      }

      // Search query (matches English name, Telugu name, or description)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesTelugu = product.teluguName?.toLowerCase().includes(query);
        const matchesDesc = product.description.toLowerCase().includes(query);
        return matchesName || matchesTelugu || matchesDesc;
      }

      return true;
    });
  }, [products, selectedCategory, showInStockOnly, searchQuery]);

  return (
    <div className="space-y-6">

      {/* Filter and Search Bar */}
      <div className="bg-cream-100/70 p-4 rounded-2xl border border-botanical-100 shadow-soft space-y-4">
        
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search available flowers (Yellow Marigold, Orange Marigold, Jasmine, Rose, Chamanthi)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-botanical-200 bg-cream-50 text-sm text-botanical-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-botanical-500 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                selectedCategory === cat.id
                  ? 'bg-botanical-700 text-cream-50 shadow-xs'
                  : 'bg-cream-50 text-stone-700 border border-botanical-200/70 hover:bg-cream-200/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* In-Stock count and Market Rates Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 pt-2 border-t border-botanical-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing {filteredProducts.length} varieties</span>
            {lastPublishedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] text-botanical-700 bg-botanical-100/60 px-2 py-0.5 rounded-md font-medium">
                <Clock className="w-3 h-3 text-botanical-600" />
                <span>Today&apos;s Rates (Updated {new Date(lastPublishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchDailyPrices}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-botanical-800 transition"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-botanical-600' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Live Rates'}</span>
          </button>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-cream-100/50 rounded-3xl border border-botanical-100 p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-botanical-100 text-botanical-700 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-lg text-botanical-900">
            No flowers found
          </h3>
          <p className="text-xs text-stone-600">
            We couldn&apos;t find any flowers matching &quot;{searchQuery}&quot;. Try adjusting your search term or clearing the filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setShowInStockOnly(false);
            }}
            className="px-4 py-2 rounded-xl bg-botanical-700 text-cream-50 text-xs font-semibold hover:bg-botanical-800 transition"
          >
            Clear all filters
          </button>
        </div>
      )}

    </div>
  );
}
