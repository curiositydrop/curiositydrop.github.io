import test from "node:test";
import assert from "node:assert/strict";
import {prepareAndRecordCheckout} from "./checkout-coordinator.js";
const business={ownerUid:"u1",name:"Demo",subscriptionStatus:"none"};
function fixture({ownerUid="u1",expireThrows=false}={}){
 let createCalls=0,customerCalls=0,expires=0,writes=0;
 const stripe={customers:{create:async()=>{customerCalls++;return {id:"cus_created123"};}},checkout:{sessions:{
  create:async()=>{createCalls++;return {id:"cs_test_123",url:"https://checkout.stripe.com/c/pay/123"};},
  expire:async()=>{expires++;if(expireThrows)throw Error("expire failure");}
 }}};
 const refs={};
 const db={collection(name){return {doc(){return refs[name]??={name};}}},runTransaction:fn=>fn({
  get:async ref=>ref.name==="businesses"?{exists:true,data:()=>({ownerUid})}:{exists:false},
  update:()=>{writes++;}
 })};
 const args={stripe,db,uid:"u1",email:"owner@example.com",emailVerified:true,business,
  customerId:"cus_123",planKey:"standard",origin:"https://curiositydrop.github.io",
  requestId:"serverrequest123",nowSeconds:100};
 return {args,stats:()=>({createCalls,customerCalls,expires,writes})};
}
test("creates and registers before returning Checkout URL",async()=>{
 const f=fixture();const result=await prepareAndRecordCheckout(f.args);
 assert.equal(result.sessionId,"cs_test_123");
 assert.deepEqual(f.stats(),{createCalls:1,customerCalls:0,expires:0,writes:1});
});
test("expires unregistered session if Firestore fails",async()=>{
 const f=fixture({ownerUid:"wrong"});
 await assert.rejects(prepareAndRecordCheckout(f.args),/registration failed/);
 assert.deepEqual(f.stats(),{createCalls:1,customerCalls:0,expires:1,writes:0});
});
test("surfaces failure when session cannot be expired",async()=>{
 const f=fixture({ownerUid:"wrong",expireThrows:true});
 await assert.rejects(prepareAndRecordCheckout(f.args),/reconciliation required/);
 assert.equal(f.stats().expires,1);
});
test("does not create Checkout for unverified owner",async()=>{
 const f=fixture();
 await assert.rejects(prepareAndRecordCheckout({...f.args,emailVerified:false}));
 assert.equal(f.stats().createCalls,0);
});

test("creates Stripe customer when a new business lacks one",async()=>{
 const f=fixture();await prepareAndRecordCheckout({...f.args,customerId:null});
 assert.equal(f.stats().customerCalls,1);
 assert.equal(f.stats().createCalls,1);
});
