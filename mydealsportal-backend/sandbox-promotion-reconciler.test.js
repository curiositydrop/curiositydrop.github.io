import test from "node:test";
import assert from "node:assert/strict";
import {ensureSandboxPromotion} from "./sandbox-promotion-reconciler.js";
const make=(overrides={})=>{
 const sub={id:"sub_123",livemode:false,status:"active",metadata:{project:"mydealsportal",environment:"test",plan:"standard"},schedule:null,...overrides};
 const stripe={
  subscriptions:{retrieve:async()=>sub},
  invoices:{list:async()=>({has_more:false,data:[{billing_reason:"subscription_create",status:"paid",amount_paid:4999}]})},
  subscriptionSchedules:{retrieve:async()=>({livemode:false,subscription:sub.id,phases:[{},{},{}],end_behavior:"release"})}
 };
 return {sub,stripe};
};
const args={apiKey:"sk_test_fake_unit_test_only",subscriptionId:"sub_123",planKey:"standard",nowSeconds:100};
test("already-attached valid test schedule is idempotent",async()=>{
 const {stripe}=make({schedule:"sub_sched_123"});
 const r=await ensureSandboxPromotion({...args,stripe});
 assert.equal(r.alreadyConfigured,true);
});
test("rejects live Stripe subscriptions",async()=>{
 const {stripe}=make({livemode:true,schedule:"sub_sched_123"});
 await assert.rejects(ensureSandboxPromotion({...args,stripe}),/Invalid sandbox/);
});
test("rejects unpaid first month",async()=>{
 const {stripe}=make();
 stripe.invoices.list=async()=>({has_more:false,data:[{billing_reason:"subscription_create",status:"open",amount_paid:0}]});
 await assert.rejects(ensureSandboxPromotion({...args,stripe}),/Paid first/);
});
test("partial schedule requires manual review",async()=>{
 const {stripe}=make({schedule:"sub_sched_123"});
 stripe.subscriptionSchedules.retrieve=async()=>({livemode:false,subscription:"sub_123",phases:[{}],end_behavior:"release"});
 await assert.rejects(ensureSandboxPromotion({...args,stripe}),/requires review/);
});
