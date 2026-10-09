// Pure checkout readiness checks. Stripe charging stays disabled.
import {validateOwnedBusiness} from "./checkout-contract.js";
export function evaluateLiveCheckoutPreflight({auth,business}) {
 const owner=validateOwnedBusiness({
  authenticatedUid:auth?.uid,
  authenticatedEmail:auth?.email,
  authenticatedEmailVerified:auth?.email_verified,
  business
 });
 return Object.freeze({eligible:true,checkoutEnabled:false,businessUid:owner.uid});
}
