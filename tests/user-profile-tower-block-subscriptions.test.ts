import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  _resetDbForTesting,
  createOrder,
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  getUserProfileByUid,
  saveUserProfile,
  getSavedAddressesByUid,
  getDashboardMetrics,
} from '@/lib/db/store';
import { validateSavedAddress, formatAddressLine } from '@/lib/business';
import { GET as getProfile, PUT as updateProfile } from '@/app/api/profile/route';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { GET as getSubscriptionsRoute, POST as createSubscriptionRoute } from '@/app/api/subscriptions/route';
import { PATCH as updateSubscriptionRoute } from '@/app/api/subscriptions/[id]/route';
import { ADMIN_SECRET_KEY } from '@/lib/auth';

describe('Mahesh Flora — User Profile, Tower & Block, Auto-Save Address, and Subscriptions', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  describe('1. User Profile API & Immutability of Verified Phone', () => {
    it('rejects unauthenticated GET requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/profile');
      const res = await getProfile(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Authentication required');
    });

    it('returns authenticated customer profile with trusted phone number', async () => {
      const uid = 'customer-uid-123';
      const phone = '+919876543210';

      const req = new NextRequest('http://localhost:3000/api/profile', {
        headers: {
          'x-customer-uid': uid,
          'x-customer-phone': '9876543210',
        },
      });

      const res = await getProfile(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.uid).toBe(uid);
      expect(data.profile.phone).toBe('+919876543210');
    });

    it('updates displayName and email, but strictly preserves verified phone number', async () => {
      const uid = 'customer-uid-456';
      const trustedPhone = '+919876543210';

      // Seed initial profile
      await saveUserProfile({
        uid,
        phone: trustedPhone,
        displayName: 'Old Name',
        email: 'old@example.com',
      });

      // Customer attempts to modify phone number along with name
      const req = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': uid,
          'x-customer-phone': '9876543210',
        },
        body: JSON.stringify({
          displayName: 'Ananya Sharma',
          email: 'ananya@example.com',
          phone: '+919999999999', // Attacker attempt to change verified phone
        }),
      });

      const res = await updateProfile(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.displayName).toBe('Ananya Sharma');
      expect(data.profile.email).toBe('ananya@example.com');
      // Must remain the trusted verified phone number!
      expect(data.profile.phone).toBe(trustedPhone);

      // Verify stored in DB
      const stored = await getUserProfileByUid(uid);
      expect(stored?.displayName).toBe('Ananya Sharma');
      expect(stored?.phone).toBe(trustedPhone);
    });

    it('rejects invalid email formats', async () => {
      const req = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': 'uid-test',
          'x-customer-phone': '9876543210',
        },
        body: JSON.stringify({
          displayName: 'Valid Name',
          email: 'invalid-email-address',
        }),
      });

      const res = await updateProfile(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('valid email address');
    });
  });

  describe('2. Tower and Block Address Support & Backward Compatibility', () => {
    it('validates and sanitizes optional tower and block fields', () => {
      const payload = {
        recipientName: 'Ramesh Patel',
        phone: '9876543210',
        flatNumber: '402',
        tower: ' Tower 3 ',
        block: ' Block B ',
        locality: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        label: 'Home',
      };

      const result = validateSavedAddress(payload);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.tower).toBe('Tower 3');
      expect(result.sanitized?.block).toBe('Block B');
    });

    it('preserves backward compatibility when tower and block are omitted', () => {
      const legacyPayload = {
        recipientName: 'Suresh Kumar',
        phone: '9876543210',
        flatNumber: 'Villa 12',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        label: 'Home',
      };

      const result = validateSavedAddress(legacyPayload);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.tower).toBeUndefined();
      expect(result.sanitized?.block).toBeUndefined();
    });

    it('formatAddressLine helper correctly formats flat, tower, block, and street', () => {
      // With tower and block
      const full = formatAddressLine({
        flatNumber: '804',
        tower: '3',
        block: 'A',
        street: '8th Main',
      });
      expect(full).toBe('Flat 804, Tower 3, Block A, 8th Main');

      // Without tower and block (legacy)
      const legacy = formatAddressLine({
        flatNumber: 'Flat 101',
        street: '1st Cross',
      });
      expect(legacy).toBe('Flat 101, 1st Cross');
    });
  });

  describe('3. Automatically Save First Order Delivery Address', () => {
    it('automatically saves the delivery address to customer profile as default on first order', async () => {
      const uid = 'first-time-customer-uid';
      const phone = '9876543210';

      // Check customer has zero saved addresses initially
      const initialAddresses = await getSavedAddressesByUid(uid);
      expect(initialAddresses.length).toBe(0);

      const orderPayload = {
        customer: {
          customerName: 'Priya Sharma',
          recipientName: 'Priya Sharma',
          phone,
          flatNumber: '502',
          tower: 'Orchid',
          block: 'B',
          apartmentCommunity: 'Sobha Dream Acres',
          locality: 'Panathur',
          landmark: 'Opposite Clubhouse',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560087',
        },
        items: [
          {
            productId: 'prod-jasmine',
            quantity: 2,
          },
        ],
        deliverySchedule: {
          type: 'one-time',
          date: '2026-10-28',
          timeSlot: 'morning',
        },
        paymentMethod: 'cod',
      };

      const req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': uid,
          'x-customer-phone': phone,
        },
        body: JSON.stringify(orderPayload),
      });

      const res = await createOrderRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.order).toBeDefined();
      expect(data.order.customer.tower).toBe('Orchid');
      expect(data.order.customer.block).toBe('B');

      // Address should now be automatically saved as default address in profile!
      const savedAddresses = await getSavedAddressesByUid(uid);
      expect(savedAddresses.length).toBe(1);
      const autoSaved = savedAddresses[0];
      expect(autoSaved.flatNumber).toBe('502');
      expect(autoSaved.tower).toBe('Orchid');
      expect(autoSaved.block).toBe('B');
      expect(autoSaved.apartmentCommunity).toBe('Sobha Dream Acres');
      expect(autoSaved.isDefault).toBe(true);
      expect(autoSaved.uid).toBe(uid);
    });

    it('does not duplicate saved addresses on subsequent orders if address already exists', async () => {
      const uid = 'repeat-customer-uid';
      const phone = '9876543210';

      const orderPayload = {
        customer: {
          customerName: 'Priya Sharma',
          recipientName: 'Priya Sharma',
          phone,
          flatNumber: '502',
          tower: 'Orchid',
          block: 'B',
          apartmentCommunity: 'Sobha Dream Acres',
          locality: 'Panathur',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560087',
        },
        items: [
          {
            productId: 'prod-jasmine',
            quantity: 1,
          },
        ],
        deliverySchedule: {
          type: 'one-time',
          date: '2026-10-28',
          timeSlot: 'morning',
        },
        paymentMethod: 'cod',
      };

      // Order 1: auto-saves address
      const req1 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': uid,
          'x-customer-phone': phone,
        },
        body: JSON.stringify(orderPayload),
      });
      await createOrderRoute(req1);

      let saved = await getSavedAddressesByUid(uid);
      expect(saved.length).toBe(1);

      // Order 2: repeat checkout with same address
      const req2 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': uid,
          'x-customer-phone': phone,
        },
        body: JSON.stringify(orderPayload),
      });
      const res2 = await createOrderRoute(req2);
      expect(res2.status).toBe(200);

      // Must remain 1 address, not duplicated!
      saved = await getSavedAddressesByUid(uid);
      expect(saved.length).toBe(1);
    });
  });

  describe('4. Subscription Persistence, Admin Visibility & Customer Isolation', () => {
    it('persists subscriptions created via checkout or API with customer UID and phone', async () => {
      const subUid = 'sub-cust-uid-789';
      const subPhone = '9876543210';

      const subscriptionPayload = {
        customer: {
          customerName: 'Vijay Varma',
          phone: subPhone,
          flatNumber: '304',
          tower: 'Tower A',
          block: 'Block 1',
          apartmentCommunity: 'Godrej Woodsman Estate',
          locality: 'Hebbal',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560024',
        },
        items: [
          {
            productId: 'marigold-yellow-1',
            quantity: 3,
            unit: 'string',
            name: 'Yellow Marigold Garland',
            pricePaise: 4000,
            itemTotalPaise: 12000,
          },
        ],
        daysOfWeek: ['Mon', 'Wed', 'Fri'],
        timeSlot: 'morning',
        startDate: '2026-10-25',
        estimatedWeeklyPaise: 36000,
      };

      const req = new NextRequest('http://localhost:3000/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': subUid,
          'x-customer-phone': subPhone,
        },
        body: JSON.stringify(subscriptionPayload),
      });

      const res = await createSubscriptionRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.subscription).toBeDefined();
      expect(data.subscription.id).toMatch(/^SUB-/);
      expect(data.subscription.customer.uid).toBe(subUid);
      expect(data.subscription.customer.tower).toBe('Tower A');
      expect(data.subscription.status).toBe('active');

      // Verify stored in DB
      const dbSubs = await getSubscriptions();
      expect(dbSubs.some((s) => s.id === data.subscription.id)).toBe(true);
    });

    it('allows Admin to view all subscriptions with full details and metrics', async () => {
      // Create subscriptions for two different users
      await createSubscription({
        id: 'SUB-1001',
        customer: {
          uid: 'user-1',
          customerName: 'User One',
          phone: '+919876543210',
          apartmentCommunity: 'Prestige Falcon',
          buildingTower: 'Tower 1',
          flatNumber: '101',
        },
        items: [],
        daysOfWeek: ['Mon'],
        timeSlot: 'morning',
        startDate: '2026-10-25',
        status: 'active',
        estimatedWeeklyPaise: 15000,
        skippedDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await createSubscription({
        id: 'SUB-1002',
        customer: {
          uid: 'user-2',
          customerName: 'User Two',
          phone: '+919988776655',
          apartmentCommunity: 'Brigade Metropolis',
          buildingTower: 'Tower B',
          flatNumber: '202',
        },
        items: [],
        daysOfWeek: ['Tue', 'Thu'],
        timeSlot: 'morning',
        startDate: '2026-10-26',
        status: 'active',
        estimatedWeeklyPaise: 30000,
        skippedDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Admin request
      const adminReq = new NextRequest('http://localhost:3000/api/subscriptions', {
        headers: {
          'x-admin-key': ADMIN_SECRET_KEY,
        },
      });

      const res = await getSubscriptionsRoute(adminReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriptions.length).toBe(2);

      // Verify metrics
      const metrics = await getDashboardMetrics();
      expect(metrics.activeSubscriptionsCount).toBe(2);
    });

    it('enforces customer isolation: customers see only their own subscriptions and cannot access others', async () => {
      const userA = 'user-cust-A';
      const userB = 'user-cust-B';

      const subA = await createSubscription({
        id: 'SUB-A',
        customer: {
          uid: userA,
          customerName: 'Customer A',
          phone: '+919876543210',
          apartmentCommunity: 'Community A',
          buildingTower: '',
          flatNumber: '101',
        },
        items: [],
        daysOfWeek: ['Mon'],
        timeSlot: 'morning',
        startDate: '2026-10-25',
        status: 'active',
        estimatedWeeklyPaise: 15000,
        skippedDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const subB = await createSubscription({
        id: 'SUB-B',
        customer: {
          uid: userB,
          customerName: 'Customer B',
          phone: '+919111222333',
          apartmentCommunity: 'Community B',
          buildingTower: '',
          flatNumber: '202',
        },
        items: [],
        daysOfWeek: ['Wed'],
        timeSlot: 'morning',
        startDate: '2026-10-25',
        status: 'active',
        estimatedWeeklyPaise: 20000,
        skippedDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // User A requests subscriptions
      const userAReq = new NextRequest('http://localhost:3000/api/subscriptions', {
        headers: {
          'x-customer-uid': userA,
          'x-customer-phone': '9876543210',
        },
      });

      const resA = await getSubscriptionsRoute(userAReq);
      expect(resA.status).toBe(200);
      const dataA = await resA.json();
      expect(dataA.subscriptions.length).toBe(1);
      expect(dataA.subscriptions[0].id).toBe(subA.id);

      // User A attempts to modify User B's subscription
      const illegalPatchReq = new NextRequest(`http://localhost:3000/api/subscriptions/${subB.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': userA,
          'x-customer-phone': '9876543210',
        },
        body: JSON.stringify({ action: 'pause' }),
      });

      const patchRes = await updateSubscriptionRoute(illegalPatchReq, {
        params: Promise.resolve({ id: subB.id }),
      });
      expect(patchRes.status).toBe(403);
      const patchData = await patchRes.json();
      expect(patchData.error).toContain('Forbidden');

      // Verify subB remains active and unchanged
      const subBCheck = await getSubscriptionById(subB.id);
      expect(subBCheck?.status).toBe('active');
    });
  });
});
