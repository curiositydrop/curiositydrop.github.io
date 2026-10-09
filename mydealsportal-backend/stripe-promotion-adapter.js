// Side-effect-free proposal for an eventual Stripe subscription schedule.
// Creating a schedule is itself a Stripe mutation; don't do so here.
import {preparePromotionSchedule} from "./promotion-preflight.js";
export function previewPromotionSchedule({subscription,planKey,initialInvoicePaid,nowSeconds}) {
 const config=preparePromotionSchedule({subscription,planKey,initialInvoicePaid,nowSeconds});
 return Object.freeze({
  subscriptionId:subscription.id,
  paidPeriodEnds:config.startAfterPaidPeriod,
  freeCycles:config.promotionCycles,
  priceId:config.phases[0].items[0].price,
  requiredCoupon:"100-percent-off coupon to be validated",
  endBehavior:"release",
  readyToApply:false
 });
}
