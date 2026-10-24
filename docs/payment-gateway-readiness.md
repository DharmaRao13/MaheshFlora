# Mahesh Flora — Payment Gateway Readiness

This checklist tracks engineering work for gateway onboarding. It is not a guarantee of provider approval.

## Current code review findings

- Checkout currently presents WhatsApp-assisted UPI and Cash on Delivery. This is not, by itself, a verified hosted payment-gateway checkout.
- Razorpay payment verification and webhook handlers exist.
- The verification route previously used a fallback development secret and could mark an order failed after an invalid signature request.
- The webhook route previously used a fallback webhook secret and compared signatures with a normal string comparison.
- Public business contact information is rendered from `DEFAULT_SETTINGS` in the footer.
- Do not enable online gateway payments until order creation, amount/currency binding, provider checkout, server verification, webhook verification, and failure/pending paths are tested together.

## Changes in this branch

- Removed the Razorpay verification secret fallback. Missing production configuration returns a service-unavailable response.
- Disabled the payment simulator in production.
- Bound the supplied Razorpay order ID to the internal order when the stored gateway order ID is available.
- Used a timing-safe signature comparison and stopped invalid signatures from mutating order payment status.
- Removed the webhook secret fallback and hardened signature comparison.
- Made webhook handling ignore unrelated events and avoid downgrading a paid order after a late failure event.

## Required environment configuration

Configure these only in the hosting provider's encrypted environment-variable settings, never in client code or committed files:

- `RAZORPAY_KEY_ID` — public checkout key ID, if the existing checkout integration uses it.
- `RAZORPAY_KEY_SECRET` — server-side checkout signature verification secret.
- `RAZORPAY_WEBHOOK_SECRET` — secret configured for the Razorpay webhook endpoint.

Use test-mode credentials for test deployments. Do not copy secrets into issue reports, screenshots, logs, or this repository. If any real secret was ever committed, rotate it in the provider dashboard.

## Before merchant review

- [ ] Confirm the legal/merchant name and any required business registration details.
- [ ] Confirm a working customer support phone number and email address (if available).
- [ ] Confirm the real business/operating address and serviceable delivery area.
- [ ] Publish public About, Contact, Privacy, Terms, Shipping/Delivery, Cancellation, and Refund pages with terms the business actually follows.
- [ ] Confirm all prices, delivery charges, order cutoffs, product availability, and subscription terms are accurate.
- [ ] Confirm the website is publicly accessible to a reviewer and does not expose the Admin dashboard or customer data.
- [ ] Implement/verify server-side gateway order creation using server-calculated prices and INR amounts; never trust the client total.
- [ ] Ensure internal order IDs and provider order IDs are bound and checked.
- [ ] Verify success, failed, cancelled, pending, duplicate callback/webhook, and delayed webhook scenarios.
- [ ] Ensure a client redirect alone can never mark an order paid.
- [ ] Ensure webhook processing is idempotent and can recover from temporary database/provider failures.
- [ ] Run the full test suite and production build; record actual results before claiming readiness.
- [ ] Complete provider KYC/onboarding and test with provider test credentials before switching to live credentials.

## Business decisions still needed

Do not publish invented policy terms. The owner must decide and confirm:
- Which products/orders can be cancelled and by what cutoff time.
- What happens if flowers are unavailable, damaged, or delivery is missed.
- Whether refunds are offered, in what cases, and the expected processing window.
- Whether subscriptions can be paused/cancelled and how festival advance bookings are handled.
- Actual support contact details and business address to display publicly.

## Status

The changes in this branch are a targeted security hardening pass. They do not establish that the complete payment flow builds, passes tests, or is ready for production. Verify the whole integration in a test environment before enabling real payments.
