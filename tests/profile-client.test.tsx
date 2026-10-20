import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileClient from '@/app/profile/ProfileClient';
import * as AuthContextModule from '@/context/CustomerAuthContext';

describe('Mahesh Flora — ProfileClient Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders loading state while checking customer auth', () => {
    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: null,
      customerPhone: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: true,
      confirmationResult: null,
      sendOtp: async () => ({ success: true }),
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: async () => null,
    });

    render(<ProfileClient />);
    expect(screen.getByText(/Verifying customer authentication.../i)).toBeInTheDocument();
  });

  it('2. Renders login prompt when customer is unauthenticated', () => {
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

    render(<ProfileClient />);
    expect(screen.getByText(/Customer Account & Profile/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Login \/ Sign Up/i })).toBeInTheDocument();
  });

  it('3. Renders customer profile with verified phone badge and allows editing name', async () => {
    const mockUser = {
      uid: 'cust-123',
      displayName: 'Kavitha Reddy',
      phoneNumber: '+919876543210',
    };

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: mockUser as any,
      customerPhone: '+919876543210',
      idToken: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: async () => ({ success: true }),
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: async () => 'mock-token',
    });

    // Mock fetch for /api/profile and /api/addresses
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            profile: {
              uid: 'cust-123',
              phone: '+919876543210',
              displayName: 'Kavitha Reddy',
              email: 'kavitha@example.com',
            },
          }),
        });
      }
      if (url.includes('/api/addresses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            addresses: [
              {
                id: 'addr-1',
                uid: 'cust-123',
                recipientName: 'Kavitha Reddy',
                phone: '+919876543210',
                flatNumber: '302',
                tower: 'Carnation',
                block: 'C',
                apartmentCommunity: 'Prestige Lakeside Habitat',
                locality: 'Varthur',
                city: 'Bengaluru',
                state: 'Karnataka',
                pincode: '560087',
                label: 'Home',
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }) as any;

    render(<ProfileClient />);

    // Wait for profile details to load
    await waitFor(() => {
      expect(screen.getAllByText(/Kavitha Reddy/i).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText(/\+919876543210/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Verified/i).length).toBeGreaterThanOrEqual(1);

    // Verify saved address with Tower and Block is displayed
    expect(screen.getByText(/Tower Carnation/i)).toBeInTheDocument();
    expect(screen.getByText(/Block C/i)).toBeInTheDocument();
    expect(screen.getByText(/Prestige Lakeside Habitat/i)).toBeInTheDocument();

    // Click "Edit Details"
    const editBtn = screen.getByRole('button', { name: /Edit Details/i });
    fireEvent.click(editBtn);

    // Phone should be locked / read-only in the edit form
    expect(screen.getByText(/Locked to your verified SMS OTP login/i)).toBeInTheDocument();

    // Clean up
    global.fetch = originalFetch;
  });
});
