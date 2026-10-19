import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerTokenAsync } from '@/lib/auth';
import { getSavedAddressById, updateSavedAddress, deleteSavedAddress } from '@/lib/db/store';
import { validateSavedAddress } from '@/lib/business';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const address = await getSavedAddressById(id);
    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (address.uid !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden: Access denied to this address' }, { status: 403 });
    }

    return NextResponse.json({ address });
  } catch (error: any) {
    console.error('Error getting address:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get address' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getSavedAddressById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (existing.uid !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this address' }, { status: 403 });
    }

    const body = await req.json();
    const merged = { ...existing, ...body };
    const validation = validateSavedAddress(merged);
    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json({ error: validation.error || 'Invalid address data' }, { status: 400 });
    }

    const updated = await updateSavedAddress(id, auth.uid, validation.sanitized);
    return NextResponse.json({ address: updated });
  } catch (error: any) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update address' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyCustomerTokenAsync(req);
    if (!auth.authenticated || !auth.uid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getSavedAddressById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (existing.uid !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this address' }, { status: 403 });
    }

    const deleted = await deleteSavedAddress(id, auth.uid);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Address deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete address' },
      { status: 500 }
    );
  }
}
