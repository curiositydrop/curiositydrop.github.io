import test from "node:test";
import assert from "node:assert/strict";
import {resolveSandboxSubscription} from "./sandbox-event-resolver.js";
const stripe={
 checkout:{sessions:{retrieve:async()=>({subscription:"sub_123"})}},
 subscriptions:{retrieve:async id=>({id,customer:"cus_123",metadata:{sandboxOnly:"true",firebaseUid:"owner1"}})}
};
const evt=(type,object)=>({livemode:false,type,data:{object}});
test("resolve subscription event with verified Stripe metadata",async()=>{
 const result=await resolveSandboxSubscription({stripe,event:evt("customer.subscription.updated",{id:"sub_123"})});
 assert.equal(result.uid,"owner1");
 assert.equal(result.status,"resolved");
});
test("checkout requires server-fetched session",async()=>{
 const result=await resolveSandboxSubscription({stripe,event:evt("checkout.session.completed",{id:"cs_test_1",subscription:"sub_untrusted"})});
 assert.equal(result.subscriptionId,"sub_123");
});
test("nested invoice subscription is recognized",async()=>{
 const result=await resolveSandboxSubscription({stripe,event:evt("invoice.paid",{id:"in_1",parent:{subscription_details:{subscription:"sub_123"}}})});
 assert.equal(result.status,"resolved");
});
test("live events and unbound subscriptions are rejected",async()=>{
 await assert.rejects(resolveSandboxSubscription({stripe,event:{...evt("customer.subscription.updated",{id:"sub_123"}),livemode:true}}));
 const unsafe={...stripe,subscriptions:{retrieve:async id=>({id,metadata:{firebaseUid:"owner1"}})}};
 await assert.rejects(resolveSandboxSubscription({stripe:unsafe,event:evt("customer.subscription.updated",{id:"sub_123"})}));
});
test("unmapped events stay unresolved",async()=>{
 const result=await resolveSandboxSubscription({stripe,event:evt("refund.updated",{id:"re_123"})});
 assert.equal(result.status,"unresolved");
});
