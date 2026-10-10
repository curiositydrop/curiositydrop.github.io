import test from "node:test";
import assert from "node:assert/strict";
import {assertCheckoutOrigin,validateOwnedBusiness,requireServerPlan,buildCheckoutParams} from "./checkout-contract.js";

const business={ownerUid:"uid-1",name:"Test Business",subscriptionStatus:"none"};
const base={authenticatedUid:"uid-1",authenticatedEmail:"owner@example.com",authenticatedEmailVerified:true,business,stripeCustomerId:"cus_verified",planKey:"standard",origin:"https://curiositydrop.github.io"};
test("allows only exact trusted origins",()=>{
  assert.equal(assertCheckoutOrigin(base.origin),base.origin);
  for(const origin of ["https://evil.example","https://mydealsportal.com.evil.test","http://mydealsportal.com",null,""])
    assert.throws(()=>assertCheckoutOrigin(origin));
});
test("requires matching Firebase-authenticated ownership",()=>{
  assert.equal(validateOwnedBusiness(base).uid,"uid-1");
  assert.throws(()=>validateOwnedBusiness({...base,authenticatedUid:"attacker"}));
  assert.throws(()=>validateOwnedBusiness({...base,business:{...business,stripeSubscriptionId:"sub_existing"}}));
  assert.throws(()=>validateOwnedBusiness({...base,business:{...business,subscriptionStatus:"active"}}));
});
test("first-month Checkout is paid, never trial",()=>{
  const result=buildCheckoutParams(base);
  assert.equal(result.line_items[0].price,"price_1UOVlJIHJWXNHkKxDCIpogsu");
  assert.equal(result.line_items[0].quantity,1);
  assert.equal(result.mode,"subscription");
  assert.equal(result.subscription_data.trial_period_days,undefined);
  assert.equal(result.customer,"cus_verified");
  assert.throws(()=>buildCheckoutParams({...base,stripeCustomerId:"cus_not",business:{...business,ownerUid:"intruder"}}));
});
test("founding needs server slot bound to same user",()=>{
  assert.throws(()=>buildCheckoutParams({...base,planKey:"founding"}));
  assert.throws(()=>requireServerPlan({planKey:"founding",uid:"uid-1",foundingGrant:{uid:"someone-else",plan:"founding",status:"reserved",slot:1}}));
  const grant={uid:"uid-1",plan:"founding",status:"reserved",slot:100};
  assert.equal(buildCheckoutParams({...base,planKey:"founding",foundingGrant:grant}).line_items[0].price,"price_1UOVlFIHJWXNHkKxKgfNFoRy");
  for (const slot of [0,101,-1,"1"]) assert.throws(()=>requireServerPlan({planKey:"founding",uid:"uid-1",foundingGrant:{...grant,slot}}));
});

test("checkout rejects unverified email and pending sessions",()=>{
 assert.throws(()=>buildCheckoutParams({...base,authenticatedEmailVerified:false}),/Verified email/);
 assert.throws(()=>buildCheckoutParams({...base,business:{...business,subscriptionStatus:"pending"}}),/existing subscription/i);
 assert.throws(()=>buildCheckoutParams({...base,business:{...business,checkoutSessionId:"cs_pending"}}),/existing subscription/i);
});
