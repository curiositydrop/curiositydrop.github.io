// Server-side only. Caller must verify Stripe signature, then retrieve
// authoritative subscription and invoices from Stripe before calling.
export async function recordBillingReconciliation({ db, FieldValue, uid, eventId, state }) {
  if (!db?.runTransaction || !FieldValue?.serverTimestamp ||
      typeof uid !== "string" || !uid ||
      typeof eventId !== "string" || !/^evt_[A-Za-z0-9]+$/.test(eventId) ||
      !state || !/^sub_[A-Za-z0-9]+$/.test(state.stripeSubscriptionId || "") ||
      !/^cus_[A-Za-z0-9]+$/.test(state.stripeCustomerId || "") ||
      typeof state.publishingEnabled !== "boolean" ||
      typeof state.initialInvoicePaid !== "boolean")
    throw new Error("Missing verified billing context");

  const businessRef = db.collection("businesses").doc(uid);
  const eventRef = db.collection("stripeBillingEvents").doc(eventId);
  return db.runTransaction(async tx => {
    const [business, priorEvent] = await Promise.all([
      tx.get(businessRef), tx.get(eventRef)
    ]);
    if (priorEvent.exists) return "duplicate";
    if (!business.exists || business.data().ownerUid !== uid)
      throw new Error("Business ownership mismatch");
    const current = business.data();
    if ((current.stripeCustomerId && current.stripeCustomerId !== state.stripeCustomerId) ||
        (current.stripeSubscriptionId && current.stripeSubscriptionId !== state.stripeSubscriptionId))
      throw new Error("Subscription mismatch");
    // A suspension may have been set after Stripe verification started.
    // Use the business state read inside THIS transaction, not stale state.
    const publishingEnabled = state.publishingEnabled &&
      current.billingSuspended !== true && current.suspended !== true;
    tx.update(businessRef, {
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      subscriptionStatus: state.stripeStatus,
      initialInvoicePaid: state.initialInvoicePaid,
      publishingEnabled,
      billingUpdatedAt: FieldValue.serverTimestamp()
    });
    tx.create(eventRef, {
      uid, subscriptionId: state.stripeSubscriptionId,
      processedAt: FieldValue.serverTimestamp()
    });
    return "updated";
  });
}
