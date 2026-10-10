import test from "node:test";
import assert from "node:assert/strict";
import { reconcileVerifiedSubscription } from "./stripe-reconciliation.js";

const sub = {id:"sub_1",customer:"cus_1",status:"active",current_period_end:2000};
const initial = {id:"in_1",subscription:"sub_1",status:"paid",amount_paid:4499};
const latest = {id:"in_2",subscription:"sub_1",status:"paid",amount_paid:0};
const args = {subscription:sub,firstInvoice:initial,latestInvoice:latest,nowSeconds:1000};

test("paid initial invoice permits free promotional invoice", () => {
 const state = reconcileVerifiedSubscription(args);
 assert.equal(state.publishingEnabled,true);
 assert.equal(state.initialInvoicePaid,true);
 assert.equal(state.stripeCustomerId,"cus_1");
});
test("free or unpaid initial invoice cannot unlock service", () => {
 for (const inv of [{...initial,amount_paid:0},{...initial,status:"open"}]) {
  const s=reconcileVerifiedSubscription({...args,firstInvoice:inv});
  assert.equal(s.publishingEnabled,false);
 }
});
test("failed latest invoice and canceled subscription disable listings",()=>{
 assert.equal(reconcileVerifiedSubscription({...args,latestInvoice:{...latest,status:"open"}}).publishingEnabled,false);
 assert.equal(reconcileVerifiedSubscription({...args,subscription:{...sub,status:"canceled"}}).publishingEnabled,false);
});
test("reject cross-subscription invoice mixups",()=>{
 assert.throws(()=>reconcileVerifiedSubscription({...args,latestInvoice:{...latest,subscription:"sub_other"}}));
 assert.throws(()=>reconcileVerifiedSubscription({...args,firstInvoice:null}));
});
test("reject elapsed subscription period",()=>{
 assert.equal(reconcileVerifiedSubscription({...args,nowSeconds:2001}).publishingEnabled,false);
});

test("supports newer nested subscription invoice references",()=>{
 const inv1={...initial,subscription:undefined,parent:{subscription_details:{subscription:"sub_1"}}};
 const inv2={...latest,subscription:undefined,parent:{subscription_details:{subscription:"sub_1"}}};
 assert.equal(reconcileVerifiedSubscription({...args,firstInvoice:inv1,latestInvoice:inv2}).publishingEnabled,true);
});
test("uses current period from subscription items when present",()=>{
 const subscription={...sub,current_period_end:undefined,items:{data:[{current_period_end:2000}]}};
 assert.equal(reconcileVerifiedSubscription({...args,subscription}).publishingEnabled,true);
 assert.equal(reconcileVerifiedSubscription({...args,subscription,nowSeconds:2001}).publishingEnabled,false);
});
