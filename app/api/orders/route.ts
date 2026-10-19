import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getProducts,
  getSettings,
  createOrder,
  createSubscription,
  getOrders,
  getOrdersByPhone,
  getOrdersByIds,
} from '@/lib/db/store';
import {
  validateIndianPhone,
  calculateOrderTotals,
  checkDeliveryCutoff,
  generateWhatsAppOrderLink,
} from '@/lib/business';
import { verifyAdminAuthorization, verifyAdminAuthorizationAsync, verifyCustomerTokenAsync } from '@/lib/auth';
import { Order, OrderType, DeliverySchedule, Address, PaymentMethod, Subscription } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const idsParam = searchParams.get('ids');

    const adminAuth = await verifyAdminAuthorizationAsync(req);

    // 1. Admin access: can retrieve all orders or query by phone
    if (adminAuth.authorized) {
      if (phone) {
        const orders = await getOrdersByPhone(phone);
        return NextResponse.json({ orders });
      }
      const orders = await getOrders();
      return NextResponse.json({ orders });
    }

    // 2. Customer query authenticated via Firebase ID token (Phone OTP)
    const customerAuth = await verifyCustomerTokenAsync(req);
    if (customerAuth.authenticated) {
      const targetPhone = customerAuth.phone || phone || '';
      const cleanPhone = targetPhone.replace(/[^0-9]/g, '').slice(-10);

      const candidateOrders = cleanPhone ? await getOrdersByPhone(cleanPhone) : await getOrders();
      const verifiedOrders = candidateOrders.filter((o) => {
        if (customerAuth.uid && o.customer?.uid === customerAuth.uid) return true;
        if (cleanPhone && o.customer?.phone?.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) return true;
        return false;
      });
      return NextResponse.json({ orders: verifiedOrders });
    }

    // 2. Customer query by phone:
    // Requires verified phone header 'x-customer-phone' matching query phone
    if (phone) {
      const cleanQueryPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const callerPhoneHeader = req.headers.get('x-customer-phone');
      const cleanCallerHeader = callerPhoneHeader?.replace(/[^0-9]/g, '').slice(-10);

      if (!callerPhoneHeader || cleanCallerHeader !== cleanQueryPhone) {
        return NextResponse.json(
          { error: 'Unauthorized: Phone verification required to view customer orders.' },
          { status: 401 }
        );
      }

      const orders = await getOrdersByPhone(cleanQueryPhone);
      return NextResponse.json({ orders });
    }

    // 3. Customer query by order IDs + tokens:
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      const orders = await getOrdersByIds(ids);
      
      const tokensHeader = req.headers.get('x-order-tokens');
      let tokenMap: Record<string, string> = {};
      try {
        if (tokensHeader) tokenMap = JSON.parse(tokensHeader);
      } catch {}

      const callerPhone = req.headers.get('x-customer-phone')?.replace(/[^0-9]/g, '').slice(-10);

      const verifiedOrders = orders.filter((o) => {
        if (o.accessToken && tokenMap[o.id] === o.accessToken) return true;
        if (callerPhone && o.customer.phone.replace(/[^0-9]/g, '').slice(-10) === callerPhone) return true;
        return false;
      });

      return NextResponse.json({ orders: verifiedOrders });
    }

    // If neither admin nor customer contact credentials provided:
    return NextResponse.json(
      { error: 'Unauthorized: Authentication or contact verification required to access orders.' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer,
      items,
      deliverySchedule,
      paymentMethod,
    }: {
      customer: Address;
      items: { productId: string; quantity: number }[];
      deliverySchedule: DeliverySchedule;
      paymentMethod: PaymentMethod;
    } = body;

    // 1. Validate customer data
    if (!customer?.customerName?.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Customer identity verification
    const customerAuth = await verifyCustomerTokenAsync(req);

    // Normalize Indian phone numbers to E.164 format (+91XXXXXXXXXX)
    const phoneValidation = validateIndianPhone(customer?.phone);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { error: phoneValidation.error },
        { status: 400 }
      );
    }

    // Determine verified UID and verified phone
    const verifiedUid = customerAuth.authenticated ? customerAuth.uid : customer?.uid;
    let verifiedPhone = phoneValidation.formatted;

    if (customerAuth.authenticated && customerAuth.phone) {
      const authPhoneValidation = validateIndianPhone(customerAuth.phone);
      if (authPhoneValidation.valid) {
        verifiedPhone = authPhoneValidation.formatted;
      }
    }

    if (!customer?.apartmentCommunity?.trim()) {
      return NextResponse.json(
        { error: 'Apartment / Gated Community name is required' },
        { status: 400 }
      );
    }

    if (!customer?.flatNumber?.trim()) {
      return NextResponse.json(
        { error: 'Flat number is required' },
        { status: 400 }
      );
    }

    // 2. Validate items and calculate authoritative pricing on server
    const products = await getProducts();
    const settings = await getSettings();

    const calculation = calculateOrderTotals(items, products, settings);
    if (calculation.error) {
      return NextResponse.json(
        { error: calculation.error },
        { status: 400 }
      );
    }

    // 2b. Check if daily flower market prices changed since customer added items to cart
    if (
      typeof body.expectedSubtotalPaise === 'number' &&
      body.expectedSubtotalPaise !== calculation.subtotalPaise &&
      !body.confirmPriceChange
    ) {
      return NextResponse.json(
        {
          code: 'PRICE_CHANGED',
          error: 'Daily flower market price updated',
          message:
            'Market prices have updated since you added items to your cart. Please review and confirm the latest prices before proceeding.',
          previousSubtotalPaise: body.expectedSubtotalPaise,
          currentSubtotalPaise: calculation.subtotalPaise,
          differencePaise: calculation.subtotalPaise - body.expectedSubtotalPaise,
          updatedItems: calculation.orderItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            pricePaise: item.pricePaise,
            unit: item.unit,
            quantity: item.quantity,
            itemTotalPaise: item.itemTotalPaise,
          })),
        },
        { status: 409 }
      );
    }

    // 3. Validate Delivery Schedule
    if (deliverySchedule.type === 'one-time') {
      if (!deliverySchedule.date) {
        return NextResponse.json(
          { error: 'Please select a delivery date' },
          { status: 400 }
        );
      }
      const cutoffCheck = checkDeliveryCutoff(
        deliverySchedule.date,
        deliverySchedule.timeSlot || 'morning',
        settings.deliveryCutoffHour
      );
      if (!cutoffCheck.allowed) {
        return NextResponse.json(
          { error: cutoffCheck.message },
          { status: 400 }
        );
      }
    } else if (deliverySchedule.type === 'subscription') {
      if (!deliverySchedule.daysOfWeek || deliverySchedule.daysOfWeek.length === 0) {
        return NextResponse.json(
          { error: 'Please select at least one delivery day for your subscription' },
          { status: 400 }
        );
      }
      if (!deliverySchedule.subscriptionStartDate) {
        return NextResponse.json(
          { error: 'Please choose a subscription start date' },
          { status: 400 }
        );
      }
    }

    // 4. Generate unique Human Order ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `MF-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // Cleaned customer object with verified UID and normalized E.164 phone
    const validatedCustomer: Address = {
      ...customer,
      uid: verifiedUid,
      phone: verifiedPhone,
    };

    const isCod = paymentMethod === 'cod';
    const isTestMode = !isCod && Boolean(settings.isPaymentTestMode || process.env.PAYMENT_TEST_MODE === 'true');

    const accessToken = crypto.randomUUID();

    const newOrder: Order = {
      id: orderId,
      accessToken,
      customer: validatedCustomer,
      items: calculation.orderItems,
      orderType: deliverySchedule.type,
      subtotalPaise: calculation.subtotalPaise,
      deliveryFeePaise: calculation.deliveryFeePaise,
      totalPaise: calculation.totalPaise,
      deliverySchedule,
      orderStatus: 'pending_confirmation',
      paymentStatus: isCod ? 'payment_due' : 'unpaid',
      paymentMethod,
      testPaymentPaise: isTestMode ? 100 : undefined,
      statusUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // WhatsApp link pre-generation
    newOrder.whatsappLink = generateWhatsAppOrderLink(
      newOrder,
      settings.whatsappNumber,
      settings.upiId,
      isTestMode
    );

    // Save order in store
    const savedOrder = await createOrder(newOrder);

    // If subscription mode, create the corresponding subscription record
    let savedSubscription: Subscription | null = null;
    if (deliverySchedule.type === 'subscription') {
      const subId = `SUB-${Math.floor(1000 + Math.random() * 9000)}`;
      const daysCount = deliverySchedule.daysOfWeek?.length || 1;
      const estimatedWeeklyPaise = calculation.subtotalPaise * daysCount;

      const newSubscription: Subscription = {
        id: subId,
        customer: validatedCustomer,
        items: calculation.orderItems,
        daysOfWeek: deliverySchedule.daysOfWeek || ['Mon'],
        timeSlot: deliverySchedule.timeSlot || 'morning',
        startDate: deliverySchedule.subscriptionStartDate || new Date().toISOString().split('T')[0],
        status: 'active',
        estimatedWeeklyPaise,
        skippedDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savedSubscription = await createSubscription(newSubscription);
    }

    return NextResponse.json({
      success: true,
      order: savedOrder,
      subscription: savedSubscription,
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to place order. Please try again.' },
      { status: 500 }
    );
  }
}
