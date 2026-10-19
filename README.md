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

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18 or later (v24 tested)
- npm v9 or later

### 2. Installation
```bash
git clone <repo-url>
cd Flora
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Default local `.env.local`:
```env
NEXT_PUBLIC_APP_NAME="Mahesh Flora"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_BUSINESS_PHONE="+919876543210"
NEXT_PUBLIC_BUSINESS_LOCATION="Hyderabad, Telangana, India"
NEXT_PUBLIC_DEFAULT_CURRENCY="INR"
NEXT_PUBLIC_TIMEZONE="Asia/Kolkata"

ADMIN_SECRET_KEY="mahesh-flora-admin-secret-dev-key"
ENABLE_DEV_MOCK_STORAGE="true"
ENABLE_PAYMENT_SIMULATOR="true"
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Testing on Your Physical Phone

The application is configured to bind to `0.0.0.0:3000`, making it accessible across your local Wi-Fi network.

### Step 1: Find Laptop's Wi-Fi IP Address
On Windows PowerShell:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" } | Select-Object IPAddress
```
*Current detected IP:* `10.122.130.147`

### Step 2: Start the Server
```bash
npm run dev
# or for optimized production build:
npm run build
npm start
```

### Step 3: Open on Your Phone
1. Connect your Android or iPhone to the **same Wi-Fi network** as your laptop.
2. Open your mobile browser (Chrome / Safari) and navigate to:
   ```
   http://10.122.130.147:3000
   ```
3. Test the mobile customer flow:
   - Add Jasmine or Marigold to cart.
   - Observe the sticky mobile bottom checkout bar.
   - Proceed to checkout and select your gated community.
   - Place an order and tap the WhatsApp button to verify pre-filled message encoding.

### Windows Firewall Troubleshooting
If your phone cannot load the page:
1. Open PowerShell as Administrator and allow inbound traffic on port 3000:
   ```powershell
   New-NetFirewallRule -DisplayName "Mahesh Flora Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
2. Ensure your Wi-Fi network profile is set to **Private** rather than Public.

---

## 🧪 Automated Test Suite (15/15 Requirements Passed)

Run the full automated test suite:
```bash
npm test
```

### Test Coverage Summary:
- **TEST 1**: Add Jasmine to cart → Quantity and subtotal update correctly.
- **TEST 2**: Increase quantity → Total updates correctly with delivery fee rules.
- **TEST 3**: Attempt checkout with empty cart → Blocked with friendly validation error.
- **TEST 4**: Submit invalid mobile number → Regex validation flags error, normalizes valid 10-digit Indian numbers.
- **TEST 5**: Choose Monday, Wednesday, and Friday deliveries → Schedule summary shows selected days.
- **TEST 6**: Skip an upcoming delivery → Skipped date is excluded from the delivery schedule.
- **TEST 7**: Pause a subscription → Future deliveries are not generated while paused; resume restores schedule.
- **TEST 8**: Create festival booking → Stored in database and visible in admin dashboard.
- **TEST 9**: Choose WhatsApp-assisted UPI → Valid order summary and pre-filled WhatsApp link generated.
- **TEST 10**: Simulate unsuccessful payment → Order remains unpaid / failed.
- **TEST 11**: Simulate verified payment → Payment status updates to `paid` with server timestamp.
- **TEST 12**: Attempt unauthorized admin access → Returns `401 Unauthorized`.
- **TEST 13**: Attempt to modify another customer's order → Blocked with customer isolation check.
- **TEST 14**: Reload website → Cart and orders persist reliably across requests.
- **TEST 15**: Mobile viewport flow → Validates delivery cutoffs and responsive constraints.

---

## 🔐 Firebase Firestore Security Rules

Deploy the included `firestore.rules` file to your Firebase project:
```bash
firebase deploy --only firestore:rules
```
The security rules ensure:
- Products, festivals, and business settings are publicly readable, but can only be modified by admins.
- Customers can only read and create their own orders and subscriptions.
- Customers cannot modify order statuses or mark orders as paid.
- All admin mutations are protected server-side.

---

## 💳 Razorpay Test Mode Setup

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Generate Test API Keys from **Settings → API Keys**.
3. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_..."
   RAZORPAY_KEY_SECRET="..."
   RAZORPAY_WEBHOOK_SECRET="..."
   ```
4. Webhook URL: `https://<your-domain>/api/webhooks/razorpay` (Listen for `payment.captured` and `payment.failed`).
