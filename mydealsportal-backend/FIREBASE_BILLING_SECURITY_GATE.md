# Firebase billing security release gate

Status: **BLOCKED FOR PUBLIC LAUNCH**. Review and deploy security rules before enabling payment-related publishing.

Observed in `mydealsportal-preview/firestore.rules`:
- Owners may currently update the entire business record.
- Owners can create or update deal `active` flags.
- Public deal queries use `active == true` alone and do not require a server-managed approval field.
- New business registrations currently assign `status: "active"` and `subscriptionStatus: "sandbox"`.

Required implementation:
1. Server-only fields (including `stripeCustomerId`, `stripeSubscriptionId`, `publishingEnabled`, `billingSuspended`, `sandboxPublishingEnabled`, `subscriptionStatus`, `foundingSlot`) must never be client-writable.
2. Registrations must start unpaid/draft; prevent client-owned business status escalation.
3. Public deal reads must use a server-managed publishing approval field, and the client must not be able to assign it.
4. Server must approve/revoke existing deal visibility on payment, refund, expiry and suspension; public queries must filter on both `active` and approval.
5. Run Firebase Emulator Suite rules tests covering forged payments, unauthorized deal approval, admin suspension and legitimate owner editing before deploying the rules.
6. Do not enable the currently disabled live checkout or webhook entitlement writes before 1-5 pass.

Note: Mocked Stripe-to-Firebase reconciliation tests do **not** test Firestore rules or production deployment. The manually paid test subscriptions are standalone and not linked to a registered Firebase business.
