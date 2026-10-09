// Controlled test-mode-only Stripe schedule application.
// Never accepts live subscriptions, production API keys, or missing paid invoice.
import {previewPromotionSchedule,proposeScheduleUpdate} from "./stripe-promotion-adapter.js";
export async function applyTestPromotionSchedule({
 stripe,apiKey,subscription,planKey,initialInvoicePaid,nowSeconds,coupon
}){
 if(typeof apiKey!=="string" || !apiKey.startsWith("sk_test_") ||
    !stripe?.subscriptionSchedules?.create ||
    !stripe?.subscriptionSchedules?.update ||
    !stripe?.subscriptions?.retrieve || !stripe?.coupons?.retrieve)
   throw new Error("Stripe TEST-only schedule client required");
 if(subscription?.livemode!==false || subscription?.schedule)
   throw new Error("Only unscheduled test subscriptions are permitted");
 const preview=previewPromotionSchedule({subscription,planKey,initialInvoicePaid,nowSeconds});
 const serverCoupon=await stripe.coupons.retrieve(coupon?.id);
 if(serverCoupon.id!==coupon?.id || serverCoupon.valid!==true || serverCoupon.percent_off!==100)
   throw new Error("Verified 100% Stripe TEST coupon required");
 // Re-read from Stripe immediately before the mutation; fail on changed state.
 const latest=await stripe.subscriptions.retrieve(subscription.id);
 if(latest.livemode!==false || latest.schedule ||
    latest.status!==subscription.status ||
    latest.metadata?.plan!==planKey ||
    latest.items?.data?.[0]?.price?.id!==preview.priceId ||
    (latest.items?.data?.[0]?.current_period_end ?? latest.current_period_end)!==preview.paidPeriodEnds)
   throw new Error("Subscription changed; retry after verification");
 const created=await stripe.subscriptionSchedules.create(
   {from_subscription:subscription.id},
   {idempotencyKey:"mdp-test-schedule-"+subscription.id}
 );
 if(created.livemode!==false)
   throw new Error("Unexpected non-test schedule");
 const request=proposeScheduleUpdate({preview,schedule:created,coupon:serverCoupon});
 const result=await stripe.subscriptionSchedules.update(created.id,request,{
   idempotencyKey:"mdp-test-promotion-"+subscription.id+"-"+coupon.id
 });
 if(result.id!==created.id || result.livemode!==false)
   throw new Error("Unexpected updated schedule result");
 return {scheduleId:result.id,testMode:true};
}
