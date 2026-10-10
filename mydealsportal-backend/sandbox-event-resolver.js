// Resolve Stripe webhook events without trusting a client-supplied business UID.
// Used after signature verification. Does not activate subscriptions or mutate data.
export async function resolveSandboxSubscription({ stripe, event }) {
  if (!stripe?.subscriptions?.retrieve || !stripe?.checkout?.sessions?.retrieve ||
      !event || event.livemode !== false || !event.data?.object)
    throw new Error("Signed sandbox event and Stripe client required");
  const object = event.data.object;
  let subscriptionId = null;
  if (event.type.startsWith("customer.subscription.")) subscriptionId = object.id;
  else if (event.type.startsWith("checkout.session.")) {
    const session = await stripe.checkout.sessions.retrieve(object.id);
    subscriptionId = typeof session.subscription === "string"
      ? session.subscription : session.subscription?.id;
  } else if (event.type.startsWith("invoice.")) {
    // Modern Stripe invoices may nest the subscription under parent.
    subscriptionId = object.parent?.subscription_details?.subscription ??
      object.subscription ?? null;
  }
  if (typeof subscriptionId !== "string" || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
    return { status:"unresolved", subscriptionId:null };
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const modernTest = subscription.metadata?.project==="mydealsportal" &&
    subscription.metadata?.environment==="test" &&
    ["founding","standard"].includes(subscription.metadata?.plan);
  const legacyTest = subscription.metadata?.sandboxOnly==="true";
  if (subscription.id !== subscriptionId || subscription.livemode===true || !subscription.metadata ||
      !(modernTest || legacyTest) ||
      typeof subscription.metadata.firebaseUid !== "string" ||
      !subscription.metadata.firebaseUid.trim())
    throw new Error("Subscription is not bound to the sandbox business");
  return {
    status:"resolved",
    subscriptionId,
    uid:subscription.metadata.firebaseUid,
    stripeCustomerId:typeof subscription.customer === "string"
      ? subscription.customer : subscription.customer?.id
  };
}
