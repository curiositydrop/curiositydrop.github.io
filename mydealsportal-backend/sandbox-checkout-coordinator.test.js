import test from "node:test";
import assert from "node:assert/strict";
import {eligibleSandboxBusiness,prepareSandboxCheckout,STANDARD_TEST_PRICE} from "./sandbox-checkout-coordinator.js";
const biz={ownerUid:"u1",name:"Business",status:"draft",subscriptionStatus:"unpaid"};
function fixture(business=biz){
 const stored={...business}, calls={sessions:0,expired:0};
 const stripe={
  customers:{create:async()=>({id:"cus_123"})},
  checkout:{sessions:{
   create:async params=>{calls.sessions++;calls.params=params;return {id:"cs_test_123",url:"https://checkout.stripe.com/test"};},
   expire:async()=>{calls.expired++;}
  }}
 };
 const db={collection:()=>({doc:()=>({})}),runTransaction:async fn=>fn({
  get:async()=>({exists:true,data:()=>stored}),
  update:(_ref,patch)=>Object.assign(stored,patch)
 })};
 return {stripe,db,stored,calls};
}
const args={uid:"u1",email:"test@example.com",origin:"https://curiositydrop.github.io",nowSeconds:1000};
test("draft unpaid owner may check out, and Stripe binds its subscription",async()=>{
 const f=fixture();const out=await prepareSandboxCheckout({...args,business:biz,stripe:f.stripe,db:f.db});
 assert.equal(out.sessionId,"cs_test_123");
 assert.equal(f.calls.params.line_items[0].price,STANDARD_TEST_PRICE);
 assert.equal(f.calls.params.subscription_data.metadata.firebaseUid,"u1");
 assert.equal(f.stored.checkoutPlan,"standard");
 assert.equal(f.stored.subscriptionStatus,"pending");
});
test("unauthorized, active, or already checking out accounts are rejected",async()=>{
 for(const data of [{...biz,ownerUid:"u2"},{...biz,status:"active"},{...biz,checkoutSessionId:"cs_old"}]){
  const f=fixture(data);
  assert.equal(eligibleSandboxBusiness(data,"u1"),false);
  await assert.rejects(prepareSandboxCheckout({...args,business:data,stripe:f.stripe,db:f.db}));
  assert.equal(f.calls.sessions,0);
 }
});
test("failed Firestore registration expires Stripe Checkout",async()=>{
 const f=fixture();
 f.db.runTransaction=async()=>{throw Error("firestore failed")};
 await assert.rejects(prepareSandboxCheckout({...args,business:biz,stripe:f.stripe,db:f.db}),/firestore failed/);
 assert.equal(f.calls.expired,1);
});
