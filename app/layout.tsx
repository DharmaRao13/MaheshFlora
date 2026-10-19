import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyMobileCartBar from '@/components/StickyMobileCartBar';
import MobileBottomNav from '@/components/MobileBottomNav';

export const metadata: Metadata = {
  title: 'Mahesh Flora | Fresh Daily Puja Flowers & Subscriptions Hyderabad',
  description:
    'Fresh Jasmine, Marigold, Rose Petals and Garlands delivered to your doorstep in Hyderabad. Daily puja flower deliveries and weekly subscriptions for gated communities.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FAF6F0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-cream-50 text-botanical-900 selection:bg-petal-200 selection:text-botanical-900">
        <CustomerAuthProvider>
          <CartProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 pb-24 sm:pb-28 md:pb-8">{children}</main>
              <Footer />
              <StickyMobileCartBar />
              <MobileBottomNav />
            </div>
          </CartProvider>
        </CustomerAuthProvider>
      </body>
    </html>
  );
}
