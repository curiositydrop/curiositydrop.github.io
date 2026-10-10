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

// Compose a reviewable schedule update only after Stripe has returned a
// schedule created from the *existing paid* subscription. NO API mutation.
export function proposeScheduleUpdate({preview,schedule,coupon}) {
 if(!preview || preview.readyToApply!==false ||
    !/^sub_[A-Za-z0-9]+$/.test(preview.subscriptionId||"") ||
    !/^price_[A-Za-z0-9]+$/.test(preview.priceId||"") ||
    !(typeof coupon?.id==="string" && /^[A-Za-z0-9_-]{3,100}$/.test(coupon.id)) ||
    coupon.percent_off!==100 || coupon.valid!==true)
   throw new Error("Verified subscription and 100% coupon required");
 if(!schedule || schedule.subscription!==preview.subscriptionId ||
    !Array.isArray(schedule.phases) || schedule.phases.length!==1)
   throw new Error("Expected schedule copied from paid subscription");
 const paid=schedule.phases[0];
 if(!Number.isSafeInteger(paid.start_date) ||
    paid.end_date!==preview.paidPeriodEnds || paid.start_date>=paid.end_date ||
    !Array.isArray(paid.items) || paid.items.length!==1)
   throw new Error("Paid phase boundaries must match verified subscription");
 const item=paid.items[0];
 const price=typeof item.price==="string"?item.price:item.price?.id;
 if(price!==preview.priceId || item.quantity!==1)
   throw new Error("Schedule price must match subscription");
 return Object.freeze({
  end_behavior:"release",
  phases:[
   {start_date:paid.start_date,end_date:paid.end_date,
    items:[{price,quantity:1}],proration_behavior:"none"},
   {items:[{price,quantity:1}],
    duration:{interval:"month",interval_count:preview.freeCycles},
    discounts:[{coupon:coupon.id}],proration_behavior:"none"},
   {items:[{price,quantity:1}],proration_behavior:"none"}
  ]
 });
}
