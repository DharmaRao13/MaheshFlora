'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatINR } from '@/lib/config';

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise,
    amountNeededForFreeDeliveryPaise,
    freeDeliveryThresholdPaise,
    isHydrated,
  } = useCart();

  if (!isHydrated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-botanical-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm text-stone-600">Loading your flower basket...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-botanical-100 flex items-center justify-center text-botanical-700 mx-auto shadow-soft">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900">
            Your Cart is Empty
          </h1>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            You haven&apos;t added any fresh blooms yet. Browse our daily harvest to select fresh jasmine, marigold, or sacred lotuses for your altar.
          </p>
        </div>
        <div>
          <Link
            href="/flowers"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-sm shadow-soft transition active:scale-95"
          >
            <span>Browse Flower Catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Calculate free delivery progress percentage
  const freeDeliveryPercent = Math.min(
    100,
    Math.round((subtotalPaise / freeDeliveryThresholdPaise) * 100)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-botanical-100">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-botanical-900">
            Your Flower Basket
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {items.reduce((s, i) => s + i.quantity, 0)} items selected
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-petal-600 hover:text-petal-700 font-medium flex items-center gap-1 p-2 rounded-lg hover:bg-petal-50 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Free Delivery Banner */}
      <div className="bg-botanical-50 border border-botanical-200/80 rounded-2xl p-4 mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-botanical-900">
          <div className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-botanical-700" />
            {amountNeededForFreeDeliveryPaise === 0 ? (
              <span className="text-emerald-700 font-bold">
                🎉 Congratulations! You have unlocked FREE Doorstep Delivery!
              </span>
            ) : (
              <span>
                Add <strong>{formatINR(amountNeededForFreeDeliveryPaise)}</strong> more for <strong>FREE Doorstep Delivery</strong>
              </span>
            )}
          </div>
          <span>{freeDeliveryPercent}%</span>
        </div>
        <div className="w-full bg-botanical-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${freeDeliveryPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-7 space-y-3">
          {items.map(({ productId, product, quantity }) => {
            const itemTotal = product.pricePaise * quantity;
            return (
              <div
                key={productId}
                className="bg-cream-100/70 border border-botanical-100 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-xs"
              >
                {/* Product Thumbnail */}
                <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-cream-200 shrink-0">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-bold text-sm sm:text-base text-botanical-900 truncate">
                    {product.name}
                  </h3>
                  {product.teluguName && (
                    <p className="text-[11px] text-botanical-700 font-medium">
                      {product.teluguName}
                    </p>
                  )}
                  <div className="text-xs text-stone-500 mt-0.5">
                    {formatINR(product.pricePaise)} / {product.unit}
                  </div>

                  {/* Quantity Stepper & Price in Mobile */}
                  <div className="flex items-center justify-between mt-2 pt-1">
                    <div className="flex items-center border border-botanical-200 rounded-lg bg-cream-50">
                      <button
                        onClick={() => updateQuantity(productId, quantity - 1)}
                        aria-label={`Decrease quantity of ${product.name}`}
                        className="p-1.5 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/60 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-bold text-botanical-900 min-w-6 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(productId, quantity + 1)}
                        aria-label={`Increase quantity of ${product.name}`}
                        className="p-1.5 text-stone-600 hover:text-botanical-900 hover:bg-cream-200/60 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-botanical-900">
                        {formatINR(itemTotal)}
                      </span>
                      <button
                        onClick={() => removeItem(productId)}
                        aria-label={`Remove ${product.name} from basket`}
                        className="text-stone-400 hover:text-petal-600 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Link
              href="/flowers"
              className="text-xs font-semibold text-botanical-700 hover:text-botanical-900 flex items-center gap-1.5"
            >
              <span>+ Add more fresh flowers from catalogue</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="lg:col-span-5 bg-cream-100/90 border border-botanical-200 rounded-3xl p-5 sm:p-6 shadow-soft space-y-5 sticky top-24">
          <h2 className="font-serif font-bold text-lg text-botanical-900 pb-3 border-b border-botanical-200">
            Order Summary
          </h2>

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-botanical-900">{formatINR(subtotalPaise)}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span className="flex items-center gap-1">
                <span>Standard Doorstep Delivery</span>
              </span>
              <span>
                {deliveryFeePaise === 0 ? (
                  <span className="text-emerald-700 font-bold">FREE</span>
                ) : (
                  formatINR(deliveryFeePaise)
                )}
              </span>
            </div>

            {deliveryFeePaise > 0 && (
              <p className="text-[11px] text-stone-500 italic">
                Free delivery automatically applied on orders ₹299 and above.
              </p>
            )}

            <div className="pt-3 border-t border-botanical-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-botanical-900">Total Amount</span>
              <span className="text-xl font-serif font-bold text-botanical-900">
                {formatINR(totalPaise)}
              </span>
            </div>
          </div>

          {/* Checkout CTA */}
          <Link
            href="/checkout"
            className="w-full py-3.5 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 text-cream-50 font-semibold text-sm flex items-center justify-center gap-2 shadow-soft transition active:scale-95 text-center"
          >
            <span>Proceed to Delivery & Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="space-y-2 pt-2 border-t border-botanical-100 text-[11px] text-stone-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Choose One-Time Delivery or Weekly Subscription at checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Payment options: Cash on Delivery or WhatsApp UPI</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
