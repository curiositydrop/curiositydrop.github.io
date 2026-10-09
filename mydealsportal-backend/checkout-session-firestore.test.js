import test from "node:test";
import assert from "node:assert/strict";
import {recordCheckoutSession} from "./checkout-session-firestore.js";
function setup({ownerUid="u1",existingSession=null,hold={uid:"u1",status:"reserved",slot:1,expiresAt:200}}={}){
 const writes=[],refs={};
 const db={collection(name){return {doc(){return refs[name]??={name};}}},runTransaction(fn){return fn({
  get:async ref=>ref.name==="businesses"?{exists:true,data:()=>({ownerUid,checkoutSessionId:existingSession})}:{exists:!!hold,data:()=>hold},
  update:(ref,data)=>writes.push(data)
 });}};
 return {db,writes};
}
const args=db=>({db,uid:"u1",sessionId:"cs_live_123",planKey:"founding",nowSeconds:100});
test("records verified business checkout session",async()=>{
 const {db,writes}=setup();const result=await recordCheckoutSession(args(db));
 assert.equal(result.status,"recorded");
 assert.equal(writes[0].subscriptionStatus,"pending");
});
test("rejects duplicate checkout session and incorrect owner",async()=>{
 for(const fixture of [{existingSession:"cs_other"},{ownerUid:"other"}]){
  const {db,writes}=setup(fixture);await assert.rejects(recordCheckoutSession(args(db)));
  assert.equal(writes.length,0);
 }
});
test("rejects expired or stolen founding hold",async()=>{
 for(const hold of [{uid:"other",status:"reserved",slot:1,expiresAt:200},{uid:"u1",status:"reserved",slot:1,expiresAt:100}]){
  const {db,writes}=setup({hold});await assert.rejects(recordCheckoutSession(args(db)));
  assert.equal(writes.length,0);
 }
});
test("standard checkout does not consume founding inventory",async()=>{
 const {db,writes}=setup({hold:null});
 assert.equal((await recordCheckoutSession({...args(db),planKey:"standard"})).status,"recorded");
 assert.equal(writes.length,1);
});
