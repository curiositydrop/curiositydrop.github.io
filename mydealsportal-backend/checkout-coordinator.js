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
  if(!stripe?.customers?.create)throw new Error("Stripe customer API required");
  if(!emailVerified || business?.ownerUid!==uid)throw new Error("Verified owner required");
  const verifiedCustomerId = customerId || (await stripe.customers.create({
    email,name:String(business.name||"").slice(0,200),
    metadata:{firebaseUid:uid,project:"mydealsportal"}
  },{idempotencyKey:"mdp-live-customer-"+uid})).id;
  if(typeof verifiedCustomerId!=="string" || !verifiedCustomerId.startsWith("cus_"))
    throw new Error("Stripe customer creation failed");
  const created=await createVerifiedCheckoutSession({
    stripe,uid,email,emailVerified,business,customerId:verifiedCustomerId,planKey,
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
