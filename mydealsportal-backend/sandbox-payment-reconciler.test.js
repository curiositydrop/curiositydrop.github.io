import test from "node:test";
import assert from "node:assert/strict";
import {reconcileSandboxPayment} from "./sandbox-payment-reconciler.js";
function fixture({paid=true,refunded=false,price="price_1UOpZgIHJWXNHkKxIi1crSCn",owner="u1",status="active",latestFree=false}={}){
 const records=new Map([["businesses/u1",{ownerUid:owner,checkoutPlan:"standard",stripeCustomerId:"cus_test1",subscriptionStatus:"pending"}]]);
 const snapshot=key=>({exists:records.has(key),data:()=>records.get(key)});
 const db={collection:c=>({doc:id=>({key:c+"/"+id,get:async()=>snapshot(c+"/"+id)})}),
 runTransaction:async fn=>fn({get:async r=>snapshot(r.key),update:(r,v)=>records.set(r.key,{...records.get(r.key),...v}),create:(r,v)=>records.set(r.key,v)})};
 const initial={id:"in_initial",subscription:"sub_test1",status:paid?"paid":"open",amount_paid:paid?4999:0,billing_reason:"subscription_create",created:1};
 const next={id:"in_free",subscription:"sub_test1",status:"paid",amount_paid:0,billing_reason:"subscription_cycle",created:2};
 const stripe={subscriptions:{retrieve:async()=>({id:"sub_test1",livemode:false,status,customer:"cus_test1",metadata:{firebaseUid:"u1",environment:"test",plan:"standard",project:"mydealsportal"},items:{data:[{price:{id:price},quantity:1,current_period_end:3000}]}})},
 invoices:{list:async()=>({data:latestFree?[initial,next]:[initial],has_more:false}),retrieve:async id=>({id,livemode:false,status:"paid",payments:{data:[{status:"paid",payment:{payment_intent:"pi_test1"}}],has_more:false}})},
 refunds:{list:async()=>({data:refunded?[{status:"succeeded"}]:[],has_more:false})}};
 const args={stripe,db,FieldValue:{serverTimestamp:()=>10},subscriptionId:"sub_test1",eventId:"evt_test1",nowSeconds:2000};
 return {args,records};
}
test("paid Stripe test invoice activates matching business",async()=>{
 const {args,records}=fixture();
 assert.equal(await reconcileSandboxPayment(args),"updated");
 assert.equal(records.get("businesses/u1").sandboxPublishingEnabled,true);
 assert.equal(records.get("businesses/u1").publishingEnabled,undefined);
 assert.equal(records.get("businesses/u1").sandboxInitialInvoicePaid,true);
});
test("second free paid invoice preserves paid-first entitlement",async()=>{
 const {args,records}=fixture({latestFree:true});
 await reconcileSandboxPayment(args);
 assert.equal(records.get("businesses/u1").sandboxPublishingEnabled,true);
});
test("unpaid first invoice stays inactive",async()=>{
 const {args,records}=fixture({paid:false});
 await reconcileSandboxPayment(args);
 assert.equal(records.get("businesses/u1").sandboxPublishingEnabled,false);
});
test("refund and wrong price reject activation",async()=>{
 for(const settings of [{refunded:true},{price:"price_wrong"},{owner:"other"}]){
  const {args,records}=fixture(settings);
  await assert.rejects(reconcileSandboxPayment(args));
  assert.equal(records.get("businesses/u1").sandboxPublishingEnabled,undefined);
 }
});
test("duplicate event is idempotent",async()=>{
 const {args,records}=fixture();
 assert.equal(await reconcileSandboxPayment(args),"updated");
 assert.equal(await reconcileSandboxPayment(args),"duplicate");
 assert.equal(records.get("businesses/u1").sandboxPublishingEnabled,true);
});
