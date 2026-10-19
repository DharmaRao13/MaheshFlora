import React from 'react';
import MyOrdersClient from './MyOrdersClient';

export const metadata = {
  title: 'My Orders & Live Order Tracking | Mahesh Flora',
  description: 'View and track your fresh puja flower delivery orders and delivery status across Hyderabad.',
};

export const revalidate = 0;

export default function MyOrdersPage() {
  return <MyOrdersClient />;
}
