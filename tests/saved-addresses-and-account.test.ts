import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validatePincode,
  validateSavedAddress,
  maskPhoneNumber,
} from '@/lib/business';
import {
  _resetDbForTesting,
  createSavedAddress,
  getSavedAddressesByUid,
  getSavedAddressById,
  updateSavedAddress,
  deleteSavedAddress,
  createOrder,
  getOrderById,
} from '@/lib/db/store';
import { GET as getAddresses, POST as createAddressRoute } from '@/app/api/addresses/route';
import {
  GET as getSingleAddress,
  PUT as updateAddressRoute,
  DELETE as deleteAddressRoute,
} from '@/app/api/addresses/[id]/route';

describe('Mahesh Flora — Saved Delivery Addresses & Customer Account Experience', () => {
  beforeEach(() => {
    _resetDbForTesting();
  });

  describe('1. Business Validation & Phone Masking Helpers', () => {
    it('validates 6-digit Indian PIN codes correctly', () => {
      // Valid PIN codes
      expect(validatePincode('560001').valid).toBe(true);
      expect(validatePincode('500081').valid).toBe(true);
      expect(validatePincode('110001').valid).toBe(true);

      // Invalid PIN codes
      expect(validatePincode('060001').valid).toBe(false); // starts with 0
      expect(validatePincode('56000').valid).toBe(false);  // 5 digits
      expect(validatePincode('5600001').valid).toBe(false); // 7 digits
      expect(validatePincode('56000A').valid).toBe(false); // non-digits
      expect(validatePincode('').valid).toBe(false);
    });

    it('masks Indian phone numbers for customer account display', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91 98765 •••••');
      expect(maskPhoneNumber('9876543210')).toBe('+91 98765 •••••');
      expect(maskPhoneNumber('+91 98765 43210')).toBe('+91 98765 •••••');
      expect(maskPhoneNumber(null)).toBe('');
    });

    it('validates and sanitizes saved address payloads', () => {
      const validPayload = {
        recipientName: '  Radhika Sharma  ',
        phone: '9876543210',
        flatNumber: 'Flat 402',
        locality: 'BTM 2nd Stage',
        apartmentCommunity: 'Prestige Falcon City',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560076',
        label: 'Home',
        isDefault: true,
      };

      const res = validateSavedAddress(validPayload);
      expect(res.valid).toBe(true);
      expect(res.sanitized?.recipientName).toBe('Radhika Sharma');
      expect(res.sanitized?.phone).toBe('+919876543210');
      expect(res.sanitized?.pincode).toBe('560076');
      expect(res.sanitized?.city).toBe('Bengaluru');

      // Invalid missing name
      expect(validateSavedAddress({ ...validPayload, recipientName: '' }).valid).toBe(false);

      // Invalid phone
      expect(validateSavedAddress({ ...validPayload, phone: '123' }).valid).toBe(false);

      // Invalid PIN
      expect(validateSavedAddress({ ...validPayload, pincode: '000000' }).valid).toBe(false);
    });
  });

  describe('2. Address Store CRUD and Customer UID Isolation', () => {
    it('creates address, automatically sets first address as default, and enforces UID isolation', async () => {
      const userA = 'user-firebase-A';
      const userB = 'user-firebase-B';

      // First address for userA
      const addr1 = await createSavedAddress({
        uid: userA,
        recipientName: 'User A Home',
        phone: '+919876543210',
        flatNumber: '101',
        locality: 'Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        label: 'Home',
        isDefault: false, // will become true because it's first
      });

      expect(addr1.isDefault).toBe(true);
      expect(addr1.id).toBeDefined();

      // Second address for userA set as default
      const addr2 = await createSavedAddress({
        uid: userA,
        recipientName: 'User A Office',
        phone: '+919876543210',
        flatNumber: '202',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        label: 'Work',
        isDefault: true,
      });

      expect(addr2.isDefault).toBe(true);

      // Verify addr1 was demoted from default
      const refreshedAddr1 = await getSavedAddressById(addr1.id);
      expect(refreshedAddr1?.isDefault).toBe(false);

      // Address for userB
      const addrB = await createSavedAddress({
        uid: userB,
        recipientName: 'User B Temple',
        phone: '+919988776655',
        flatNumber: 'Villa 5',
        locality: 'Jayanagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560011',
        label: 'Mandir/Pooja Room',
        isDefault: true,
      });

      // Customer isolation: userA queries only their addresses
      const userAAddresses = await getSavedAddressesByUid(userA);
      expect(userAAddresses.length).toBe(2);
      expect(userAAddresses.find((a) => a.id === addrB.id)).toBeUndefined();
      expect(userAAddresses[0].id).toBe(addr2.id); // default address sorted first

      // UserB queries only their addresses
      const userBAddresses = await getSavedAddressesByUid(userB);
      expect(userBAddresses.length).toBe(1);
      expect(userBAddresses[0].id).toBe(addrB.id);
    });

    it('updates and deletes address with UID ownership check', async () => {
      const userA = 'user-firebase-A';
      const userB = 'user-firebase-B';

      const addr = await createSavedAddress({
        uid: userA,
        recipientName: 'Initial Name',
        phone: '+919876543210',
        flatNumber: '301',
        locality: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        label: 'Home',
        isDefault: true,
      });

      // User B cannot update User A's address
      const unauthorizedUpdate = await updateSavedAddress(addr.id, userB, {
        recipientName: 'Hacker Name',
      });
      expect(unauthorizedUpdate).toBeNull();

      // User A can update
      const authorizedUpdate = await updateSavedAddress(addr.id, userA, {
        recipientName: 'Updated Name',
        flatNumber: '302',
      });
      expect(authorizedUpdate?.recipientName).toBe('Updated Name');
      expect(authorizedUpdate?.flatNumber).toBe('302');

      // User B cannot delete User A's address
      const unauthorizedDelete = await deleteSavedAddress(addr.id, userB);
      expect(unauthorizedDelete).toBe(false);

      // User A deletes address
      const authorizedDelete = await deleteSavedAddress(addr.id, userA);
      expect(authorizedDelete).toBe(true);

      const afterDelete = await getSavedAddressById(addr.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe('3. Saved Addresses API Routes Authorization & Validation', () => {
    it('GET /api/addresses rejects unauthenticated requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/addresses');
      const res = await getAddresses(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/addresses rejects unauthenticated requests with 401 and enforces server-side UID', async () => {
      // Unauthenticated
      const unauthReq = new NextRequest('http://localhost:3000/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientName: 'Test' }),
      });
      const unauthRes = await createAddressRoute(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Authenticated as test-user-123
      const authReq = new NextRequest('http://localhost:3000/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': 'test-user-123',
        },
        body: JSON.stringify({
          recipientName: 'Pooja Room',
          phone: '9876543210',
          flatNumber: '10',
          locality: 'Malleshwaram',
          pincode: '560003',
          label: 'Mandir/Pooja Room',
          uid: 'attempted-spoofed-uid', // client tries to spoof UID
        }),
      });

      const authRes = await createAddressRoute(authReq);
      expect(authRes.status).toBe(201);
      const data = await authRes.json();
      expect(data.address.uid).toBe('test-user-123'); // strictly enforced to auth UID
      expect(data.address.recipientName).toBe('Pooja Room');
    });

    it('DELETE and PUT /api/addresses/[id] prevent cross-user modification with 403', async () => {
      // Create address owned by user A
      const addr = await createSavedAddress({
        uid: 'user-A',
        recipientName: 'User A Address',
        phone: '+919876543210',
        flatNumber: '404',
        locality: 'HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560102',
        label: 'Home',
        isDefault: true,
      });

      // User B tries to update User A's address
      const updateReq = new NextRequest(`http://localhost:3000/api/addresses/${addr.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': 'user-B',
        },
        body: JSON.stringify({ recipientName: 'Stolen' }),
      });
      const updateRes = await updateAddressRoute(updateReq, {
        params: Promise.resolve({ id: addr.id }),
      });
      expect(updateRes.status).toBe(403);

      // User B tries to delete User A's address
      const deleteReq = new NextRequest(`http://localhost:3000/api/addresses/${addr.id}`, {
        method: 'DELETE',
        headers: {
          'x-customer-uid': 'user-B',
        },
      });
      const deleteRes = await deleteAddressRoute(deleteReq, {
        params: Promise.resolve({ id: addr.id }),
      });
      expect(deleteRes.status).toBe(403);

      // User A can update successfully
      const validUpdateReq = new NextRequest(`http://localhost:3000/api/addresses/${addr.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-uid': 'user-A',
        },
        body: JSON.stringify({ recipientName: 'User A Updated' }),
      });
      const validUpdateRes = await updateAddressRoute(validUpdateReq, {
        params: Promise.resolve({ id: addr.id }),
      });
      expect(validUpdateRes.status).toBe(200);
      const updateJson = await validUpdateRes.json();
      expect(updateJson.address.recipientName).toBe('User A Updated');
    });
  });

  describe('4. Order Immutable Address Snapshot', () => {
    it('stores immutable address snapshot in orders so subsequent address edits never mutate history', async () => {
      const userUid = 'customer-order-uid';

      // 1. Customer creates a saved address
      const savedAddr = await createSavedAddress({
        uid: userUid,
        recipientName: 'Deepa Rao',
        phone: '+919876543210',
        flatNumber: 'A-204',
        apartmentCommunity: 'Sobha Forest View',
        locality: 'Kanakapura Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560062',
        label: 'Home',
        isDefault: true,
      });

      // 2. Customer places an order using this address snapshot
      const order = await createOrder({
        accessToken: 'tok-immutable-123',
        customer: {
          uid: userUid,
          customerName: savedAddr.recipientName,
          recipientName: savedAddr.recipientName,
          phone: savedAddr.phone,
          apartmentCommunity: savedAddr.apartmentCommunity || '',
          buildingTower: 'Block 2',
          flatNumber: savedAddr.flatNumber,
          locality: savedAddr.locality,
          city: savedAddr.city,
          state: savedAddr.state,
          pincode: savedAddr.pincode,
          label: savedAddr.label,
        },
        items: [
          {
            productId: 'prod-jasmine',
            name: 'Fresh Jasmine (Mogra)',
            pricePaise: 15000,
            unit: '250g',
            quantity: 2,
            itemTotalPaise: 30000,
          },
        ],
        orderType: 'one-time',
        subtotalPaise: 30000,
        deliveryFeePaise: 0,
        totalPaise: 30000,
        deliverySchedule: {
          type: 'one-time',
          date: '2026-10-21',
          timeSlot: 'morning',
        },
        orderStatus: 'pending_confirmation',
        paymentStatus: 'unpaid',
        paymentMethod: 'whatsapp_upi',
      });

      expect(order.customer.flatNumber).toBe('A-204');
      expect(order.customer.recipientName).toBe('Deepa Rao');

      // 3. Customer modifies their saved address in profile
      await updateSavedAddress(savedAddr.id, userUid, {
        flatNumber: 'B-909 (Moved to new flat)',
        recipientName: 'Deepa S. Rao',
        locality: 'Indiranagar',
      });

      // 4. Retrieve order again: verify historical order address remains strictly unchanged!
      const historicalOrder = await getOrderById(order.id);
      expect(historicalOrder?.customer.flatNumber).toBe('A-204');
      expect(historicalOrder?.customer.recipientName).toBe('Deepa Rao');
      expect(historicalOrder?.customer.locality).toBe('Kanakapura Road');

      // 5. Delete saved address completely: verify historical order still retains snapshot
      await deleteSavedAddress(savedAddr.id, userUid);
      const afterDeleteOrder = await getOrderById(order.id);
      expect(afterDeleteOrder?.customer.flatNumber).toBe('A-204');
      expect(afterDeleteOrder?.customer.recipientName).toBe('Deepa Rao');
    });
  });
});
