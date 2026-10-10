// Dedicated production billing configuration. This module does not start
// checkout, expose secrets, grant access or deploy any Cloud Function.
// Sandbox secret names must never be reused for live billing.
import { PLANS } from "./billing-policy.js";

export const LIVE_SECRET_NAMES = Object.freeze({
  stripeApiKey: "MYDEALSPORTAL_STRIPE_LIVE_KEY",
  webhookSigningSecret: "MYDEALSPORTAL_STRIPE_LIVE_WEBHOOK_SECRET"
});

export function assertLiveBillingConfiguration({ apiKey, webhookSigningSecret, priceIds }) {
  if (typeof apiKey !== "string" || !apiKey.startsWith("sk_live_"))
    throw new Error("Dedicated live Stripe API key required");
  if (typeof webhookSigningSecret !== "string" || !webhookSigningSecret.startsWith("whsec_"))
    throw new Error("Live webhook signing secret required");
  if (!priceIds || priceIds.founding !== PLANS.founding.priceId ||
      priceIds.standard !== PLANS.standard.priceId)
    throw new Error("Live Stripe price IDs do not match verified catalog");
  if (priceIds.founding === priceIds.standard)
    throw new Error("Founding and standard must use different prices");
  // Return only public IDs and mode; never return or log secrets.
  return Object.freeze({
    livemode: true,
    prices: Object.freeze({...priceIds})
  });
}
