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

// Read-only pricing indication, never an actual slot reservation or guarantee.
export function prospectivePricing({confirmed,reserved}) {
 if(!Number.isSafeInteger(confirmed)||!Number.isSafeInteger(reserved)||
    confirmed<0||reserved<0||confirmed+reserved>100)
   throw new Error("Invalid founding inventory");
 return Object.freeze({
   possiblePlan:confirmed+reserved<100?"founding":"standard",
   foundingPlacesRemaining:100-confirmed-reserved,
   reservationConfirmed:false,
   checkoutEnabled:false
 });
}
