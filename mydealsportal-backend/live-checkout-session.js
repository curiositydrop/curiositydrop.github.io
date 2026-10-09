// Server-side live checkout session factory. NOT exposed as an HTTP endpoint.
// A caller must verify Firebase auth, business ownership and an atomically held
// founding reservation before invoking this. Deployment remains disabled.
import {buildCheckoutParams} from "./checkout-contract.js";
export async function createVerifiedCheckoutSession({
  stripe,uid,email,emailVerified,business,customerId,planKey,foundingGrant,origin,
  requestId
}) {
  if (!stripe?.checkout?.sessions?.create)
    throw new Error("Stripe Checkout client required");
  if (typeof requestId!=="string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))
    throw new Error("Server-issued checkout request ID required");
  const params=buildCheckoutParams({
    authenticatedUid:uid,authenticatedEmail:email,
    authenticatedEmailVerified:emailVerified,business,
    stripeCustomerId:customerId,planKey,foundingGrant,origin
  });
  // Bound to a server-issued request ID; never trust an arbitrary browser key.
  const session=await stripe.checkout.sessions.create(params,{
    idempotencyKey:"mdp-live-"+uid+"-"+requestId
  });
  if(!session || typeof session.id!=="string" || !session.id.startsWith("cs_") ||
    typeof session.url!=="string" || !session.url.startsWith("https://checkout.stripe.com/"))
    throw new Error("Stripe did not return a valid Checkout session");
  return Object.freeze({sessionId:session.id,url:session.url});
}
