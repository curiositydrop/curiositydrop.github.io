// Integration adapter for Stripe schedule API. This is NOT invoked by a live
// Firebase function yet. Caller must verify subscription and first paid invoice.
// Stripe schedule creation from a subscription must retain its current paid phase;
// never create a future-only schedule and accidentally reset billing anchors.
import {preparePromotionSchedule} from "./promotion-preflight.js";

export async function attachPromotionSchedule({stripe,subscription,planKey,initialInvoicePaid,nowSeconds}) {
 if(!stripe?.subscriptionSchedules?.create || !stripe?.subscriptionSchedules?.update)
   throw new Error("Stripe schedule API required");
 const config=preparePromotionSchedule({subscription,planKey,initialInvoicePaid,nowSeconds});
 const idempotencyKey="mdp-promo-"+subscription.id;
 // Created from an existing subscription: Stripe captures its current phase.
 // If the process crashes after creation, re-read subscription.schedule rather
 // than retrying an unsafe change. No actual free phases are applied here.
 const schedule=await stripe.subscriptionSchedules.create(
   {from_subscription:subscription.id},
   {idempotencyKey}
 );
 if(!schedule?.id || !Array.isArray(schedule.phases) || schedule.phases.length<1 ||
    !Number.isSafeInteger(schedule.phases[0].start_date) ||
    !Number.isSafeInteger(schedule.phases[0].end_date) ||
    schedule.phases[0].end_date!==config.startAfterPaidPeriod)
   throw new Error("Schedule phase dates require review before update");
 // Preserve the paid current phase. Phase 2 discounts are applied after it ends.
 const current=schedule.phases[0];
 const phases=[
   {start_date:current.start_date,end_date:current.end_date,
    items:current.items.map(x=>({price:typeof x.price==="string"?x.price:x.price.id,quantity:x.quantity}))},
   {iterations:config.promotionCycles,
    items:config.phases[0].items,
    discounts:[{coupon:"__REQUIRES_VALIDATED_100_PERCENT_COUPON__"}]},
   {items:config.phases[1].items}
 ];
 // Intentionally no update until a dedicated, validated coupon ID and Stripe
 // test-clock billing tests exist. This adapter currently returns a draft.
 return {scheduleId:schedule.id,phases,readyToApply:false,endBehavior:config.endBehavior};
}
