// Pure Stripe event routing for MyDealsPortal. No DB access or entitlements.
// Raw-body signature verification MUST happen before calling this function.
// Callers MUST retrieve the authoritative Stripe subscription/invoice state
// and reconcile it idempotently, rather than trusting event order or payload.
export const RECONCILE_EVENTS = Object.freeze(new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "refund.created",
  "refund.updated"
]));

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Event IDs are only deduplication keys, NOT proof that funds were collected.
// Reject cross-account and test/live mode mistakes without changing records.
export function classifyStripeEvent(event, { expectedLiveMode } = {}) {
  if (typeof expectedLiveMode !== "boolean")
    throw new TypeError("Expected Stripe mode is required");
  if (!event || !nonempty(event.id) || !nonempty(event.type) ||
      typeof event.livemode !== "boolean" || !event.data?.object ||
      !nonempty(event.data.object.id))
    throw new Error("Malformed Stripe event");
  if (event.livemode !== expectedLiveMode)
    throw new Error("Stripe mode mismatch");

  const object = event.data.object;
  const relevant = RECONCILE_EVENTS.has(event.type);
  const identifier = event.type.startsWith("customer.subscription.")
    ? object.id
    : event.type.startsWith("invoice.")
      ? typeof (object.parent?.subscription_details?.subscription ?? object.subscription) === "string" ? (object.parent?.subscription_details?.subscription ?? object.subscription) : null
      : event.type.startsWith("checkout.session.")
        ? typeof object.subscription === "string" ? object.subscription : null
        : null;

  return Object.freeze({
    eventId: event.id,
    type: event.type,
    objectId: object.id,
    stripeSubscriptionId: identifier,
    action: relevant ? "reconcile" : "ignore",
    // Never set paid/publish status based solely on an event payload.
    grantsEntitlement: false
  });
}
