import test from "node:test";
import assert from "node:assert/strict";
import {reconcilePaymentEvent} from "./payment-reconciliation-runner.js";
const subscription={id:"sub_1",livemode:true,metadata:{project:"mydealsportal",firebaseUid:"u1"},customer:"cus_1",status:"active",current_period_end:2000};
const initial={id:"in_1",subscription:"sub_1",billing_reason:"subscription_create",status:"paid",amount_paid:4499,payment_intent:"pi_123",created:1};
const latest={id:"in_2",subscription:"sub_1",billing_reason:"subscription_cycle",status:"paid",amount_paid:0,created:2};
function setup({history={data:[latest,initial],has_more:false},sub=subscription,suspended=false,customer="cus_1",refunds=[]}={}){
 const writes=[];const refs={};
 const db={collection(name){return {doc(){return refs[name]??={name,get:async()=>({exists:true,data:()=>({ownerUid:"u1",stripeCustomerId:customer,billingSuspended:suspended})})};}}},runTransaction:fn=>fn({
  get:async ref=>ref.name==="businesses"?{exists:true,data:()=>({ownerUid:"u1",stripeCustomerId:"cus_1"})}:{exists:false},
  update:(_,data)=>writes.push(data),create:()=>{}
 })};
 const stripe={subscriptions:{retrieve:async()=>sub},invoices:{list:async()=>history},refunds:{list:async()=>({data:refunds,has_more:false})}};
 const args={stripe,db,FieldValue:{serverTimestamp:()=>123},eventId:"evt_1",subscriptionId:"sub_1",nowSeconds:1000};
 return {args,writes};
}
test("paid initial invoice activates after server-side reconciliation",async()=>{
 const {args,writes}=setup();
 assert.equal(await reconcilePaymentEvent(args),"updated");
 assert.equal(writes[0].publishingEnabled,true);
});
test("does not activate for unpaid initial invoice",async()=>{
 const {args,writes}=setup({history:{data:[latest,{...initial,status:"open",amount_paid:0}],has_more:false}});
 await reconcilePaymentEvent(args);
 assert.equal(writes[0].publishingEnabled,false);
});
test("incomplete history and unbound Stripe subscriptions fail closed",async()=>{
 const a=setup({history:{data:[latest,initial],has_more:true}});
 await assert.rejects(reconcilePaymentEvent(a.args),/Complete invoice history/);
 const b=setup({sub:{...subscription,metadata:{firebaseUid:"u1"}}});
 await assert.rejects(reconcilePaymentEvent(b.args),/Verified live/);
});

test("admin suspension remains effective after successful payment",async()=>{
 const {args,writes}=setup({suspended:true});
 await reconcilePaymentEvent(args);
 assert.equal(writes[0].publishingEnabled,false);
});
test("cross-customer subscription cannot activate another business",async()=>{
 const {args,writes}=setup({customer:"cus_someoneelse"});
 await assert.rejects(reconcilePaymentEvent(args),/customer mismatch/);
 assert.equal(writes.length,0);
});

test("refunded initial charge disables publishing",async()=>{
 const {args,writes}=setup({refunds:[{id:"re_1",status:"succeeded"}]});
 await reconcilePaymentEvent(args);
 assert.equal(writes[0].publishingEnabled,false);
});
test("pending refund conservatively prevents publishing",async()=>{
 const {args,writes}=setup({refunds:[{id:"re_2",status:"pending"}]});
 await reconcilePaymentEvent(args);
 assert.equal(writes[0].publishingEnabled,false);
});
