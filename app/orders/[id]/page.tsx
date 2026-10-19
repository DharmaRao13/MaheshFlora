import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/db/store';
import OrderDetailsClient from './OrderDetailsClient';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 0; // Dynamic

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-botanical-900">
          Order Not Found
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          We could not locate an order matching ID &ldquo;{id}&rdquo;. Please verify the order link or contact us on WhatsApp.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-botanical-700 text-cream-50 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    );
  }

  const isTestMode =
    process.env.PAYMENT_TEST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PAYMENT_TEST_MODE === 'true';

  return <OrderDetailsClient initialOrder={order} paymentTestMode={isTestMode} />;
}
