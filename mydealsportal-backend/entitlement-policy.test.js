import test from "node:test";
import assert from "node:assert/strict";
import { deriveEntitlement } from "./entitlement-policy.js";
const baseline = {initialInvoicePaid:true,subscriptionStatus:"active",suspended:false,latestInvoiceStatus:"paid",periodEnd:2000,nowSeconds:1000};
test("verified paid active subscription can publish",()=>assert.equal(deriveEntitlement(baseline).publishingEnabled,true));
test("unpaid initial invoice never activates business",()=>assert.equal(deriveEntitlement({...baseline,initialInvoicePaid:false}).reason,"awaiting_initial_payment"));
test("failure, cancellation, and delinquency disable publishing",()=>{
 for(const status of ["canceled","incomplete","past_due","unpaid","paused","trialing"])
   assert.equal(deriveEntitlement({...baseline,subscriptionStatus:status}).publishingEnabled,false);
});
test("nonpaid latest invoices or expiration disable publishing",()=>{
 for(const latestInvoiceStatus of ["open","void","uncollectible","draft"])
   assert.equal(deriveEntitlement({...baseline,latestInvoiceStatus}).publishingEnabled,false);
 assert.equal(deriveEntitlement({...baseline,periodEnd:1000}).publishingEnabled,false);
});
test("suspension overrides otherwise active payment",()=>assert.equal(deriveEntitlement({...baseline,suspended:true}).publishingEnabled,false));
test("rejects malformed verified inputs",()=> {
 assert.throws(()=>deriveEntitlement({...baseline,nowSeconds:-1}));
 assert.throws(()=>deriveEntitlement({...baseline,initialInvoicePaid:"yes"}));
});
