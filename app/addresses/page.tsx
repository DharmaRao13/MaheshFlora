import { Metadata } from 'next';
import SavedAddressesClient from './SavedAddressesClient';

export const metadata: Metadata = {
  title: 'Saved Delivery Addresses | Mahesh Flora',
  description: 'Manage your saved delivery addresses for fresh flower delivery and subscriptions in Hyderabad.',
};

export default function AddressesPage() {
  return (
    <main className="min-h-screen bg-cream-50/60 pb-24 md:pb-16 pt-6 sm:pt-8">
      <SavedAddressesClient />
    </main>
  );
}
