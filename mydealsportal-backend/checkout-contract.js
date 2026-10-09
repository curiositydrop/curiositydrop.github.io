// Pure server-side checkout validation; NO secret keys or network calls.
// This deliberately does not allocate Founding 100 places. That must be done
// transactionally before issuing a checkout session, with expiration/rollback.
import { planFromKey } from "./billing-policy.js";

const allowedOrigins = new Set([
  "https://curiositydrop.github.io",
  "https://www.mydealsportal.com",
  "https://mydealsportal.com"
]);

export function assertCheckoutOrigin(origin) {
  if (typeof origin !== "string" || !allowedOrigins.has(origin))
    throw new Error("Checkout origin is not allowed");
  return origin;
}

export function validateOwnedBusiness({ authenticatedUid, authenticatedEmail, authenticatedEmailVerified, business }) {
  if (typeof authenticatedUid !== "string" || !authenticatedUid.trim())
    throw new Error("Authenticated user required");
  if (!business || business.ownerUid !== authenticatedUid)
    throw new Error("Business must belong to authenticated user");
  if (authenticatedEmailVerified !== true)
    throw new Error("Verified email required");
  if (!authenticatedEmail || typeof authenticatedEmail !== "string")
    throw new Error("Verified account email required");
  if (business.stripeSubscriptionId || ["active", "trialing", "pending", "incomplete", "past_due"].includes(business.subscriptionStatus) || business.checkoutSessionId)
    throw new Error("An existing subscription must be managed, not duplicated");
  return {
    uid: authenticatedUid,
    email: authenticatedEmail,
    businessName: String(business.name || "").trim().slice(0, 200)
  };
}

// A Founding 100 grant is server-issued, never selected based on browser input.
// The grant must be bound to the same UID and in a reserved/confirmed state,
// with durable slot reservation. Callers still need to validate its freshness.
export function requireServerPlan({ planKey, foundingGrant, uid }) {
  const plan = planFromKey(planKey);
  if (plan.key === "founding" &&
    !(foundingGrant &&
      foundingGrant.uid === uid &&
      foundingGrant.plan === "founding" &&
      foundingGrant.status === "reserved" &&
      Number.isSafeInteger(foundingGrant.slot) &&
      foundingGrant.slot >= 1 && foundingGrant.slot <= 100))
    throw new Error("Founding price requires a server-reserved slot");
  return plan;
}

// Construct Stripe Checkout *inputs*, not a session itself. The caller must
// securely resolve or create the Stripe customer after auth/ownership checks.
// No user-provided price/customer IDs are ever accepted.
export function buildCheckoutParams({
  authenticatedUid, authenticatedEmail, authenticatedEmailVerified, business, stripeCustomerId,
  planKey, foundingGrant, origin
}) {
  const owned = validateOwnedBusiness({authenticatedUid,authenticatedEmail,authenticatedEmailVerified,business});
  assertCheckoutOrigin(origin);
  const plan = requireServerPlan({planKey, foundingGrant,uid:owned.uid});
  if (typeof stripeCustomerId !== "string" || !stripeCustomerId.startsWith("cus_"))
    throw new Error("Verified Stripe customer ID required");
  return {
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{price: plan.priceId, quantity: 1}],
    client_reference_id: owned.uid,
    metadata: {firebaseUid:owned.uid,plan:plan.key,project:"mydealsportal"},
    subscription_data: {metadata:{firebaseUid:owned.uid,plan:plan.key,project:"mydealsportal"}},
    success_url: origin + "/mydealsportal-preview/dashboard.html?checkout=success",
    cancel_url: origin + "/mydealsportal-preview/dashboard.html?checkout=cancel"
    // No trial_period_days: first invoice MUST charge normally.
    // Promo schedule is attached ONLY after initial invoice.paid webhook.
  };
}
