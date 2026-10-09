// Coordinates a Stripe session and its Firestore registration.
// This helper is NOT exposed to the website or deployed.
// If Firestore rejects registration, expire the unshared Checkout Session.
// Any failed expiration is surfaced for operational reconciliation.
import {createVerifiedCheckoutSession} from "./live-checkout-session.js";
import {recordCheckoutSession} from "./checkout-session-firestore.js";

export async function prepareAndRecordCheckout({
  stripe,db,uid,email,emailVerified,business,customerId,planKey,
  foundingGrant,origin,requestId,nowSeconds
}) {
  if(!stripe?.checkout?.sessions?.expire)
    throw new Error("Stripe checkout expiration API required");
  const created=await createVerifiedCheckoutSession({
    stripe,uid,email,emailVerified,business,customerId,planKey,
    foundingGrant,origin,requestId
  });
  try {
    await recordCheckoutSession({
      db,uid,sessionId:created.sessionId,planKey,nowSeconds
    });
  } catch(err) {
    try {
      await stripe.checkout.sessions.expire(created.sessionId);
    } catch(expirationError) {
      // Never hand out a session URL if we could not register it.
      const failure=new Error("Checkout registration and session expiration both failed; reconciliation required");
      failure.cause=new AggregateError([err,expirationError]);
      throw failure;
    }
    throw new Error("Checkout session registration failed; session expired",{cause:err});
  }
  return created;
}
