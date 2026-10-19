import { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

export const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'mahesh-flora-admin-secret-dev-key';

/**
 * Checks server-side authorization for administrative requests.
 * Accepts either:
 * 1. 'x-admin-key' header
 * 2. 'admin_token' cookie
 * 3. Authorization Bearer token matching the admin secret
 */
export function verifyAdminAuthorization(req: NextRequest): { authorized: boolean; reason?: string } {
  const headerKey = req.headers.get('x-admin-key');
  if (headerKey && headerKey === ADMIN_SECRET_KEY) {
    return { authorized: true };
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === ADMIN_SECRET_KEY) {
      return { authorized: true };
    }
  }

  const cookie = (req as any).cookies?.get?.('admin_token')?.value;
  if (cookie && cookie === ADMIN_SECRET_KEY) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Valid administrative credentials or passcode required.',
  };
}

/**
 * Asynchronously verifies admin authorization.
 * Supports both standard admin key/cookies AND Firebase Authentication ID tokens.
 */
export async function verifyAdminAuthorizationAsync(
  req: NextRequest
): Promise<{ authorized: boolean; email?: string; reason?: string }> {
  // Fast path: synchronous check
  const syncCheck = verifyAdminAuthorization(req);
  if (syncCheck.authorized) {
    return { authorized: true, email: 'admin@maheshflora.com' };
  }

  // Check for Firebase Authentication Bearer ID token or custom header
  const authHeader = req.headers.get('authorization') || req.headers.get('x-admin-key');
  let idToken: string | null = null;
  if (authHeader) {
    idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  }

  if (idToken) {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const email = (decoded.email || '').toLowerCase();
        // Authorized strictly if custom claim admin is true
        if (decoded.admin === true) {
          return { authorized: true, email };
        }
        return {
          authorized: false,
          reason: 'Forbidden: Authenticated user does not possess administrative privileges (admin: true claim required).',
        };
      } catch (err: any) {
        // Token was provided but invalid/expired
        return {
          authorized: false,
          reason: `Unauthorized: Invalid or expired Firebase ID token (${err.message}).`,
        };
      }
    }
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Valid administrative credentials, passcode, or Firebase ID token required.',
  };
}

export interface CustomerAuthResult {
  authenticated: boolean;
  uid?: string;
  phone?: string;
  email?: string;
  reason?: string;
}

/**
 * Asynchronously verifies customer Firebase Authentication ID token (phone OTP sign-in).
 */
export async function verifyCustomerTokenAsync(
  req: NextRequest
): Promise<CustomerAuthResult> {
  const authHeader = req.headers.get('authorization');
  let idToken: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.substring(7);
  }
  if (!idToken) {
    idToken = req.headers.get('x-customer-token');
  }

  if (idToken) {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const rawPhone = decoded.phone_number || '';
        return {
          authenticated: true,
          uid: decoded.uid,
          phone: rawPhone,
          email: decoded.email,
        };
      } catch (err: any) {
        return {
          authenticated: false,
          reason: `Invalid or expired customer token: ${err.message}`,
        };
      }
    }
  }

  // Support test & local development mocks when running tests without live Firebase Admin credentials
  if (process.env.NODE_ENV === 'test') {
    const testUid = req.headers.get('x-customer-uid');
    const testPhone = req.headers.get('x-customer-phone');
    if (testUid || testPhone) {
      return {
        authenticated: true,
        uid: testUid || 'test-customer-uid',
        phone: testPhone || undefined,
      };
    }
  }

  return {
    authenticated: false,
    reason: 'No customer authentication token provided.',
  };
}

/**
 * Verifies customer access to an order.
 * Accepts either an Order object or a customer phone string.
 * Allows access if:
 * 1. Caller is an authorized admin
 * 2. Caller presents a valid order accessToken matching order.accessToken
 * 3. Caller presents an authenticated customer UID matching order.customer.uid
 * 4. Caller presents a verified phone matching order.customer.phone
 */
export function verifyOrderAccess(
  req: NextRequest,
  orderOrPhone: string | { customer?: { phone: string; uid?: string }; accessToken?: string }
): { allowed: boolean; reason?: string } {
  // If caller is admin, allow
  const adminCheck = verifyAdminAuthorization(req);
  if (adminCheck.authorized) {
    return { allowed: true };
  }

  const orderCustomerPhone = typeof orderOrPhone === 'string' ? orderOrPhone : orderOrPhone.customer?.phone;
  const orderAccessToken = typeof orderOrPhone === 'object' ? orderOrPhone.accessToken : undefined;
  const orderUid = typeof orderOrPhone === 'object' ? orderOrPhone.customer?.uid : undefined;

  // 1. Check order access token
  const tokenParam = req.nextUrl?.searchParams?.get('token') || new URL(req.url).searchParams.get('token');
  const tokenHeader = req.headers.get('x-order-token');
  const providedToken = tokenParam || tokenHeader;

  if (orderAccessToken && providedToken && providedToken === orderAccessToken) {
    return { allowed: true };
  }

  // 2. Check UID match (if authenticated)
  const callerUid = req.headers.get('x-customer-uid');
  if (orderUid && callerUid && orderUid === callerUid) {
    return { allowed: true };
  }

  // 3. Check Phone match (contact-based verification)
  const callerPhone = req.headers.get('x-customer-phone');
  if (callerPhone && orderCustomerPhone) {
    const cleanOrderPhone = orderCustomerPhone.replace(/[^0-9]/g, '').slice(-10);
    const cleanCallerPhone = callerPhone.replace(/[^0-9]/g, '').slice(-10);

    if (cleanOrderPhone === cleanCallerPhone && cleanOrderPhone.length === 10) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: 'Unauthorized access: You cannot view or modify another customer’s order.',
  };
}

/**
 * Async version of verifyOrderAccess that inspects Firebase Authentication ID tokens.
 */
export async function verifyOrderAccessAsync(
  req: NextRequest,
  orderOrPhone: string | { customer?: { phone: string; uid?: string }; accessToken?: string }
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Check admin authorization
  const adminCheck = await verifyAdminAuthorizationAsync(req);
  if (adminCheck.authorized) {
    return { allowed: true };
  }

  const orderCustomerPhone = typeof orderOrPhone === 'string' ? orderOrPhone : orderOrPhone.customer?.phone;
  const orderAccessToken = typeof orderOrPhone === 'object' ? orderOrPhone.accessToken : undefined;
  const orderUid = typeof orderOrPhone === 'object' ? orderOrPhone.customer?.uid : undefined;

  // 2. Check direct link access token
  const tokenParam = req.nextUrl?.searchParams?.get('token') || new URL(req.url).searchParams.get('token');
  const tokenHeader = req.headers.get('x-order-token');
  const providedToken = tokenParam || tokenHeader;

  if (orderAccessToken && providedToken && providedToken === orderAccessToken) {
    return { allowed: true };
  }

  // 3. Check Firebase ID Token customer authentication
  const customerAuth = await verifyCustomerTokenAsync(req);
  if (customerAuth.authenticated) {
    if (orderUid && customerAuth.uid && orderUid === customerAuth.uid) {
      return { allowed: true };
    }
    if (customerAuth.phone && orderCustomerPhone) {
      const cleanOrderPhone = orderCustomerPhone.replace(/[^0-9]/g, '').slice(-10);
      const cleanCallerPhone = customerAuth.phone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanOrderPhone === cleanCallerPhone && cleanOrderPhone.length === 10) {
        return { allowed: true };
      }
    }
  }

  // 4. Synchronous check fallback
  const syncCheck = verifyOrderAccess(req, orderOrPhone);
  if (syncCheck.allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Unauthorized access: You cannot view or modify another customer’s order.',
  };
}
