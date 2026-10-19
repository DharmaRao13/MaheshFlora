import React from 'react';
import { getProducts } from '@/lib/db/store';
import FlowerCatalogueClient from './FlowerCatalogueClient';

export const revalidate = 0; // Dynamic server fetch

export default async function FlowersPage() {
  const allProducts = await getProducts();
  const availableProducts = allProducts.filter((p) => p.inStock);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8 text-center sm:text-left">
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-botanical-900 tracking-tight">
          Fresh Flower Catalogue
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
          Handpicked fresh puja flowers sourced daily from local Telangana farms for gated communities across Hyderabad.
        </p>
      </div>

      <FlowerCatalogueClient initialProducts={availableProducts} />
    </div>
  );
}
