# Mahesh Flora 🌸

A mobile-first, daily puja and decorative flower ordering and delivery website built for a family business in **Hyderabad, Telangana, India**, serving residents of nearby gated communities and apartments.

---

## 🌺 Key Features

### 1. Customer Storefront
- **Mobile-First Responsive Design**: Optimized for narrow viewports (~360px) up to desktop screens with touch targets and zero horizontal overflow.
- **Hyderabad Flower Catalogue**: Madurai Jasmine (*Mallepoolu*), Golden & Orange Marigold (*Banthipoolu*), Traditional Mixed Puja Packets, Rose Petals, Tuberose (*Sampangi*), Sacred Lotus (*Kamalam*), Firecracker flowers (*Kanakambaram*), and altar garlands (*Pooja Malalu*).
- **Cart & Pricing Engine**: Server-authoritative price validation in integer paise to eliminate floating-point discrepancies, persistent shopping cart across reloads, free delivery threshold calculation (₹299 free delivery, ₹30 standard fee), and sticky mobile checkout bar.
- **Hyderabad Gated Communities**: Pre-configured delivery routing for communities like *My Home Bhooja, Aparna Serene Park, Jayabheri Silicon County, Prestige High Fields, Rainbow Vistas, Lodha Bellezza, My Home Avatar*, plus custom apartments.

### 2. Delivery Scheduling & Weekly Subscriptions
- **Mode 1: One-Time Delivery**: Choose specific delivery date and time slot (Morning Puja: 6:00 AM – 8:30 AM vs. Evening Sandhya: 5:00 PM – 7:30 PM) with 8:00 PM cutoff protection.
- **Mode 2: Weekly Puja Subscriptions**: Recurring delivery schedule on select days (e.g. Mon, Wed, Fri), start date, and clear weekly cost calculation.
- **Subscription Management**:
  - Skip an upcoming delivery date (excludes the date from generation and billing).
  - Pause a subscription during vacations.
  - Resume a paused subscription.
  - Cancel subscription.
  - Lookup active subscription by 10-digit mobile number.

### 3. Festival Pre-Booking
- Advance floral kit reservations for major festivals (*Ugadi, Varalakshmi Vratham, Vinayaka Chavithi, Diwali Lakshmi Puja*).
- Custom garland notes and Brahma Muhurtham (5:00 AM – 6:30 AM) delivery slots.
- Distinct status lifecycle: *Requested → Confirmed → Payment Pending → Paid → Cancelled*.

### 4. WhatsApp & Payments
- **WhatsApp Click-to-Chat**: Generates prefilled, URL-encoded WhatsApp messages containing the unique Order ID (e.g. `MF-2026-XXXX`), items, slot, and address.
- **Payment Methods**:
  - Cash on Delivery (COD) with admin collection tracking.
  - WhatsApp-assisted UPI payment (Google Pay, PhonePe, Paytm).
- **Payment Verification & Webhook Handling**: HMAC SHA256 signature verification and idempotent webhook processing.
- **Safe Dev Mode Simulator**: Built-in test buttons on the order confirmation page to simulate verified payment or payment failure without charging real money.

### 5. Protected Admin Operations Center (`/admin`)
- Passcode / bearer token authorization on all endpoints (not just UI hiding).
- Real calculated metrics: today's deliveries, today's sales (₹), active subscriptions, pending deliveries.
- Orders management: 1-click status transitions (*Pending → Confirmed → Packing at Dawn → Out for Delivery → Delivered*), and COD cash collection recording.
- Inventory pricing: Edit flower price per unit in ₹, modify units, toggle in-stock status, and add new varieties.
- Subscription manager: Monitor recurring schedules and review skipped dates.
- Business settings: Configure WhatsApp business phone, delivery cut-off hour, and fees.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Custom "Premium Floral" palette: warm ivory `#FAF6F0`, botanical green `#14281E`, floral petal pink)
- **Icons**: Lucide React
- **Data & Storage Layer**: Unified repository (`lib/db/store.ts`) with persistent JSON storage for development and Firebase Cloud Firestore integration ready for production.
- **Testing**: Vitest with `@testing-library/react` and `jsdom`.

---
