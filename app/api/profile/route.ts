import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerTokenAsync } from '@/lib/auth';
import { getUserProfileByUid, saveUserProfile } from '@/lib/db/store';
import { validateIndianPhone } from '@/lib/business';
import { UserProfile } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to view your profile.' },
        { status: 401 }
      );
    }

    const existingProfile = await getUserProfileByUid(auth.uid);
    const rawPhone = auth.phone || existingProfile?.phone || '';
    const phoneVal = validateIndianPhone(rawPhone);
    const trustedPhone = phoneVal.valid ? phoneVal.formatted : rawPhone;

    const profile: UserProfile = existingProfile
      ? {
          ...existingProfile,
          phone: trustedPhone, // always enforce trusted phone from auth data
        }
      : {
          uid: auth.uid,
          phone: trustedPhone,
          displayName: '',
          email: auth.email || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to update your profile.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const existing = await getUserProfileByUid(auth.uid);

    // CRITICAL SECURITY RULE:
    // Display the verified phone number from trusted authentication data.
    // Do not allow customers to change their verified number simply by editing a profile field.
    const rawPhone = auth.phone || existing?.phone || '';
    const phoneVal = validateIndianPhone(rawPhone);
    const trustedPhone = phoneVal.valid ? phoneVal.formatted : rawPhone;

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : existing?.displayName || '';
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 120) : existing?.email || '';

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const updatedProfile: UserProfile = {
      uid: auth.uid,
      phone: trustedPhone,
      displayName,
      email,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveUserProfile(updatedProfile);
    return NextResponse.json({ profile: saved });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
