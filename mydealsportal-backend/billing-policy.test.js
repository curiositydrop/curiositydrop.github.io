import test from "node:test";
import assert from "node:assert/strict";
import {PLANS,billingPlan,advanceMonths,nextChargeAt} from "./billing-policy.js";
const at = s=>Math.floor(Date.parse(s)/1000);
test("production price IDs are distinct",()=>{
 assert.equal(PLANS.founding.amountCents,4499);
 assert.equal(PLANS.standard.amountCents,4999);
 assert.equal(new Set(Object.values(PLANS).flatMap(p=>[p.firstMonthPrice,p.recurringPrice])).size,4);
});
test("founding pays first month then next at month four",()=>{
 assert.equal(nextChargeAt(at("2026-10-10T12:00:00Z"),"founding"),at("2027-01-10T12:00:00Z"));
});
test("standard pays first month then next at month three",()=>{
 assert.equal(nextChargeAt(at("2026-10-10T12:00:00Z"),"standard"),at("2026-12-10T12:00:00Z"));
});
test("month ends are clamped",()=>{
 assert.equal(advanceMonths(at("2027-01-31T10:00:00Z"),1),at("2027-02-28T10:00:00Z"));
});
test("unknown plan rejected",()=>assert.throws(()=>billingPlan("untrusted")));
