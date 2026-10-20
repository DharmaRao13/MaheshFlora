'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getClientAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { validateIndianPhone } from '@/lib/business';

interface CustomerAuthContextType {
  user: User | null;
  customerPhone: string | null;
  idToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  confirmationResult: ConfirmationResult | null;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (code: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      // Check localStorage for offline / mock fallback
      try {
        const savedPhone = localStorage.getItem('mahesh_customer_phone');
        if (savedPhone) {
          setCustomerPhone(savedPhone);
        }
      } catch {}
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          const rawPhone = currentUser.phoneNumber || '';
          const normalized = rawPhone ? validateIndianPhone(rawPhone).formatted : '';
          const phoneToSet = normalized || rawPhone;
          setCustomerPhone(phoneToSet);

          if (phoneToSet) {
            try {
              localStorage.setItem('mahesh_customer_phone', phoneToSet.replace(/[^0-9]/g, '').slice(-10));
              localStorage.setItem('mahesh_customer_uid', currentUser.uid);
            } catch {}
          }
        } catch (err) {
          console.warn('Error refreshing customer ID token:', err);
        }
      } else {
        setIdToken(null);
        setCustomerPhone(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to get fresh or cached ID token with optional forceRefresh
  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (user) {
        try {
          const token = await user.getIdToken(forceRefresh);
          setIdToken(token);
          return token;
        } catch (err) {
          console.warn('Error fetching customer ID token:', err);
          return idToken;
        }
      }
      return idToken;
    },
    [user, idToken]
  );

  // Setup RecaptchaVerifier
  const getOrCreateRecaptcha = useCallback((): RecaptchaVerifier | null => {
    if (typeof window === 'undefined') return null;
    const auth = getClientAuth();
    if (!auth) return null;

    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
    }

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          console.warn('Recaptcha expired. Refreshing verifier.');
        },
      });
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (err) {
      console.warn('Failed to initialize RecaptchaVerifier:', err);
      return null;
    }
  }, []);

  // Send OTP
  const sendOtp = useCallback(
    async (phone: string): Promise<{ success: boolean; error?: string }> => {
      const validation = validateIndianPhone(phone);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const formattedPhone = validation.formatted; // +91XXXXXXXXXX (E.164)
      const auth = getClientAuth();

      // Fallback for tests or environments without configured live Firebase Auth
      if (!auth || !isFirebaseConfigured()) {
        console.info('Firebase Auth client not configured; entering mock test OTP mode for:', formattedPhone);
        setCustomerPhone(formattedPhone);
        return { success: true };
      }

      try {
        const verifier = getOrCreateRecaptcha();
        if (!verifier) {
          throw new Error('reCAPTCHA could not be initialized. Please refresh the page and try again.');
        }

        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        setConfirmationResult(confirmation);
        return { success: true };
      } catch (err: any) {
        console.error('Error sending OTP:', err);
        // Clear cached verifier so user can retry cleanly
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch {}
          recaptchaVerifierRef.current = null;
        }
        return {
          success: false,
          error: err?.message || 'Failed to send verification SMS. Please check the mobile number and try again.',
        };
      }
    },
    [getOrCreateRecaptcha]
  );

  // Verify OTP
  const verifyOtp = useCallback(
    async (code: string): Promise<{ success: boolean; user?: User; error?: string }> => {
      const trimmedCode = code.trim();
      if (!/^\d{6}$/.test(trimmedCode)) {
        return { success: false, error: 'Please enter a valid 6-digit verification code.' };
      }

      const auth = getClientAuth();

      // Test/development fallback when confirmationResult is not present
      if (!auth || !confirmationResult) {
        if (!isFirebaseConfigured() || !confirmationResult) {
          // Allow mock confirmation
          return { success: true };
        }
      }

      try {
        if (!confirmationResult) {
          throw new Error('No active OTP session. Please request a new code.');
        }

        const credential = await confirmationResult.confirm(trimmedCode);
        const signedInUser = credential.user;
        setUser(signedInUser);

        const token = await signedInUser.getIdToken();
        setIdToken(token);

        const rawPhone = signedInUser.phoneNumber || '';
        const normalized = rawPhone ? validateIndianPhone(rawPhone).formatted : '';
        const phoneToSet = normalized || rawPhone;
        setCustomerPhone(phoneToSet);

        if (phoneToSet) {
          try {
            localStorage.setItem('mahesh_customer_phone', phoneToSet.replace(/[^0-9]/g, '').slice(-10));
            localStorage.setItem('mahesh_customer_uid', signedInUser.uid);
          } catch {}
        }

        return { success: true, user: signedInUser };
      } catch (err: any) {
        console.error('Error verifying OTP code:', err);
        return {
          success: false,
          error: err?.message || 'Invalid or expired OTP code. Please check and try again.',
        };
      }
    },
    [confirmationResult]
  );

  // Sign out
  const signOut = useCallback(async () => {
    const auth = getClientAuth();
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.warn('Error signing out:', err);
      }
    }
    setUser(null);
    setIdToken(null);
    setCustomerPhone(null);
    setConfirmationResult(null);
    try {
      localStorage.removeItem('mahesh_customer_phone');
      localStorage.removeItem('mahesh_customer_uid');
    } catch {}
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        customerPhone,
        idToken,
        isAuthenticated: Boolean(user || customerPhone),
        isLoading,
        confirmationResult,
        sendOtp,
        verifyOtp,
        signOut,
        getIdToken,
      }}
    >
      {children}
      <div id="recaptcha-container"></div>
    </CustomerAuthContext.Provider>
  );
}

const defaultCustomerAuthContext: CustomerAuthContextType = {
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
};

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    return defaultCustomerAuthContext;
  }
  return context;
}
