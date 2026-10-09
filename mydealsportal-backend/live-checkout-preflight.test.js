import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLiveCheckoutPreflight} from "./live-checkout-preflight.js";
const auth={uid:"u1",email:"owner@example.com",email_verified:true};
const business={ownerUid:"u1",name:"Example",subscriptionStatus:"none"};
test("verified owner is eligible but checkout remains disabled",()=>{
 assert.deepEqual(evaluateLiveCheckoutPreflight({auth,business}),{eligible:true,checkoutEnabled:false,businessUid:"u1"});
});
test("rejects wrong business owner",()=>assert.throws(()=>evaluateLiveCheckoutPreflight({auth,business:{...business,ownerUid:"other"}})));
test("rejects unverified email",()=>assert.throws(()=>evaluateLiveCheckoutPreflight({auth:{...auth,email_verified:false},business})));
test("blocks duplicate checkout and active subscription",()=>{
 assert.throws(()=>evaluateLiveCheckoutPreflight({auth,business:{...business,checkoutSessionId:"cs_1"}}));
 assert.throws(()=>evaluateLiveCheckoutPreflight({auth,business:{...business,subscriptionStatus:"active"}}));
});
