// Pure entitlement state reconciliation. Only server-verified Stripe records
// may reach this function; never feed it browser data or webhook payload alone.
const ACTIVE = new Set(["active"]);
export function deriveEntitlement({ initialInvoicePaid, subscriptionStatus, suspended = false, latestInvoiceStatus, periodEnd, nowSeconds }) {
  if (typeof initialInvoicePaid !== "boolean" || typeof subscriptionStatus !== "string" ||
      typeof suspended !== "boolean" || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0)
    throw new TypeError("Invalid verified entitlement input");
  const end = periodEnd;
  if (!Number.isSafeInteger(end) || end <= 0)
    throw new TypeError("Invalid period end");
  const eligible = initialInvoicePaid && ACTIVE.has(subscriptionStatus) &&
    !suspended && latestInvoiceStatus === "paid" && end > nowSeconds;
  return Object.freeze({
    publishingEnabled: eligible,
    reason: !initialInvoicePaid ? "awaiting_initial_payment" :
      suspended ? "suspended" :
      !ACTIVE.has(subscriptionStatus) ? "subscription_inactive" :
      latestInvoiceStatus !== "paid" ? "invoice_not_paid" :
      end <= nowSeconds ? "period_expired" : "active"
  });
}
