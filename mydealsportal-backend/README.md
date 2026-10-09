# MyDealsPortal — Stripe/Firebase backend (sandbox staging)

This directory is preparation for Firebase Cloud Functions on project `mydealsportal`. It is **not deployed**, and does not modify the currently working preview.

## Before deployment

1. The manual GitHub Actions workflow uses **keyless Workload Identity Federation** for project `mydealsportal`. Default mode is **verify**; never select **deploy** until the sandbox functions, secrets, and deployment IAM permissions have been reviewed.
2. Configure Firebase Functions secret `STRIPE_SECRET_KEY` from **MyDealsPortal sandbox** and `STRIPE_WEBHOOK_SECRET` for the **deployed** Stripe webhook endpoint; never commit them.
3. Configure runtime `SITE_ORIGIN` as the exact hosted test site origin. Configure appropriate endpoint CORS and permitted return URLs, not a wildcard.
4. The server must verify Firebase ID tokens on session creation; client-provided prices, customer IDs and account roles must not be trusted.
5. Founding 100 entitlement must be reserved and awarded atomically when **paid**, with concurrency and abandoned checkout recovery. Do not infer it from account creation. Use server-owned business fields.
6. Promotion schedule: first invoice charged; founding months 2–3 free, standard month 2 free. Verify Stripe test clocks across invoices, cancellations and reactivations before enabling automatic promotions.
7. Add webhook signature validation, replay tolerance, durable event-id deduplication, and idempotent business-status updates.
8. Deploy hardened Firestore rules only **after** the client stops writing server-owned subscription/status fields and the backend's checkout flow is ready.
9. Gate live deal publishing and public visibility to paid active subscriptions after end-to-end tests. Current sandbox preview intentionally isn't payment gated.
10. Do not turn on Stripe live mode or attach production domain until all these tests pass.

## Current project credentials

MyDealsPortal sandbox product: `prod_VOsBLIqFeHO8fR`

Founding price: `price_1UO4QpIqvlhcw8H0bCoRbJmF`

Standard price: `price_1UO4QrIqvlhcw8H0sTFoXSJd`

The initial coupons exist in Stripe but are not yet wired; do not mistake them for a finished promotion scheduler.

## Deployment authentication

GitHub workflow `.github/workflows/mydealsportal-functions.yml` uses the dedicated deployer account `mydealsportal-github-deploy@mydealsportal.iam.gserviceaccount.com` and the GitHub OIDC pool/provider in project `423834035461`. Do **not** create or commit a service account JSON key. The last safe verification run succeeded before Actions version upgrades; verify once more after the upgrades. Firebase deploy may require additional scoped IAM roles beyond Cloud Functions Developer and Service Account User (such as Artifact Registry, Cloud Build, and Secret Manager access); investigate specific error output, and avoid granting Editor/Owner indiscriminately.

Never deploy as part of a normal Pages build, or use this root Firebase config against the BANDtroductions project.
