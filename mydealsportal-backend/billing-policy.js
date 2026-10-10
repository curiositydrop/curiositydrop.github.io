// MyDealsPortal billing policy — deterministic helpers only.
// This module has NO Stripe credentials, network calls, or side effects.
// Integration must reserve founding slots transactionally and confirm initial payment.
export const FOUNDING_LIMIT = 100;
export const PLANS = Object.freeze({
  founding: Object.freeze({
    key: "founding",
    priceId: "price_1UOVlFIHJWXNHkKxKgfNFoRy",
    monthlyCents: 4499,
    freeBillingMonths: Object.freeze([2, 3]),
  }),
  standard: Object.freeze({
    key: "standard",
    priceId: "price_1UOVlJIHJWXNHkKxDCIpogsu",
    monthlyCents: 4999,
    freeBillingMonths: Object.freeze([2]),
  }),
});

export function choosePlan(confirmedFoundingCount) {
  if (!Number.isSafeInteger(confirmedFoundingCount) || confirmedFoundingCount < 0)
    throw new RangeError("Confirmed founding count must be a nonnegative integer");
  return confirmedFoundingCount < FOUNDING_LIMIT ? PLANS.founding : PLANS.standard;
}

export function planFromKey(key) {
  if (!Object.hasOwn(PLANS, key)) throw new Error("Unknown subscription plan");
  return PLANS[key];
}

// Billing month is 1-based and refers to a complete subscription billing cycle,
// NOT the calendar month. Month 1 is always paid. No trial before first payment.
export function amountDueForBillingMonth(planKey, billingMonth) {
  const plan = planFromKey(planKey);
  if (!Number.isSafeInteger(billingMonth) || billingMonth < 1)
    throw new RangeError("Billing month must be a positive integer");
  return plan.freeBillingMonths.includes(billingMonth) ? 0 : plan.monthlyCents;
}

export function priceForPlan(planKey) {
  return planFromKey(planKey).priceId;
}

// Only durable, verified Stripe payment records may trigger entitlement.
// Checkout redirect and signup alone are never payment proof.
// During intentionally free billing cycles, previously paid subscriptions
// remain eligible unless Stripe reports canceled/unpaid or another restriction.
export function mayPublish({ initialInvoicePaid, stripeStatus, businessSuspended = false }) {
  return initialInvoicePaid === true &&
    stripeStatus === "active" &&
    businessSuspended !== true;
}
