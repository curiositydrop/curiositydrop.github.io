import test from "node:test";
import assert from "node:assert/strict";
import {recordBillingReconciliation} from "./billing-firestore.js";

const state = {stripeCustomerId:"cus_1",stripeSubscriptionId:"sub_1",stripeStatus:"active",initialInvoicePaid:true,publishingEnabled:true};
function fixture({ownerUid="user1",customer=null,subscription=null,duplicate=false}={}) {
  const writes = [];
  const businessRef={type:"business"}, eventRef={type:"event"};
  const db={
    collection(name){return {doc(){return name==="businesses"?businessRef:eventRef;}}},
    runTransaction(fn){return fn({
      get:async ref=>ref===businessRef
        ? {exists:true,data:()=>({ownerUid,stripeCustomerId:customer,stripeSubscriptionId:subscription})}
        : {exists:duplicate},
      update:(ref,data)=>writes.push(["update",data]),
      create:(ref,data)=>writes.push(["create",data])
    });}
  };
  return {writes,args:{db,FieldValue:{serverTimestamp:()=>123},uid:"user1",eventId:"evt_1",state}};
}

test("records matched business and event",async()=>{
 const {args,writes}=fixture();
 assert.equal(await recordBillingReconciliation(args),"updated");
 assert.equal(writes.length,2);
 assert.equal(writes[0][1].publishingEnabled,true);
});
test("duplicate event makes no writes",async()=>{
 const {args,writes}=fixture({duplicate:true});
 assert.equal(await recordBillingReconciliation(args),"duplicate");
 assert.equal(writes.length,0);
});
test("rejects ownership and subscription mismatches",async()=>{
 for(const opts of [{ownerUid:"stranger"},{customer:"cus_other"},{subscription:"sub_other"}]){
  const {args,writes}=fixture(opts);
  await assert.rejects(recordBillingReconciliation(args),/mismatch/);
  assert.equal(writes.length,0);
 }
});
test("rejects missing verified identifiers",async()=>{
 const {args}=fixture();
 await assert.rejects(recordBillingReconciliation({...args,eventId:"invalid"}));
 await assert.rejects(recordBillingReconciliation({...args,state:{...state,stripeCustomerId:"invalid"}}));
});
