import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptions,
  getSubscriptionsByPhone,
  getSubscriptionsByCustomerUid,
  createSubscription,
} from '@/lib/db/store';
import { validateIndianPhone } from '@/lib/business';
import { verifyAdminAuthorizationAsync, verifyCustomerTokenAsync } from '@/lib/auth';
import { Subscription } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phoneParam = searchParams.get('phone');

    // 1. Check Admin Authorization
    const adminAuth = await verifyAdminAuthorizationAsync(req);
    if (adminAuth.authorized) {
      if (phoneParam) {
        const subs = await getSubscriptionsByPhone(phoneParam);
        return NextResponse.json({ subscriptions: subs });
      }
      const allSubs = await getSubscriptions();
      return NextResponse.json({ subscriptions: allSubs });
    }

    // 2. Check Customer Authentication
    const customerAuth = await verifyCustomerTokenAsync(req);
    if (customerAuth.authenticated && customerAuth.uid) {
      // If customer provides phone search, ensure they can only query their own phone
      if (phoneParam && customerAuth.phone) {
        const normSearch = phoneParam.replace(/\D/g, '').slice(-10);
        const normAuth = customerAuth.phone.replace(/\D/g, '').slice(-10);
        if (normSearch && normAuth && normSearch !== normAuth) {
          return NextResponse.json(
            { error: 'Forbidden: You can only view your own subscriptions.' },
            { status: 403 }
          );
        }
      }

      // Customer isolation: query by UID or verified phone
      let subs = await getSubscriptionsByCustomerUid(customerAuth.uid);
      if (subs.length === 0 && customerAuth.phone) {
        subs = await getSubscriptionsByPhone(customerAuth.phone);
      }
      return NextResponse.json({ subscriptions: subs });
    }

    // 3. Guest lookup with exact phone (for manual search without login)
    if (phoneParam) {
      const phoneVal = validateIndianPhone(phoneParam);
      if (!phoneVal.valid) {
        return NextResponse.json({ error: phoneVal.error || 'Invalid phone number' }, { status: 400 });
      }
      const subs = await getSubscriptionsByPhone(phoneVal.formatted);
      return NextResponse.json({ subscriptions: subs });
    }

    // Unauthenticated request without phone is denied
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to view subscriptions.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Subscriptions GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customerAuth = await verifyCustomerTokenAsync(req);
    const body = await req.json();

    const { customer, items, daysOfWeek, timeSlot, startDate, estimatedWeeklyPaise } = body;

    if (!customer || !customer.phone) {
      return NextResponse.json({ error: 'Customer phone number is required' }, { status: 400 });
    }

    const phoneVal = validateIndianPhone(customer.phone);
    if (!phoneVal.valid) {
      return NextResponse.json({ error: phoneVal.error }, { status: 400 });
    }

    const verifiedUid = customerAuth.authenticated ? customerAuth.uid : customer.uid;
    const verifiedPhone = customerAuth.authenticated && customerAuth.phone ? customerAuth.phone : phoneVal.formatted;

    const subId = `SUB-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSub: Subscription = {
      id: subId,
      customer: {
        ...customer,
        uid: verifiedUid,
        phone: verifiedPhone,
        flatNumber: (customer.flatNumber || '').trim(),
        tower: customer.tower?.trim() || undefined,
        block: customer.block?.trim() || undefined,
        street: customer.street?.trim() || undefined,
        apartmentCommunity: customer.apartmentCommunity?.trim() || customer.locality?.trim() || '',
        locality: customer.locality?.trim() || customer.apartmentCommunity?.trim() || '',
        landmark: customer.landmark?.trim() || undefined,
        city: customer.city?.trim() || 'Bengaluru',
        state: customer.state?.trim() || 'Karnataka',
        pincode: customer.pincode?.trim() || '560001',
      },
      items: items || [],
      daysOfWeek: daysOfWeek || ['Mon'],
      timeSlot: timeSlot || 'morning',
      startDate: startDate || new Date().toISOString().split('T')[0],
      status: 'active',
      estimatedWeeklyPaise: typeof estimatedWeeklyPaise === 'number' ? estimatedWeeklyPaise : 0,
      skippedDates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await createSubscription(newSub);
    return NextResponse.json({ success: true, subscription: saved }, { status: 201 });
  } catch (error: any) {
    console.error('Subscription POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
  }
}
