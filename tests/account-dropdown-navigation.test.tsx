import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '@/components/Header';
import { CartProvider } from '@/context/CartContext';
import * as AuthContextModule from '@/context/CustomerAuthContext';

describe('Mahesh Flora — Account & Profile Dropdown Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Primary navigation retains Home, Flowers, Weekly Subscription, and Festivals unchanged', () => {
    render(
      <CartProvider>
        <Header />
      </CartProvider>
    );

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Flowers' })).toHaveAttribute('href', '/flowers');
    expect(screen.getByRole('link', { name: 'Weekly Subscription' })).toHaveAttribute('href', '/subscriptions');
    expect(screen.getByRole('link', { name: 'Festivals' })).toHaveAttribute('href', '/festivals');
  });

  it('2. When logged out: shows "Login / Sign Up", "My Orders", "My Subscriptions", "My Festival Bookings", "Admin Login" and no "Sign Out"', () => {
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
        <Header />
      </CartProvider>
    );

    // Dropdown trigger is available
    const trigger = screen.getByRole('button', { name: /Account and Profile Menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Account');

    // Login / Sign Up is present
    const loginLinks = screen.getAllByRole('link', { name: /Login \/ Sign Up/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    expect(loginLinks[0]).toHaveAttribute('href', '/orders');

    // My Orders, Subscriptions, Festival Bookings, Admin Login are present
    expect(screen.getAllByRole('link', { name: /My Orders/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /My Subscriptions/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /My Festival Bookings/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /Admin Login/i }).length).toBeGreaterThanOrEqual(1);

    // Sign Out is not present when logged out
    expect(screen.queryByRole('button', { name: /Sign Out/i })).toBeNull();
  });

  it('3. When logged in: shows "My Profile", verified phone badge, and "Sign Out" button which triggers logout', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'user-123' } as any,
      customerPhone: '+919876543210',
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
        <Header />
      </CartProvider>
    );

    // Trigger shows phone prefix
    const trigger = screen.getByRole('button', { name: /Account and Profile Menu/i });
    expect(trigger).toHaveTextContent('+91 98765...');

    // Shows verified phone inside dropdown
    expect(screen.getByText(/\+91 9876543210/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Customer/i)).toBeInTheDocument();

    // Shows My Profile link
    const profileLinks = screen.getAllByRole('link', { name: /My Profile/i });
    expect(profileLinks.length).toBeGreaterThanOrEqual(1);
    expect(profileLinks[0]).toHaveAttribute('href', '/orders');

    // Shows Sign Out button
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('4. Toggles dropdown open state and closes upon item selection', () => {
    render(
      <CartProvider>
        <Header />
      </CartProvider>
    );

    const trigger = screen.getByRole('button', { name: /Account and Profile Menu/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Click to close
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Reopen and close by clicking outside
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('5. Mobile navigation drawer contains account options and links', () => {
    render(
      <CartProvider>
        <Header />
      </CartProvider>
    );

    // Open mobile menu
    const menuToggle = screen.getByRole('button', { name: /Toggle navigation menu/i });
    fireEvent.click(menuToggle);

    // Mobile drawer shows Account & Profile section
    expect(screen.getByText(/Account & Profile/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Flower Catalogue/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /Admin Login/i }).length).toBeGreaterThanOrEqual(1);
  });
});
