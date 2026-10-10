// Controlled test-mode-only Stripe schedule application.
// Never accepts live subscriptions, production API keys, or missing paid invoice.
import {previewPromotionSchedule,proposeScheduleUpdate} from "./stripe-promotion-adapter.js";
export async function applyTestPromotionSchedule({
 stripe,apiKey,subscription,planKey,initialInvoicePaid,nowSeconds,coupon
}){
 if(typeof apiKey!=="string" || !apiKey.startsWith("sk_test_") ||
    !stripe?.subscriptionSchedules?.create ||
    !stripe?.subscriptionSchedules?.update || !stripe?.subscriptionSchedules?.retrieve ||
    !stripe?.subscriptions?.retrieve || !stripe?.coupons?.retrieve || !stripe?.prices?.retrieve)
   throw new Error("Stripe TEST-only schedule client required");
 if(subscription?.livemode!==false)
   throw new Error("Only test subscriptions are permitted");
 // For recovery, preflight the paid subscription fields with the schedule
 // removed from the *local copy*; only resume the schedule ID after a fresh
 // authoritative Stripe read and strict phase verification below.
 const actualPriceId=subscription.items?.data?.[0]?.price?.id;
 const verifiedPrice=await stripe.prices.retrieve(actualPriceId);
 if(verifiedPrice?.id!==actualPriceId || verifiedPrice.livemode!==false ||
    verifiedPrice.active!==true || verifiedPrice.currency!=="usd" ||
    verifiedPrice.unit_amount!==(planKey==="founding"?4499:4999) ||
    verifiedPrice.recurring?.interval!=="month" || verifiedPrice.recurring?.interval_count!==1)
   throw new Error("Verified matching Stripe test price required");
 const preview=previewPromotionSchedule({subscription:{...subscription,schedule:null},planKey,initialInvoicePaid,nowSeconds,verifiedTestPriceId:verifiedPrice.id});
 const serverCoupon=await stripe.coupons.retrieve(coupon?.id);
 if(serverCoupon.id!==coupon?.id || serverCoupon.valid!==true || serverCoupon.percent_off!==100)
   throw new Error("Verified 100% Stripe TEST coupon required");
 // Re-read from Stripe immediately before the mutation; fail on changed state.
 const latest=await stripe.subscriptions.retrieve(subscription.id);
 if(latest.livemode!==false ||
    (!subscription.schedule && latest.schedule) ||
    (subscription.schedule && latest.schedule!==subscription.schedule) ||
    latest.status!==subscription.status ||
    latest.metadata?.plan!==planKey ||
    latest.items?.data?.[0]?.price?.id!==preview.priceId ||
    (latest.items?.data?.[0]?.current_period_end ?? latest.current_period_end)!==preview.paidPeriodEnds)
   throw new Error("Subscription changed; retry after verification");
 const existingId=typeof latest.schedule==="string"?latest.schedule:latest.schedule?.id;
 const created=existingId
   ? await stripe.subscriptionSchedules.retrieve(existingId)
   : await stripe.subscriptionSchedules.create(
      {from_subscription:subscription.id},
      {idempotencyKey:"mdp-test-schedule-"+subscription.id}
     );
 if(created.livemode!==false || created.subscription!==subscription.id)
   throw new Error("Unexpected non-test schedule");
 // An already configured schedule is never overwritten by a retry.
 if(created.phases?.length!==1)
   throw new Error("Existing schedule must be reviewed; will not overwrite promotion");
 const request=proposeScheduleUpdate({preview,schedule:created,coupon:serverCoupon});
 let result;
 try {
   result=await stripe.subscriptionSchedules.update(created.id,request,{
   idempotencyKey:"mdp-test-promotion-"+subscription.id+"-"+coupon.id
   });
 } catch(error) {
   // The schedule already exists. Never silently create another one.
   throw new Error("Test schedule created but update failed; inspect schedule "+created.id+" before retrying",{cause:error});
 }
 if(result.id!==created.id || result.livemode!==false)
   throw new Error("Unexpected updated schedule result");
 return {scheduleId:result.id,testMode:true};
}
