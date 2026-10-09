// Convert authoritative Stripe API objects into a business entitlement decision.
// Call ONLY after retrieving the subscription from Stripe's API on the server.
// Event payloads, query strings and browser state are never authoritative.
import { deriveEntitlement } from "./entitlement-policy.js";

export function reconcileVerifiedSubscription({
  subscription, firstInvoice, latestInvoice, businessSuspended = false, nowSeconds
}) {
  if (!subscription || typeof subscription.id !== "string" ||
      !subscription.id.startsWith("sub_") ||
      typeof subscription.status !== "string" ||
      !firstInvoice || typeof firstInvoice.id !== "string" ||
      !firstInvoice.id.startsWith("in_") ||
      typeof firstInvoice.subscription !== "string" ||
      firstInvoice.subscription !== subscription.id ||
      !latestInvoice || typeof latestInvoice.id !== "string" ||
      !latestInvoice.id.startsWith("in_") ||
      latestInvoice.subscription !== subscription.id)
    throw new Error("Incomplete or mismatched verified Stripe records");

  // Initial payment is confirmed only when Stripe reports a paid invoice
  // with a positive amount collected. A free trial or $0 invoice is not enough.
  const initialInvoicePaid = firstInvoice.status === "paid" &&
    Number.isSafeInteger(firstInvoice.amount_paid) &&
    firstInvoice.amount_paid > 0;

  const state = deriveEntitlement({
    initialInvoicePaid,
    subscriptionStatus: subscription.status,
    suspended: businessSuspended,
    latestInvoiceStatus: latestInvoice.status,
    periodEnd: subscription.current_period_end ?? null,
    nowSeconds
  });
  return Object.freeze({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
    stripeStatus: subscription.status,
    initialInvoicePaid,
    ...state
  });
}
