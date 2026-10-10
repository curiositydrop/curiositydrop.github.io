// After Stripe signature verification, ensure that the event belongs to the
// intended live Stripe account. Does not change any subscription or publish ads.
export function verifyProductionEvent(event, expectedAccountId) {
  if (typeof expectedAccountId !== "string" || !/^acct_[A-Za-z0-9]+$/.test(expectedAccountId))
    throw new Error("Expected Stripe account ID required");
  if (!event || event.livemode !== true || !event.id?.startsWith("evt_"))
    throw new Error("Expected verified live Stripe event");
  // Connect / organization deliveries may expose context/account separately.
  // Require an explicit account only when present; otherwise the dedicated
  // signing secret and live API key bind the destination to this account.
  if (event.account && event.account !== expectedAccountId)
    throw new Error("Unexpected Stripe account");
  if (event.context && event.context !== expectedAccountId)
    throw new Error("Unexpected Stripe event context");
  return true;
}
