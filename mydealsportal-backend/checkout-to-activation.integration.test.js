import test from "node:test";
import assert from "node:assert/strict";
import {prepareAndRecordCheckout} from "./checkout-coordinator.js";
import {reconcilePaymentEvent} from "./payment-reconciliation-runner.js";

// Deterministic in-memory Firestore transactional fixture, not a Stripe or
// Firebase emulator. Live readiness still requires Stripe test-clock tests.
function firestore(){
 const records=new Map([["businesses/u1",{
  ownerUid:"u1",name:"Demo business",subscriptionStatus:"none"
 }]]);
 const db={
  collection(name){return {doc(id){return {key:name+"/"+id,get:async()=>snapshot(name+"/"+id)};}};},
  runTransaction:async fn=>fn({
   get:async ref=>snapshot(ref.key),
   update(ref,delta){records.set(ref.key,{...records.get(ref.key),...delta});},
   create(ref,value){if(records.has(ref.key))throw Error("already-exists");records.set(ref.key,value);},
   set(ref,value){records.set(ref.key,value);}
  })
 };
 function snapshot(key){return {exists:records.has(key),data:()=>records.get(key)};}
 return {db,records};
}
function stripeFixture({paid=true,refunded=false}={}){
 let createdSession;
 const stripe={
  customers:{create:async()=>({id:"cus_123"})},
  checkout:{sessions:{
   create:async params=>{
    createdSession={id:"cs_test_123",url:"https://checkout.stripe.com/c/pay/123",params};
    return createdSession;
   },
   expire:async()=>{}
  }},
  subscriptions:{retrieve:async()=>({
   id:"sub_123",customer:"cus_123",status:"active",livemode:true,
   metadata:{firebaseUid:"u1",project:"mydealsportal",plan:"standard"},
   current_period_end:2000
  })},
  invoices:{
   list:async()=>({has_more:false,data:[
    {id:"in_123",subscription:"sub_123",billing_reason:"subscription_create",
     status:paid?"paid":"open",amount_paid:paid?4999:0,created:1}
   ]}),
   retrieve:async id=>({id,payments:{data:[{status:"paid",
    payment:{payment_intent:"pi_123"}}],has_more:false}})
  },
  refunds:{list:async()=>({data:refunded?[{id:"re_123",status:"succeeded"}]:[],has_more:false})}
 };
 return {stripe,getSession:()=>createdSession};
}
const checkoutArgs={uid:"u1",email:"owner@example.com",emailVerified:true,
 business:{ownerUid:"u1",name:"Demo business",subscriptionStatus:"none"},
 customerId:null,planKey:"standard",origin:"https://curiositydrop.github.io",
 requestId:"testcheckout123",nowSeconds:1000};
test("paid checkout proceeds from session registration to publishing",async()=>{
 const {db,records}=firestore(),{stripe,getSession}=stripeFixture();
 const result=await prepareAndRecordCheckout({...checkoutArgs,stripe,db});
 assert.equal(result.sessionId,"cs_test_123");
 assert.equal(getSession().params.line_items[0].price,"price_1UOVlJIHJWXNHkKxDCIpogsu");
 assert.equal(records.get("businesses/u1").subscriptionStatus,"pending");
 assert.equal(records.get("businesses/u1").stripeCustomerId,"cus_123");
 assert.equal(records.get("businesses/u1").publishingEnabled,undefined);
 const activation=await reconcilePaymentEvent({stripe,db,
  FieldValue:{serverTimestamp:()=>123},eventId:"evt_123",
  subscriptionId:"sub_123",nowSeconds:1000});
 assert.equal(activation,"updated");
 assert.equal(records.get("businesses/u1").publishingEnabled,true);
 assert.equal(records.get("businesses/u1").initialInvoicePaid,true);
 assert.equal(records.get("businesses/u1").stripeSubscriptionId,"sub_123");
 assert.equal(await reconcilePaymentEvent({stripe,db,
  FieldValue:{serverTimestamp:()=>123},eventId:"evt_123",
  subscriptionId:"sub_123",nowSeconds:1000}),"duplicate");
});
for(const [name,settings] of [
 ["unpaid first invoice",{paid:false}],
 ["refunded initial payment",{refunded:true}]
]){
 test(name+" does not activate publishing",async()=>{
  const {db,records}=firestore(),{stripe}=stripeFixture(settings);
  await prepareAndRecordCheckout({...checkoutArgs,stripe,db});
  await reconcilePaymentEvent({stripe,db,
   FieldValue:{serverTimestamp:()=>123},eventId:"evt_987",
   subscriptionId:"sub_123",nowSeconds:1000});
  assert.equal(records.get("businesses/u1").publishingEnabled,false);
 });
}
