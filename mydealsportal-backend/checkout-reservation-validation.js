// Read-only validation of an already-committed Firestore founding hold.
// Caller must fetch reservation/business documents from the server after auth.
// A valid hold does not itself create a checkout or charge a customer.
export function validateCheckoutReservation({uid, business, reservation, nowSeconds}) {
  if (typeof uid !== "string" || !uid.trim() ||
      !business || business.ownerUid !== uid ||
      !Number.isSafeInteger(nowSeconds) || nowSeconds < 0)
    throw new Error("Verified business and time required");
  if (business.stripeSubscriptionId || business.checkoutSessionId)
    throw new Error("Existing billing flow must be managed");
  if (!reservation || reservation.uid !== uid ||
      reservation.status !== "reserved" ||
      !Number.isSafeInteger(reservation.slot) ||
      reservation.slot < 1 || reservation.slot > 100 ||
      !Number.isSafeInteger(reservation.expiresAt) ||
      reservation.expiresAt <= nowSeconds)
    throw new Error("Valid unexpired founding reservation required");
  return Object.freeze({
    uid,
    plan: "founding",
    slot: reservation.slot,
    expiresAt: reservation.expiresAt,
    status: "reserved"
  });
}
