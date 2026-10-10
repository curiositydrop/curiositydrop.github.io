// Explicit, one-subscription Stripe TEST-only promotion runner.
// NEVER commit keys. This file is inert in CI and requires an explicit opt-in.
// Run from mydealsportal-backend with:
// MYDEALSPORTAL_STRIPE_TEST_KEY=sk_test_... \\
// MYDEALSPORTAL_TEST_PROMOTION_CONFIRM=APPLY_TEST_ONLY \\
// node apply-test-promotion.js
import Stripe from "stripe";
import {applyTestPromotionSchedule} from "./test-promotion-executor.js";
const subId="sub_1UOqnPIHJWXNHkKx9biBENIm";
const expectedPrice="price_1UOpZgIHJWXNHkKxIi1crSCn";
const couponId="8YGAywdJ";
const key=process.env.MYDEALSPORTAL_STRIPE_TEST_KEY;
if(!key?.startsWith("sk_test_") || process.env.MYDEALSPORTAL_TEST_PROMOTION_CONFIRM!=="APPLY_TEST_ONLY"){
 console.error("Requires Stripe sk_test_ key and explicit APPLY_TEST_ONLY confirmation. No changes made.");
 process.exitCode=1;
}else{
 const stripe=new Stripe(key);
 try{
  const sub=await stripe.subscriptions.retrieve(subId);
  const price=sub.items?.data?.[0]?.price;
  if(sub.livemode!==false || sub.status!=="active" || price?.id!==expectedPrice ||
     sub.metadata?.plan!=="standard" || sub.metadata?.environment!=="test" ||
     sub.metadata?.firebaseUid!=="stripe_standard_test_probe_only" ||
     sub.items?.data?.length!==1 || sub.items.data[0].quantity!==1)
   throw Error("Unexpected subscription: refusing schedule mutation");
  const invoiceId=typeof sub.latest_invoice==="string"?sub.latest_invoice:sub.latest_invoice?.id;
  const invoice=await stripe.invoices.retrieve(invoiceId);
  const linked=invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
  if(invoice.livemode!==false || invoice.status!=="paid" ||
     invoice.amount_paid!==4999 || linked!==subId ||
     invoice.billing_reason!=="subscription_create")
   throw Error("Verified paid initial $49.99 invoice required");
  const result=await applyTestPromotionSchedule({
   stripe,apiKey:key,subscription:sub,planKey:"standard",
   initialInvoicePaid:true,nowSeconds:Math.floor(Date.now()/1000),
   coupon:{id:couponId}
  });
  const schedule=await stripe.subscriptionSchedules.retrieve(result.scheduleId);
  if(schedule.livemode!==false || schedule.subscription!==subId || schedule.phases?.length!==3)
   throw Error("Schedule created but final phases must be reviewed in Stripe");
  console.log("TEST schedule attached:",schedule.id);
  console.log(JSON.stringify(schedule.phases.map(p=>({
   start:p.start_date,end:p.end_date,discounts:p.discounts,
   items:p.items?.map(i=>({price:typeof i.price==="string"?i.price:i.price?.id}))
  })),null,2));
 }catch(e){console.error("Test promotion incomplete:",e.message);process.exitCode=1;}
}
