import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NextRequest } from 'next/server';
import { POST as placeOrderRoute } from '@/app/api/orders/route';
import { _resetDbForTesting, getOrderById } from '@/lib/db/store';
import CheckoutClient from '@/app/checkout/CheckoutClient';
import * as AuthContextModule from '@/context/CustomerAuthContext';
import * as CartContextModule from '@/context/CartContext';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Customer Authentication and Checkout Flow', () => {
  beforeEach(() => {
    _resetDbForTesting();
    pushMock.mockClear();
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  const sampleAddress = {
    customerName: 'Ananya Rao',
    phone: '9876543210',
    flatNumber: 'Tower 3 - 402',
    apartmentCommunity: 'My Home Bhooja',
    pincode: '560001',
  };

  const sampleCartItem = {
    productId: 'prod-yellow-marigold',
    product: {
      id: 'prod-yellow-marigold',
      name: 'Yellow Marigold (Banthi)',
      teluguName: 'బంతి పూలు',
      variety: 'Yellow Marigold',
      pricePaise: 4500,
      unit: '250g',
      inStock: true,
      category: 'daily',
    },
    quantity: 2,
  };

  const fillAddressForm = (name = 'Ananya Rao', phone = '9876543210', flat = 'Flat 101', community = 'Prestige Falcon City') => {
    fireEvent.change(screen.getByPlaceholderText('e.g. Radhika Sharma'), {
      target: { value: name },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 9876543210'), {
      target: { value: phone },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Flat 804'), {
      target: { value: flat },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Prestige Falcon City'), {
      target: { value: community },
    });
  };

  // 1. Logged-out customer must verify phone before placing order
  it('1. Logged-out customer is rejected with 401 on /api/orders and prompted for OTP on checkout', async () => {
    // A. Server-side: Request without auth token/headers returns 401 AUTH_REQUIRED
    const unauthenticatedReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: sampleAddress,
        items: [{ productId: 'prod-yellow-marigold', quantity: 2 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
        paymentMethod: 'cod',
      }),
    });

    const res = await placeOrderRoute(unauthenticatedReq);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');

    // B. Client-side: Logged-out checkout triggers OTP modal and sendOtp
    const sendOtpMock = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: null,
      customerPhone: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: false,
      confirmationResult: null,
      sendOtp: sendOtpMock,
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: async () => null,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    render(<CheckoutClient />);

    fillAddressForm('Ananya Rao', '9876543210', 'Tower 3 - 402', 'My Home Bhooja');

    // Place order button shows "Verify Mobile & Place Order"
    const submitBtn = screen.getByRole('button', { name: /Verify Mobile & Place Order/i });
    expect(submitBtn).toBeInTheDocument();

    fireEvent.submit(submitBtn.closest('form')!);

    // Verified OTP modal opened and sendOtp was called
    await waitFor(() => {
      expect(sendOtpMock).toHaveBeenCalledWith('9876543210');
      expect(screen.getByText('Verify Mobile Number')).toBeInTheDocument();
      expect(screen.getByText('Enter 6-Digit OTP Code')).toBeInTheDocument();
    });
  });

  // 2. Already signed in customer checks out without another OTP
  it('2. Already signed-in customer checks out directly without OTP modal or SMS sending', async () => {
    const sendOtpMock = vi.fn();
    const getIdTokenMock = vi.fn().mockResolvedValue('mock-valid-token');

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'auth-user-123', phoneNumber: '+919876543210', displayName: 'Ananya Rao' } as any,
      customerPhone: '+919876543210',
      idToken: 'mock-valid-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: sendOtpMock,
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: getIdTokenMock,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    // Mock fetch for /api/orders
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/addresses') {
        return Promise.resolve({ ok: true, json: async () => ({ addresses: [] }) });
      }
      if (url === '/api/orders') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            order: { id: 'MF-ORD-888', accessToken: 'token-888' },
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CheckoutClient />);

    // Verify UI reflects verified status
    expect(screen.getAllByText(/Signed in with verified mobile/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/No OTP required/i).length).toBeGreaterThanOrEqual(1);

    fillAddressForm('Ananya Rao', '9876543210', 'Tower 3 - 402', 'My Home Bhooja');

    // Button shows "Place Order & Confirm Delivery"
    const submitBtn = screen.getByRole('button', { name: /Place Order & Confirm Delivery/i });
    expect(submitBtn).toBeInTheDocument();

    fireEvent.submit(submitBtn.closest('form')!);

    // Order placed immediately: No OTP modal, sendOtp NEVER called
    await waitFor(() => {
      expect(sendOtpMock).not.toHaveBeenCalled();
      expect(screen.queryByText('Verify Mobile Number')).not.toBeInTheDocument();
      expect(pushMock).toHaveBeenCalledWith('/orders/MF-ORD-888?token=token-888');
    });
  });

  // 3. Returning customer restores Firebase auth session
  it('3. Returning customer session restored from Firebase completes checkout without OTP', async () => {
    // Simulating session restoration after page refresh
    const getIdTokenMock = vi.fn().mockResolvedValue('mock-restored-token');
    const sendOtpMock = vi.fn();

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'restored-user-999', phoneNumber: '+919988776655', displayName: 'Raghav' } as any,
      customerPhone: '+919988776655',
      idToken: 'mock-restored-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: sendOtpMock,
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: getIdTokenMock,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/addresses') {
        return Promise.resolve({ ok: true, json: async () => ({ addresses: [] }) });
      }
      if (url === '/api/orders') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            order: { id: 'MF-RESTORED-1', accessToken: 'restored-token' },
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CheckoutClient />);

    // Phone field is prefilled with restored customer phone
    const phoneInput = screen.getByPlaceholderText('e.g. 9876543210') as HTMLInputElement;
    expect(phoneInput.value).toBe('9988776655');

    fillAddressForm('Raghav', '9988776655', 'Flat 101', 'Prestige Falcon City');

    const submitBtn = screen.getByRole('button', { name: /Place Order & Confirm Delivery/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(sendOtpMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith('/orders/MF-RESTORED-1?token=restored-token');
    });
  });

  // 4. Valid session works across multiple orders without asking for OTP again
  it('4. Valid session places multiple orders consecutively without re-prompting OTP', async () => {
    let orderCount = 0;
    const sendOtpMock = vi.fn();
    const getIdTokenMock = vi.fn().mockResolvedValue('mock-session-token');

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'multi-order-uid', phoneNumber: '+919876543210', displayName: 'Multi Order Customer' } as any,
      customerPhone: '+919876543210',
      idToken: 'mock-session-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: sendOtpMock,
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: getIdTokenMock,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/addresses') {
        return Promise.resolve({ ok: true, json: async () => ({ addresses: [] }) });
      }
      if (url === '/api/orders') {
        orderCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            order: { id: `MF-MULTI-${orderCount}`, accessToken: `multi-token-${orderCount}` },
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<CheckoutClient />);

    fillAddressForm('Multi Order Customer', '9876543210', 'Flat 202', 'Aparna Sarovar');

    // Place first order
    const submitBtn1 = screen.getByRole('button', { name: /Place Order & Confirm Delivery/i });
    fireEvent.submit(submitBtn1.closest('form')!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/orders/MF-MULTI-1?token=multi-token-1');
    });

    // Customer remains authenticated for second order
    unmount();
    render(<CheckoutClient />);

    fillAddressForm('Multi Order Customer', '9876543210', 'Flat 202', 'Aparna Sarovar');

    // Place second order
    const submitBtn2 = screen.getByRole('button', { name: /Place Order & Confirm Delivery/i });
    fireEvent.submit(submitBtn2.closest('form')!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/orders/MF-MULTI-2?token=multi-token-2');
    });

    // Verify OTP was never triggered across both orders
    expect(sendOtpMock).not.toHaveBeenCalled();
    expect(orderCount).toBe(2);
  });

  // 5. Explicit sign-out requires authentication again
  it('5. Explicit sign-out requires phone OTP verification again on next checkout attempt', async () => {
    const sendOtpMock = vi.fn().mockResolvedValue({ success: true });

    // After sign-out, isAuthenticated is false
    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: null,
      customerPhone: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: false,
      confirmationResult: null,
      sendOtp: sendOtpMock,
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: async () => null,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    render(<CheckoutClient />);

    fillAddressForm('Signed Out User', '9876543210', 'Flat 505', 'Lanco Hills');

    const submitBtn = screen.getByRole('button', { name: /Verify Mobile & Place Order/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(sendOtpMock).toHaveBeenCalledWith('9876543210');
      expect(screen.getByText('Verify Mobile Number')).toBeInTheDocument();
    });
  });

  // 6. Expired tokens are securely rejected and handled by safe token refresh
  it('6. Expired token on order placement triggers safe token refresh retry before prompting sign-in', async () => {
    // A. Server verification rejects expired token
    const expiredReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-expired-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: sampleAddress,
        items: [{ productId: 'prod-yellow-marigold', quantity: 1 }],
        deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
        paymentMethod: 'cod',
      }),
    });

    const expiredRes = await placeOrderRoute(expiredReq);
    expect(expiredRes.status).toBe(401);
    const expiredData = await expiredRes.json();
    expect(expiredData.code).toBe('AUTH_REQUIRED');

    // B. Client handles expired token: getIdToken(true) produces a fresh token and retries
    let attemptCount = 0;
    const getIdTokenMock = vi.fn().mockImplementation(async (forceRefresh?: boolean) => {
      if (forceRefresh) {
        return 'mock-refreshed-valid-token';
      }
      return 'mock-expired-token';
    });

    vi.spyOn(AuthContextModule, 'useCustomerAuth').mockReturnValue({
      user: { uid: 'exp-uid', phoneNumber: '+919876543210', displayName: 'Exp User' } as any,
      customerPhone: '+919876543210',
      idToken: 'mock-expired-token',
      isAuthenticated: true,
      isLoading: false,
      confirmationResult: null,
      sendOtp: vi.fn(),
      verifyOtp: async () => ({ success: true }),
      signOut: async () => {},
      getIdToken: getIdTokenMock,
    });

    vi.spyOn(CartContextModule, 'useCart').mockReturnValue({
      items: [sampleCartItem],
      subtotalPaise: 9000,
      deliveryFeePaise: 0,
      totalPaise: 9000,
      itemCount: 2,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      syncCartPrices: () => {},
      isHydrated: true,
    });

    const fetchMock = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/addresses') {
        return Promise.resolve({ ok: true, json: async () => ({ addresses: [] }) });
      }
      if (url === '/api/orders') {
        attemptCount++;
        const authHeader = options?.headers?.['Authorization'];
        if (authHeader === 'Bearer mock-expired-token') {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Token expired', code: 'AUTH_REQUIRED' }),
          });
        }
        if (authHeader === 'Bearer mock-refreshed-valid-token') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              order: { id: 'MF-RETRY-SUCCESS', accessToken: 'retry-token' },
            }),
          });
        }
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CheckoutClient />);

    fillAddressForm('Exp User', '9876543210', 'Flat 701', 'Aparna Serene Park');

    const submitBtn = screen.getByRole('button', { name: /Place Order & Confirm Delivery/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      // Confirmed that getIdToken(true) was called to refresh
      expect(getIdTokenMock).toHaveBeenCalledWith(true);
      // Confirmed that order was retried and succeeded without asking for OTP
      expect(attemptCount).toBe(2);
      expect(pushMock).toHaveBeenCalledWith('/orders/MF-RETRY-SUCCESS?token=retry-token');
    });
  });

  // 7. Orders are strictly associated with authenticated customer UID and verified phone
  it('7. Order creation strictly binds verified customer UID and phone, discarding client spoofing', async () => {
    const verifiedUid = 'genuine-firebase-uid-888';
    const verifiedPhone = '+919876543210';

    // Attacker client attempts to spoof a different UID and unverified phone in the payload
    const spoofedPayload = {
      customer: {
        customerName: 'Genuine Customer',
        phone: '9111111111', // Spoofed unverified phone in body
        uid: 'victim-uid-999', // Spoofed UID in body
        apartmentCommunity: 'My Home Bhooja',
        flatNumber: 'Tower 1 - 101',
      },
      items: [{ productId: 'prod-yellow-marigold', quantity: 1 }],
      deliverySchedule: { type: 'one-time', date: '2026-10-25', timeSlot: 'morning' },
      paymentMethod: 'cod',
    };

    const secureOrderReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-uid': verifiedUid,
        'x-customer-phone': verifiedPhone,
      },
      body: JSON.stringify(spoofedPayload),
    });

    const res = await placeOrderRoute(secureOrderReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Retrieve order from store to inspect persisted attributes
    const savedOrder = await getOrderById(data.order.id);
    expect(savedOrder).toBeDefined();

    // Server enforces genuine verified UID and verified phone
    expect(savedOrder!.customer.uid).toBe(verifiedUid);
    expect(savedOrder!.customer.phone).toBe(verifiedPhone);
    expect(savedOrder!.customer.uid).not.toBe('victim-uid-999');

    // The client-entered phone is preserved safely only as alternate contact
    expect(savedOrder!.customer.alternatePhone).toBe('9111111111');
  });
});
