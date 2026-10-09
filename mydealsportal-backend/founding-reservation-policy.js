// Pure Founding 100 reservation decisions. Firestore transaction implementation
// must serialize these decisions against a shared counter document.
export const FOUNDING_CAP = 100;
export function reserveDecision({confirmed, reserved, existingReservation = false}) {
  for (const value of [confirmed,reserved]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > FOUNDING_CAP)
      throw new RangeError("Invalid founding counts");
  }
  if (confirmed + reserved > FOUNDING_CAP) throw new RangeError("Overallocated founding inventory");
  if (existingReservation) return "reuse";
  return confirmed + reserved < FOUNDING_CAP ? "reserve" : "standard";
}
export function confirmationDecision({status, expiresAt, nowSeconds}) {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0 ||
      !Number.isSafeInteger(expiresAt) || expiresAt < 0)
    throw new RangeError("Invalid reservation time");
  if (status === "confirmed") return "already-confirmed";
  if (status !== "reserved") return "reject";
  return nowSeconds < expiresAt ? "confirm" : "expired";
}
