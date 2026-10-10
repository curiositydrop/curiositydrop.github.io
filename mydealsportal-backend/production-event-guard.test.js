import test from "node:test";
import assert from "node:assert/strict";
import {verifyProductionEvent} from "./production-event-guard.js";
const account="acct_1UNxa7IHJWXNHkKx";
test("allows verified live account events",()=>{
 assert.equal(verifyProductionEvent({id:"evt_1",livemode:true,account},account),true);
 assert.equal(verifyProductionEvent({id:"evt_2",livemode:true},account),true);
});
test("rejects sandbox and unrelated accounts",()=>{
 assert.throws(()=>verifyProductionEvent({id:"evt_1",livemode:false},account));
 assert.throws(()=>verifyProductionEvent({id:"evt_1",livemode:true,account:"acct_other"},account));
 assert.throws(()=>verifyProductionEvent({id:"evt_1",livemode:true,context:"acct_other"},account));
});
test("requires target account ID",()=>{
 assert.throws(()=>verifyProductionEvent({id:"evt_1",livemode:true},""));
});
