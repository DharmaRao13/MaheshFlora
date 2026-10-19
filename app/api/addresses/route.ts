import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerTokenAsync } from '@/lib/auth';
import { getSavedAddressesByUid, createSavedAddress } from '@/lib/db/store';
import { validateSavedAddress } from '@/lib/business';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to view saved addresses.' },
        { status: 401 }
      );
    }

    const addresses = await getSavedAddressesByUid(auth.uid);
    return NextResponse.json({ addresses });
  } catch (error: any) {
    console.error('Error fetching saved addresses:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch saved addresses' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to save an address.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = validateSavedAddress(body);
    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        { error: validation.error || 'Invalid address details' },
        { status: 400 }
      );
    }

    // Server-enforced customer UID: never trust client-supplied UID
    const addressData = {
      ...validation.sanitized,
      uid: auth.uid,
    };

    const newAddress = await createSavedAddress(addressData as any);
    return NextResponse.json({ address: newAddress }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating saved address:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create saved address' },
      { status: 500 }
    );
  }
}
