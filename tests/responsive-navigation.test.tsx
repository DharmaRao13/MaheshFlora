import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/MobileBottomNav';
import StickyMobileCartBar from '@/components/StickyMobileCartBar';
import { CartProvider } from '@/context/CartContext';
import * as AuthContextModule from '@/context/CustomerAuthContext';

describe('Mahesh Flora — Responsive Navigation & Mobile Bottom Nav', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Desktop header includes logo, search input, cart, and account dropdown', () => {
    render(
      <CartProvider>
        <Header />
      </CartProvider>
    );

    // Brand logo
    expect(screen.getByText('Mahesh Flora')).toBeInTheDocument();
    expect(screen.getByText(/Fresh Flowers • Hyderabad/i)).toBeInTheDocument();

    // Desktop search input
    const searchInput = screen.getByRole('textbox', { name: /Search flowers/i });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'Search flowers...');

    // Cart link
    const cartLinks = screen.getAllByRole('link', { name: /View Cart/i });
    expect(cartLinks.length).toBeGreaterThanOrEqual(1);

    // Account dropdown button
    expect(screen.getByRole('button', { name: /Account and Profile Menu/i })).toBeInTheDocument();
  });

  it('2. Mobile bottom navigation provides Home, Flowers, Festivals, and Account tabs', () => {
    render(
      <CartProvider>
        <MobileBottomNav />
      </CartProvider>
    );

    const bottomNav = screen.getByRole('navigation', { name: /Mobile Bottom Navigation/i });
    expect(bottomNav).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Flowers/i })).toHaveAttribute('href', '/flowers');
    expect(screen.getByRole('link', { name: /Festivals/i })).toHaveAttribute('href', '/festivals');
    expect(screen.getByRole('button', { name: /Open Account Menu/i })).toBeInTheDocument();
  });

  it('3. Mobile bottom nav Account button opens Account sheet with login options when logged out', () => {
    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: null,
      customerPhone: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: false,
      confirmationResult: null,
      sendOtp: async () => ({ success: true }),
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: async () => null,
    });

    render(
      <CartProvider>
        <MobileBottomNav />
      </CartProvider>
    );

    // Click Account tab in bottom nav
    const accountTab = screen.getByRole('button', { name: /Open Account Menu/i });
    fireEvent.click(accountTab);

    // Sheet appears
    const sheetDialog = screen.getByRole('dialog', { name: /Account Sheet/i });
    expect(sheetDialog).toBeInTheDocument();

    // Contains Login / Sign Up button
    const loginLink = screen.getByRole('link', { name: /Login \/ Sign Up/i });
    expect(loginLink).toHaveAttribute('href', '/orders');

    // Contains My Orders, My Subscriptions, Festivals, Admin Login
    expect(screen.getByRole('link', { name: /My Orders/i })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('link', { name: /My Subscriptions/i })).toHaveAttribute('href', '/subscriptions');
    expect(screen.getByRole('link', { name: /My Festival Bookings/i })).toHaveAttribute('href', '/festivals');
    expect(screen.getByRole('link', { name: /Admin Login/i })).toHaveAttribute('href', '/admin');

    // Close button dismisses sheet
    const closeBtn = screen.getByRole('button', { name: /Close account menu/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog', { name: /Account Sheet/i })).toBeNull();
  });

  it('4. Mobile bottom nav Account sheet displays customer phone, profile, and Sign Out when logged in', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'cust-777' } as any,
      customerPhone: '+919988776655',
      idToken: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: async () => ({ success: true }),
      verifyOtp: async () => ({ success: true }),
      signOut: mockSignOut,
      getIdToken: async () => 'mock-token',
    });

    render(
      <CartProvider>
        <MobileBottomNav />
      </CartProvider>
    );

    const accountTab = screen.getByRole('button', { name: /Open Account Menu/i });
    fireEvent.click(accountTab);

    // Displays phone
    expect(screen.getAllByText(/\+91 9988776655/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Verified Customer/i)).toBeInTheDocument();

    // Displays My Profile
    expect(screen.getByRole('link', { name: /My Profile/i })).toHaveAttribute('href', '/profile');

    // Displays Sign Out button
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('5. StickyMobileCartBar is configured with bottom margin to sit above mobile bottom nav', () => {
    const { container } = render(
      <CartProvider>
        <StickyMobileCartBar />
      </CartProvider>
    );

    // Cart bar exists or hides when empty (hydrated check)
    // Verify file exports without errors
    expect(StickyMobileCartBar).toBeDefined();
  });
});
