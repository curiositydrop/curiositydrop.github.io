# MyDealsPortal — live billing handoff (NOT DEPLOYED)

## Verified Stripe live catalog (2026-10-09)
- Founding 100 product: `prod_VPKQuKYmPkXoGa`; recurring USD monthly price: `price_1UOVlFIHJWXNHkKxKgfNFoRy` ($44.99).
- Standard Business product: `prod_VPKQKZ7rTfi1xy`; recurring USD monthly price: `price_1UOVlJIHJWXNHkKxDCIpogsu` ($49.99).
- Neither product price by itself implements a discount or payment authorization.
- Account review/approval and tax obligations remain independent of the catalog.

## Advertised subscription terms
| Period | Founding 100 | Standard |
|---|---|---|
| Initial checkout / month 1 | $44.99 | $49.99 |
| Month 2 | $0 | $0 |
| Month 3 | $0 | $49.99 |
| Month 4 onward | $44.99/month | $49.99/month |

Founding status is reserved for the **first 100 successfully paid businesses**, not the first 100 signup attempts. Maintain the founding price while continuously subscribed, with explicit documented policy for cancellation/rejoining. The application must not imply that Stripe's catalog enforces the 100-business cap.

## Required implementation before ANY live checkout
1. Keep `sandboxCheckout` and `stripeSandboxWebhook` test-only. Never replace their `sk_test_` guard with an unrestricted key or reuse the sandbox webhook to process live traffic.
2. Implement a new versioned **server-only** live checkout function using a dedicated live Stripe secret stored in Firebase Secret Manager. Verify Firebase ID token, business ownership, allowed origin, and verified price choice **on the server**, with no user-supplied Stripe price/customer IDs.
3. Reserve a founding slot atomically in Firestore *when payment is confirmed*; handle concurrent pending sessions, abandoned checkout sessions and webhook retries. If all slots are taken, offer standard pricing and seek consent **before** any charge at a different price.
4. Upon confirmed paid checkout, create/update the subscription's schedule with explicit phases: first paid month; next 2 months (founding) or 1 month (standard) at 100% discount / zero billed; then full-price monthly until cancellation. Prefer schedule phases over expiring generic checkout promo codes; confirm the first invoice has actually succeeded before setting the phase schedule. Explicitly set schedule end behavior to release to avoid terminating long-running subscriptions. Ensure invoice retries and failure do not give free advertising.
5. Verify signature of raw Stripe webhook body; ensure durable event-id deduplication, subscription-ID reconciliation, idempotency and out-of-order handling. Handle checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated/deleted, payment reconciliation and cancellation. Never trust redirect parameters as evidence of payment.
6. Server-owned fields: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `status`, `foundingSlot`, etc. Owner must not be able to write these from web browser. Audit Firestore rules and all query patterns before enforcement.
7. Business publishing/advertising visibility may become active only after verified entitlement; define policy for free promotional months (remain active), grace periods and failed payments; make paused listings invisible publicly.
8. Keep `mydealsportal-preview` explicitly test-only until all end-to-end tests pass. Preserve the signup/login flow and never create a second Firebase business account during checkout.
9. Before production: test Stripe sandbox with Test Clocks across at least 5 monthly invoices, cancel/rejoin, 100th/101st concurrency, payment failure, duplicate/out-of-order webhooks, refunded initial payments, and hosted Checkout cancellation. Test that leaked browser access cannot write another business's deals.
10. Verify deployed function endpoint and webhook signing secret; restrict CORS, use separate test and live secrets, set deployment scope to MyDealsPortal **only**, and obtain owner approval before any live checkout enablement.

## Current known blockers
- The backend README says Firebase Functions staging code is not deployed.
- Existing `index.js` does **not** implement promotional schedules, founding slot allocation, or paid entitlement synchronization.
- The preview's `advertise.html` says Checkout comes next. The preview dashboard currently saves and publishes without subscription checks.
- Proposed production Firestore rules block business registration and deal writes without corresponding backend replacements.
- No production webhook endpoint or end-to-end tests have been verified.

## Go/no-go
**NO GO** for live charges or production rules deployment. A future PR must include working code, passing automated tests and an explicitly reviewed migration/deployment plan. This document itself makes no runtime changes.
