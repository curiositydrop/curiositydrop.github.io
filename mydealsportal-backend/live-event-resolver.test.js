import test from "node:test";
import assert from "node:assert/strict";
import {resolveLiveEventSubscription} from "./live-event-resolver.js";
const mk=(type,object)=>({livemode:true,type,data:{object}});
const stripe={checkout:{sessions:{retrieve:async id=>({id,livemode:true,subscription:"sub_test123"})}}};
test("checkout fetches authoritative subscription ID from Stripe",async()=>{
 const result=await resolveLiveEventSubscription({stripe,event:mk("checkout.session.completed",{id:"cs_test123"})});
 assert.deepEqual(result,{status:"resolved",subscriptionId:"sub_test123"});
});
test("nested invoice subscription and cancellation resolve",async()=>{
 assert.equal((await resolveLiveEventSubscription({stripe,event:mk("invoice.paid",{id:"in_1",parent:{subscription_details:{subscription:"sub_abc"}}})})).subscriptionId,"sub_abc");
 assert.equal((await resolveLiveEventSubscription({stripe,event:mk("customer.subscription.deleted",{id:"sub_expired"})})).subscriptionId,"sub_expired");
});
test("refunds require payment-to-invoice verification before entitlement writes",async()=>{
 const r=await resolveLiveEventSubscription({stripe,event:mk("charge.refunded",{id:"ch_1"})});
 assert.equal(r.status,"manual_review");
});
test("rejects live/test crossover and forged checkout sessions",async()=>{
 await assert.rejects(resolveLiveEventSubscription({stripe,event:{...mk("invoice.paid",{id:"in_1"}),livemode:false}}));
 const spoof={checkout:{sessions:{retrieve:async()=>({id:"cs_other",livemode:true,subscription:"sub_1"})}}};
 await assert.rejects(resolveLiveEventSubscription({stripe:spoof,event:mk("checkout.session.completed",{id:"cs_1"})}),/mismatch/);
});

test("refund updates stay reviewable and never guess a subscription",async()=>{
 for(const type of ["refund.created","refund.updated","charge.refunded"]){
  const result=await resolveLiveEventSubscription({stripe,event:mk(type,{id:"re_or_ch_123",customer:"cus_1",payment_intent:"pi_123"})});
  assert.deepEqual(result,{status:"manual_review",subscriptionId:null});
 }
});
test("missing checkout subscription is unresolved, not misattributed",async()=>{
 const noSub={checkout:{sessions:{retrieve:async id=>({id,livemode:true,subscription:null})}}};
 const result=await resolveLiveEventSubscription({stripe:noSub,event:mk("checkout.session.completed",{id:"cs_987"})});
 assert.equal(result.status,"unresolved");
});
