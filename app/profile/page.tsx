import { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'My Profile | Mahesh Flora',
  description: 'View and manage your Mahesh Flora customer profile, verified phone number, and delivery addresses.',
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-cream-50/60 pb-24 md:pb-16 pt-6 sm:pt-8">
      <ProfileClient />
    </main>
  );
}
