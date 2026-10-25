'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Product, CartItem } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/config';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  syncCartPrices: (updatedItems: { productId: string; pricePaise: number; inStock?: boolean }[]) => void;
  cartCount: number;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  freeDeliveryThresholdPaise: number;
  amountNeededForFreeDeliveryPaise: number;
  isHydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'mahesh_flora_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to restore cart from localStorage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sync to localStorage on cart change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items, isHydrated]);

  const addItem = (product: Product, quantity: number = 1) => {
    if (!product.inStock) return;

    setItems((prevItems) => {
      const existing = prevItems.find((i) => i.productId === product.id);
      if (existing) {
        return prevItems.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prevItems, { productId: product.id, product, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((prevItems) => prevItems.filter((i) => i.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const syncCartPrices = (updatedList: { productId: string; pricePaise: number; inStock?: boolean }[]) => {
    const updateMap = new Map(updatedList.map((u) => [u.productId, u]));
    setItems((prevItems) =>
      prevItems.map((item) => {
        const update = updateMap.get(item.productId);
        if (update) {
          return {
            ...item,
            product: {
              ...item.product,
              pricePaise: update.pricePaise,
              inStock: update.inStock !== undefined ? update.inStock : item.product.inStock,
            },
          };
        }
        return item;
      })
    );
  };

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const subtotalPaise = useMemo(() => {
    return items.reduce((sum, item) => sum + item.product.pricePaise * item.quantity, 0);
  }, [items]);

  const deliveryFeePaise = useMemo(() => {
    if (items.length === 0) return 0;
    return subtotalPaise >= DEFAULT_SETTINGS.freeDeliveryThresholdPaise
      ? 0
      : DEFAULT_SETTINGS.standardDeliveryFeePaise;
  }, [subtotalPaise, items.length]);

  const totalPaise = useMemo(() => {
    if (items.length === 0) return 0;
    return subtotalPaise + deliveryFeePaise;
  }, [subtotalPaise, deliveryFeePaise, items.length]);

  const amountNeededForFreeDeliveryPaise = Math.max(
    0,
    DEFAULT_SETTINGS.freeDeliveryThresholdPaise - subtotalPaise
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncCartPrices,
        cartCount,
        subtotalPaise,
        deliveryFeePaise,
        totalPaise,
        freeDeliveryThresholdPaise: DEFAULT_SETTINGS.freeDeliveryThresholdPaise,
        amountNeededForFreeDeliveryPaise,
        isHydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

const defaultCartContext: CartContextType = {
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  syncCartPrices: () => {},
  cartCount: 0,
  subtotalPaise: 0,
  deliveryFeePaise: 0,
  totalPaise: 0,
  amountNeededForFreeDeliveryPaise: 0,
  freeDeliveryThresholdPaise: DEFAULT_SETTINGS.freeDeliveryThresholdPaise,
  isHydrated: true,
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    return defaultCartContext;
  }
  return context;
}
