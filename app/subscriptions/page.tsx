import React from 'react';
import { getSubscriptions } from '@/lib/db/store';
import SubscriptionsClient from './SubscriptionsClient';

export const revalidate = 0; // Dynamic

export default async function SubscriptionsPage() {
  const subscriptions = await getSubscriptions();
  return <SubscriptionsClient initialSubscriptions={subscriptions} />;
}
