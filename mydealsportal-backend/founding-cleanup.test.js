import test from "node:test";
import assert from "node:assert/strict";
import {releaseExpiredFoundingHold} from "./founding-cleanup.js";
function setup({hold={uid:"u1",status:"reserved",slot:1,expiresAt:100},reserved=1,nextSlot=2,freeSlots=[]}={}){
 const writes=[], refs={};
 const db={collection(name){return {doc(){return refs[name]??={name};}}},runTransaction(fn){return fn({
  get:async ref=>ref.name==="billingInventory"?{exists:true,data:()=>({reserved,nextSlot,freeSlots})}:{exists:!!hold,data:()=>hold},
  update:(ref,data)=>writes.push({name:ref.name,data})
 });}};
 return {db,writes};
}
const args=db=>({db,uid:"u1",nowSeconds:100,paymentCleared:true});
test("releases verified-cleared expired hold and decrements inventory",async()=>{
 const {db,writes}=setup();
 assert.equal((await releaseExpiredFoundingHold(args(db))).status,"released");
 assert.equal(writes[0].data.reserved,0);
 assert.deepEqual(writes[0].data.freeSlots,[1]);
 assert.equal(writes[1].data.status,"released");
});
test("does not release before expiration",async()=>{
 const {db,writes}=setup({hold:{uid:"u1",status:"reserved",expiresAt:101}});
 assert.equal((await releaseExpiredFoundingHold(args(db))).status,"not_expired");
 assert.equal(writes.length,0);
});
test("never releases confirmed spots",async()=>{
 const {db,writes}=setup({hold:{uid:"u1",status:"confirmed",expiresAt:90}});
 assert.equal((await releaseExpiredFoundingHold(args(db))).status,"unchanged");
 assert.equal(writes.length,0);
});
test("requires payment clearance and valid counter",async()=>{
 const {db}=setup();
 await assert.rejects(releaseExpiredFoundingHold({...args(db),paymentCleared:false}));
 const invalid=setup({reserved:0});
 await assert.rejects(releaseExpiredFoundingHold(args(invalid.db)),/Inventory invalid/);
});
