// Stripe subscription-schedule phase policy. No API calls or side effects.
// Invoke only after the first actual invoice is paid, with a fresh Stripe
// subscription and a confirmed plan. Schedule creation must be idempotent.
import {planFromKey} from "./billing-policy.js";

export function buildPromotionPhases({planKey,priceId,initialInvoicePaid,firstPeriodEnd,verifiedTestPriceId}) {
 const plan=planFromKey(planKey);
 if(initialInvoicePaid!==true || priceId!==(verifiedTestPriceId ?? plan.priceId) ||
    !Number.isSafeInteger(firstPeriodEnd) || firstPeriodEnd<=0)
   throw new Error("Verified paid initial billing period and price required");
 if(verifiedTestPriceId!==undefined && (!/^price_[A-Za-z0-9]+$/.test(verifiedTestPriceId) || verifiedTestPriceId!==priceId))
   throw new Error("Test price must match independently verified Stripe price");
 const freeMonths=plan.freeBillingMonths.length;
 if(freeMonths<1) throw new Error("Plan has no free promotion");
 // The existing first paid invoice covers the current billing period.
 // Schedule is attached only for subsequent periods. Stripe API caller must
 // verify the current phase dates, customer, status and subscription ID.
 return Object.freeze({
  startAfterPaidPeriod:firstPeriodEnd,
  promotionCycles:freeMonths,
  phases:[
   {duration:{interval:"month",interval_count:freeMonths},items:[{price:priceId,quantity:1}],discountPercent:100},
   {items:[{price:plan.priceId,quantity:1}],discountPercent:0}
  ],
  endBehavior:"release"
 });
}
