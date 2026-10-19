import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SECRET_KEY } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode, idToken } = body;

    // 1. Firebase ID token verification
    if (idToken) {
      const adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(idToken);
          const userEmail = (decoded.email || '').toLowerCase();
          if (decoded.admin === true) {
            const response = NextResponse.json({
              success: true,
              message: 'Firebase Admin authentication successful.',
              adminKey: idToken,
              email: userEmail,
            });
            response.cookies.set('admin_token', idToken, {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 7,
            });
            return response;
          }
          return NextResponse.json(
            { error: 'Forbidden: Authenticated user does not possess administrative privileges (admin: true claim required).' },
            { status: 403 }
          );
        } catch (err: any) {
          return NextResponse.json(
            { error: `Invalid Firebase authentication token: ${err.message}` },
            { status: 401 }
          );
        }
      }
    }

    // 2. Passcode verification
    if (passcode === ADMIN_SECRET_KEY) {
      const response = NextResponse.json({
        success: true,
        message: 'Admin authorization granted.',
        adminKey: ADMIN_SECRET_KEY,
      });

      // Set HTTP cookie (allow over local Wi-Fi HTTP)
      response.cookies.set('admin_token', ADMIN_SECRET_KEY, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid admin passcode. Access denied.' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
