# MyDealsPortal — Stripe test-mode checkout setup

## Current status
GitHub billing unit/integration tests use mocks. They do **not** charge a card or communicate with Stripe. The connected Stripe account available in this chat is live-mode only. Do not use it for these tests.

## Complete these steps in Stripe TEST mode
1. Switch the MyDealsPortal Stripe Dashboard into **test mode / sandbox**.
2. Create or identify two **active, recurring monthly** test prices:
   - Founding 100: USD 44.99 (4499 cents)
   - Standard: USD 49.99 (4999 cents)
3. Create a **test-mode-only** 100% off coupon. Do not apply it to the first paid month; its use is scheduled for following billing periods.
4. Store the **test secret key securely** in an environment or approved secret manager, not in GitHub source, PR comments, chat, or browser JavaScript.
5. Set these environment variables in a protected local/test environment:
   - `MYDEALSPORTAL_STRIPE_TEST_KEY`
   - `MYDEALSPORTAL_STRIPE_TEST_FOUNDING_PRICE`
   - `MYDEALSPORTAL_STRIPE_TEST_STANDARD_PRICE`
6. From `mydealsportal-backend`, run `npm run stripe:test:readiness`. This command makes **read-only** calls to Stripe.
7. Only after readiness succeeds, run a genuine **test-mode** checkout with a verified test business and check:
   - Initial $44.99/$49.99 invoice is paid
   - Subsequent 2/1 monthly billing periods are free
   - Thereafter normal monthly billing resumes
   - Repeated/out-of-order webhooks cannot grant duplicate or wrong entitlements
   - Cancellation, refund, declined payment and checkout abandonment revoke/deny access appropriately.

## Release blockers
- Full production checkout route remains hard-blocked.
- Live entitlement writes remain disabled.
- Test subscription scheduling still needs a real test-mode API check, including correct `duration`, coupon discount fields and phase transition behavior.
- Founding slot cleanup/payment reconciliation needs validation under concurrency.
- Confirm the public site's Firestore security rules really enforce paid publishing access; client-only flags are insufficient.
- Complete actual Stripe test checkout + subscription renewals, then reviewed release and deployment.

**Never paste test or live secret keys into chat or commit them to GitHub.**
