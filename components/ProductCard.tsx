'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Minus, ShoppingBag, Check } from 'lucide-react';
import { Product } from '@/types';
import { formatINR } from '@/lib/config';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, items, updateQuantity } = useCart();
  const [selectedQty, setSelectedQty] = useState(1);
  const [addedJustNow, setAddedJustNow] = useState(false);
  const [hasImgError, setHasImgError] = useState(false);

  // Check if item is already in cart
  const cartItem = items.find((i) => i.productId === product.id);

  const handleAddToCart = () => {
    if (!product.inStock) return;
    addItem(product, selectedQty);
    setAddedJustNow(true);
    setTimeout(() => setAddedJustNow(false), 1400);
  };

  const handleIncrement = () => {
    if (cartItem) {
      updateQuantity(product.id, cartItem.quantity + 1);
    } else {
      setSelectedQty((q) => q + 1);
    }
  };

  const handleDecrement = () => {
    if (cartItem) {
      updateQuantity(product.id, cartItem.quantity - 1);
    } else {
      setSelectedQty((q) => Math.max(1, q - 1));
    }
  };

  return (
    <div className="bg-cream-100/80 rounded-2xl border border-botanical-100 overflow-hidden shadow-soft hover:shadow-elevated transition-all flex flex-col h-full group">
      
      {/* Product Image */}
      <div
        className="relative w-full overflow-hidden bg-cream-200 shrink-0"
        style={{ width: '100%', aspectRatio: '4 / 3' }}
      >
        {hasImgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-cream-200 text-botanical-800 p-4 text-center">
            <ShoppingBag className="w-8 h-8 text-botanical-500 mb-1 opacity-60" />
            <span className="text-xs font-semibold">{product.name}</span>
          </div>
        ) : (
          <Image
            src={product.imageUrl}
            alt={`Fresh ${product.name} flowers for daily pooja and home decor - Mahesh Flora`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => {
              // Mark error without showing an unrelated flower
              setHasImgError(true);
            }}
          />
        )}

        {/* Stock & Popular Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
          {product.isPopular && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-petal-500 text-white shadow-sm">
              Popular
            </span>
          )}
          {!product.inStock && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-800 text-cream-50 shadow-sm">
              Out of Stock
            </span>
          )}
        </div>

        {/* Telugu Local Name Badge */}
        {product.teluguName && (
          <div className="absolute bottom-2 left-2.5 bg-botanical-900/80 backdrop-blur-sm text-cream-100 text-[11px] font-medium px-2 py-0.5 rounded-md">
            {product.teluguName}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3.5 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-serif font-bold text-sm sm:text-base md:text-lg text-botanical-900 group-hover:text-botanical-700 transition leading-snug line-clamp-1">
            {product.name}
          </h3>
          <p className="text-[11px] sm:text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="mt-3 sm:mt-4 pt-3 border-t border-botanical-100/60">
          {/* Price and Unit */}
          <div className="flex items-baseline justify-between mb-2.5 sm:mb-3">
            <div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-botanical-900">
                {formatINR(product.pricePaise)}
              </span>
              <span className="text-[11px] sm:text-xs text-stone-500 ml-1">
                / {product.unit}
              </span>
            </div>
            {product.inStock ? (
              <span className="text-[10px] sm:text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Fresh Harvest
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-medium text-stone-500">
                Unavailable
              </span>
            )}
          </div>

          {/* Action Row */}
          {cartItem ? (
            <div className="flex items-center justify-between bg-botanical-100 rounded-xl p-1">
              <button
                type="button"
                onClick={handleDecrement}
                aria-label={`Decrease quantity of ${product.name}`}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cream-50 text-botanical-800 flex items-center justify-center hover:bg-cream-200 transition active:scale-95 shadow-xs"
              >
                <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <div className="text-center font-bold text-xs sm:text-sm text-botanical-900 px-1 sm:px-2 truncate">
                {cartItem.quantity} in cart
              </div>
              <button
                type="button"
                onClick={handleIncrement}
                aria-label={`Increase quantity of ${product.name}`}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cream-50 text-botanical-800 flex items-center justify-center hover:bg-cream-200 transition active:scale-95 shadow-xs"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Stepper for selecting initial quantity */}
              {product.inStock && (
                <div className="flex items-center border border-botanical-200 rounded-xl bg-cream-50 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="p-1.5 sm:p-2 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/50 transition"
                  >
                    <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <span className="px-1.5 sm:px-2 text-xs font-semibold text-botanical-900 min-w-4 sm:min-w-5 text-center">
                    {selectedQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => q + 1)}
                    aria-label="Increase quantity"
                    className="p-1.5 sm:p-2 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/50 transition"
                  >
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              )}

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!product.inStock}
                aria-label={`Add ${product.name} to cart`}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition active:scale-95 shadow-sm truncate ${
                  !product.inStock
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : addedJustNow
                    ? 'bg-emerald-600 text-white'
                    : 'bg-botanical-700 hover:bg-botanical-800 text-cream-50'
                }`}
              >
                {addedJustNow ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden sm:inline">{product.inStock ? 'Add to Cart' : 'Sold Out'}</span>
                    <span className="inline sm:hidden">{product.inStock ? 'Add' : 'Sold'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
