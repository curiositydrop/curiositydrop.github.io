// Attach the promised promo only after verified paid-first billing.
// Test Stripe keys and Stripe TEST subscriptions only.
import {applyTestPromotionSchedule} from "./test-promotion-executor.js";
export async function ensureSandboxPromotion({stripe,apiKey,subscriptionId,planKey,nowSeconds}){
 if(!apiKey?.startsWith("sk_test_") || !["founding","standard"].includes(planKey))
  throw Error("Test-only promotion context required");
 const sub=await stripe.subscriptions.retrieve(subscriptionId);
 if(sub.livemode!==false || sub.metadata?.project!=="mydealsportal" ||
    sub.metadata?.environment!=="test" || sub.metadata?.plan!==planKey ||
    sub.status!=="active")throw Error("Invalid sandbox subscription");
 if(sub.schedule){
   const id=typeof sub.schedule==="string"?sub.schedule:sub.schedule.id;
   const schedule=await stripe.subscriptionSchedules.retrieve(id);
   if(schedule.livemode!==false || schedule.subscription!==sub.id ||
      schedule.phases?.length!==3 || schedule.end_behavior!=="release")
     throw Error("Existing promotion schedule requires review");
   return {scheduleId:id,alreadyConfigured:true};
 }
 const invoices=await stripe.invoices.list({subscription:sub.id,limit:100});
 if(invoices.has_more || !Array.isArray(invoices.data))throw Error("Incomplete invoices");
 const initial=invoices.data.find(i=>i.billing_reason==="subscription_create");
 const expected=planKey==="founding"?4499:4999;
 if(!initial || initial.status!=="paid" || initial.amount_paid!==expected)
  throw Error("Paid first subscription invoice required");
 const result=await applyTestPromotionSchedule({
   stripe,apiKey,subscription:sub,planKey,initialInvoicePaid:true,nowSeconds,
   coupon:{id:"8YGAywdJ"}
 });
 return {scheduleId:result.scheduleId,alreadyConfigured:false};
}
