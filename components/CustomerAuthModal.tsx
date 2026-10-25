'use client';

import React, { useState, useEffect } from 'react';
import {
  Phone,
  ShieldCheck,
  X,
  ArrowRight,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { validateIndianPhone } from '@/lib/business';

export interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
  title?: string;
  subtitle?: string;
}

export default function CustomerAuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
  title,
  subtitle,
}: CustomerAuthModalProps) {
  const {
    isAuthenticated,
    customerPhone,
    sendOtp,
    verifyOtp,
    getIdToken,
  } = useCustomerAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setStep('phone');
      setOtp('');
      setErrorMessage(null);
      setInfoMessage(null);
      if (customerPhone) {
        const clean = customerPhone.replace(/[^0-9]/g, '').slice(-10);
        setPhone(clean);
      }
    }
  }, [isOpen, initialMode, customerPhone]);

  // If already authenticated and modal is open, check if name is needed (for register) or just close
  useEffect(() => {
    if (isOpen && isAuthenticated && step === 'phone') {
      // Reusing valid session - no redundant OTP
      if (mode === 'register') {
        // Check if existing profile has displayName
        getIdToken().then(async (token) => {
          if (token) {
            try {
              const res = await fetch('/api/profile', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                if (data.profile?.displayName) {
                  onSuccess?.();
                  onClose();
                  return;
                }
              }
            } catch {}
          }
          setStep('name');
        });
      } else {
        onSuccess?.();
        onClose();
      }
    }
  }, [isOpen, isAuthenticated, step, mode, getIdToken, onSuccess, onClose]);

  if (!isOpen) return null;

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const validation = validateIndianPhone(phone);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const res = await sendOtp(cleanPhone);
      if (res.success) {
        setStep('otp');
        setInfoMessage(`6-digit verification code sent to +91 ${cleanPhone}`);
      } else {
        setErrorMessage(res.error || 'Failed to send OTP SMS. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while sending OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOtp(cleanOtp);
      if (res.success) {
        const token = await getIdToken();

        // Check if profile exists
        let profileName = '';
        if (token) {
          try {
            const profileRes = await fetch('/api/profile', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (profileRes.ok) {
              const data = await profileRes.json();
              profileName = data.profile?.displayName || '';
            }
          } catch {}
        }

        // If new registration or profile is missing customer name, ask for customer's name
        if (mode === 'register' || !profileName) {
          setStep('name');
        } else {
          try {
            localStorage.setItem('mahesh_customer_name', profileName);
          } catch {}
          onSuccess?.();
          onClose();
        }
      } else {
        setErrorMessage(res.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter your name.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getIdToken();
      if (token) {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ displayName: trimmedName }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to save customer profile');
        }
      }

      try {
        localStorage.setItem('mahesh_customer_name', trimmedName);
      } catch {}

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-botanical-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-cream-50 rounded-2xl shadow-elevated border border-botanical-200/80 w-full max-w-md overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-botanical-800 to-botanical-900 p-5 text-cream-50 flex items-center justify-between relative">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-saffron-400"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-saffron-300">
                Mahesh Flora Direct
              </span>
            </div>
            <h2 id="auth-modal-title" className="text-xl font-serif font-bold text-cream-50">
              {title || (mode === 'login' ? 'Login to Your Account' : 'Create a New Account')}
            </h2>
            <p className="text-xs text-botanical-200 mt-0.5">
              {subtitle ||
                (mode === 'login'
                  ? 'Access your daily puja orders, subscriptions & saved addresses'
                  : 'Join Mahesh Flora for fresh morning flower deliveries')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-cream-100 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: Login vs Create Account */}
        {step === 'phone' && (
          <div className="flex border-b border-botanical-200 bg-cream-100/60 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-cream-50 text-botanical-900 shadow-sm border border-botanical-200'
                  : 'text-stone-600 hover:text-botanical-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login to Your Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-cream-50 text-botanical-900 shadow-sm border border-botanical-200'
                  : 'text-stone-600 hover:text-botanical-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create a New Account</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Info Message Alert */}
          {infoMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1">{infoMessage}</div>
            </div>
          )}

          {/* Step 1: Phone Input */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-phone-input" className="block text-xs font-semibold text-botanical-900 mb-1.5">
                  10-Digit Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500 font-mono text-sm font-semibold">
                    +91
                  </div>
                  <input
                    id="auth-phone-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPhone(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="98765 43210"
                    className="w-full pl-14 pr-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-900 font-mono text-base font-semibold focus:outline-none focus:ring-2 focus:ring-botanical-600 focus:border-transparent transition"
                    autoFocus
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-400">
                    <Phone className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-botanical-600" />
                  We send a secure 6-digit OTP via SMS to verify your mobile number.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || phone.length !== 10}
                className="w-full py-3 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 disabled:opacity-50 text-cream-50 font-semibold text-sm shadow-soft transition flex items-center justify-center gap-2 active:scale-95"
              >
                {isLoading ? (
                  <span>Sending OTP code...</span>
                ) : (
                  <>
                    <span>Continue with OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-stone-500">
                {mode === 'login' ? (
                  <span>
                    New to Mahesh Flora?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="font-bold text-botanical-800 hover:underline"
                    >
                      Create an account
                    </button>
                  </span>
                ) : (
                  <span>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-bold text-botanical-800 hover:underline"
                    >
                      Login to your account
                    </button>
                  </span>
                )}
              </div>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-otp-input" className="block text-xs font-semibold text-botanical-900">
                    Enter 6-Digit OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-botanical-700 font-bold hover:underline"
                  >
                    Change Phone (+91 {phone})
                  </button>
                </div>

                <input
                  id="auth-otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setOtp(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="123456"
                  className="w-full py-3 px-4 text-center tracking-[0.5em] bg-white border border-stone-300 rounded-xl text-stone-900 font-mono text-xl font-bold focus:outline-none focus:ring-2 focus:ring-botanical-600 focus:border-transparent transition"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 disabled:opacity-50 text-cream-50 font-semibold text-sm shadow-soft transition flex items-center justify-center gap-2 active:scale-95"
              >
                {isLoading ? (
                  <span>Verifying code...</span>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handlePhoneSubmit}
                  disabled={isLoading}
                  className="text-xs text-stone-600 hover:text-botanical-800 font-semibold"
                >
                  Didn't receive SMS? Resend OTP
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Customer Name for New Registration */}
          {step === 'name' && (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="p-3 bg-botanical-50 border border-botanical-200/80 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-botanical-700 text-cream-50 flex items-center justify-center font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-botanical-900">Mobile Verified Successfully!</p>
                  <p className="text-[11px] text-stone-600">+91 {phone}</p>
                </div>
              </div>

              <div>
                <label htmlFor="auth-name-input" className="block text-xs font-semibold text-botanical-900 mb-1.5">
                  Your Full Name
                </label>
                <div className="relative">
                  <input
                    id="auth-name-input"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Smt. Lakshmi Rao"
                    className="w-full py-3 pl-10 pr-4 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-botanical-600 focus:border-transparent transition"
                    autoFocus
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 mt-1.5">
                  Used for personalized puja flower packing and morning deliveries.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !customerName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-botanical-700 hover:bg-botanical-800 disabled:opacity-50 text-cream-50 font-semibold text-sm shadow-soft transition flex items-center justify-center gap-2 active:scale-95"
              >
                {isLoading ? (
                  <span>Saving Profile...</span>
                ) : (
                  <>
                    <span>Complete Profile & Start Shopping</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
