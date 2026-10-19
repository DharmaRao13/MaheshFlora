import React from 'react';
import { getFestivals, getProducts } from '@/lib/db/store';
import FestivalsClient from './FestivalsClient';

export const revalidate = 0; // Dynamic

interface Props {
  searchParams: Promise<{ select?: string }>;
}

export default async function FestivalsPage({ searchParams }: Props) {
  const { select } = await searchParams;
  const festivals = await getFestivals();
  const allProducts = await getProducts();
  const availableProducts = allProducts.filter((p) => p.inStock);

  return (
    <FestivalsClient
      festivals={festivals}
      products={availableProducts}
      initialSelectedFestivalId={select}
    />
  );
}
