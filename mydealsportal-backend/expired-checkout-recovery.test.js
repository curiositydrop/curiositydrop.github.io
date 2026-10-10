import test from "node:test";
import assert from "node:assert/strict";
import {releaseExpiredCheckout} from "./expired-checkout-recovery.js";
const session={id:"cs_test_123",status:"expired",payment_status:"unpaid",subscription:null,
 customer:"cus_123",metadata:{firebaseUid:"u1",project:"mydealsportal",plan:"standard"}};
function setup({stripeSession=session,business={ownerUid:"u1",checkoutSessionId:"cs_test_123",checkoutPlan:"standard",stripeCustomerId:"cus_123"}}={}){
 const writes=[];
 return {stripe:{checkout:{sessions:{retrieve:async()=>stripeSession}}},
 db:{collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>business}),
 update:(_ref,value)=>writes.push(value)})},writes};
}
test("unpaid expired checkout unlocks retry without creating entitlements",async()=>{
 const a=setup();assert.deepEqual(await releaseExpiredCheckout({...a,uid:"u1",sessionId:session.id}),{status:"released"});
 assert.equal(a.writes[0].checkoutSessionId,null);
 assert.equal(a.writes[0].publishingEnabled,false);
});
test("open or paid sessions cannot unlock checkout",async()=>{
 for(const stripeSession of [{...session,status:"open"},{...session,payment_status:"paid"},
 {...session,subscription:"sub_123"},{...session,metadata:{...session.metadata,firebaseUid:"other"}}]){
  const a=setup({stripeSession});
  await assert.rejects(releaseExpiredCheckout({...a,uid:"u1",sessionId:session.id}));
  assert.equal(a.writes.length,0);
 }
});
test("superseded checkout cannot clear a newer session",async()=>{
 const a=setup({business:{ownerUid:"u1",checkoutSessionId:"cs_new",stripeCustomerId:"cus_123"}});
 assert.deepEqual(await releaseExpiredCheckout({...a,uid:"u1",sessionId:session.id}),{status:"superseded"});
 assert.equal(a.writes.length,0);
});
test("changed Stripe customer and active subscriptions block unlock",async()=>{
 for(const extra of [{stripeCustomerId:"cus_other"},{stripeSubscriptionId:"sub_1"}]){
  const a=setup({business:{ownerUid:"u1",checkoutSessionId:session.id,checkoutPlan:"standard",stripeCustomerId:"cus_123",...extra}});
  await assert.rejects(releaseExpiredCheckout({...a,uid:"u1",sessionId:session.id}));
  assert.equal(a.writes.length,0);
 }
});
