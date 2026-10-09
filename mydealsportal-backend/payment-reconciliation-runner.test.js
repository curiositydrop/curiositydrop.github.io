import test from "node:test";
import assert from "node:assert/strict";
import {reconcilePaymentEvent} from "./payment-reconciliation-runner.js";
const subscription={id:"sub_1",livemode:true,metadata:{project:"mydealsportal",firebaseUid:"u1",plan:"standard"},customer:"cus_1",status:"active",items:{data:[{price:{id:"price_1UOVlJIHJWXNHkKxDCIpogsu"},quantity:1}]},current_period_end:2000};
const initial={id:"in_1",subscription:"sub_1",billing_reason:"subscription_create",status:"paid",amount_paid:4499,payment_intent:"pi_123",created:1};
const latest={id:"in_2",subscription:"sub_1",billing_reason:"subscription_cycle",status:"paid",amount_paid:0,created:2};
function setup({history={data:[latest,initial],has_more:false},sub=subscription,suspended=false,customer="cus_1",refunds=[]}={}){
 const writes=[];const refs={};
 const db={collection(name){return {doc(){return refs[name]??={name,get:async()=>({exists:true,data:()=>({ownerUid:"u1",stripeCustomerId:customer,billingSuspended:suspended})})};}}},runTransaction:fn=>fn({
  get:async ref=>ref.name==="businesses"?{exists:true,data:()=>({ownerUid:"u1",stripeCustomerId:"cus_1"})}:{exists:false},
  update:(_,data)=>writes.push(data),create:()=>{}
 })};
 const stripe={subscriptions:{retrieve:async()=>sub},invoices:{list:async()=>history,retrieve:async id=>({id,payments:{data:[{status:"paid",payment:{payment_intent:"pi_123"}}],has_more:false}})},refunds:{list:async()=>({data:refunds,has_more:false})}};
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

test("incomplete modern invoice payment history fails closed",async()=>{
 const {args}=setup();
 args.stripe.invoices.retrieve=async id=>({id,payments:{data:[],has_more:true}});
 await assert.rejects(reconcilePaymentEvent(args),/Complete invoice payment/);
});

test("rejects a subscription associated with the wrong checkout plan",async()=>{
 const {args,writes}=setup({sub:{...subscription,metadata:{...subscription.metadata,plan:"unknown"}}});
 await assert.rejects(reconcilePaymentEvent(args),/plan mismatch/);
 assert.equal(writes.length,0);
});

test("unpaid invoice does not require PaymentIntent or refund history",async()=>{
 const {args,writes}=setup({history:{data:[{...initial,status:"open",amount_paid:0,payment_intent:null}],has_more:false}});
 args.stripe.invoices.retrieve=async()=>{throw Error("No payment should be looked up");};
 await reconcilePaymentEvent(args);
 assert.equal(writes[0].publishingEnabled,false);
});

test("forged plan metadata with wrong Stripe price cannot activate",async()=>{
 const {args,writes}=setup({sub:{...subscription,items:{data:[{price:{id:"price_wrong"},quantity:1}]}}});
 await assert.rejects(reconcilePaymentEvent(args),/price mismatch/);
 assert.equal(writes.length,0);
});
