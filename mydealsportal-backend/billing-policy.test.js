import test from "node:test";
import assert from "node:assert/strict";
import { FOUNDING_LIMIT, PLANS, choosePlan, amountDueForBillingMonth, priceForPlan, mayPublish } from "./billing-policy.js";

test("founding cutoff is first 100 confirmed paid businesses", () => {
  assert.equal(FOUNDING_LIMIT, 100);
  assert.equal(choosePlan(0).key, "founding");
  assert.equal(choosePlan(99).key, "founding");
  assert.equal(choosePlan(100).key, "standard");
  assert.equal(choosePlan(101).key, "standard");
  for (const invalid of [-1, 1.5, NaN, Infinity, "99", null]) {
    assert.throws(() => choosePlan(invalid), RangeError);
  }
});
test("founding bills first cycle then two free cycles then resumes", () => {
  assert.deepEqual([1,2,3,4,5,6].map(m => amountDueForBillingMonth("founding",m)), [4499,0,0,4499,4499,4499]);
});
test("standard bills first cycle then one free cycle then resumes", () => {
  assert.deepEqual([1,2,3,4,5].map(m => amountDueForBillingMonth("standard",m)), [4999,0,4999,4999,4999]);
});
test("plans use verified live price IDs", () => {
  assert.equal(priceForPlan("founding"), "price_1UOVlFIHJWXNHkKxKgfNFoRy");
  assert.equal(priceForPlan("standard"), "price_1UOVlJIHJWXNHkKxDCIpogsu");
  assert.notEqual(PLANS.founding.priceId, PLANS.standard.priceId);
  assert.throws(() => priceForPlan("premium"));
  assert.throws(() => amountDueForBillingMonth("founding", 0), RangeError);
});
test("publishing requires initial verified paid invoice and active subscription", () => {
  assert.equal(mayPublish({initialInvoicePaid:true,stripeStatus:"active"}),true);
  assert.equal(mayPublish({initialInvoicePaid:false,stripeStatus:"active"}),false);
  for (const stripeStatus of ["trialing","incomplete","past_due","unpaid","canceled","paused",null]) {
    assert.equal(mayPublish({initialInvoicePaid:true,stripeStatus}),false);
  }
  assert.equal(mayPublish({initialInvoicePaid:true,stripeStatus:"active",businessSuspended:true}),false);
});
