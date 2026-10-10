import test from "node:test";
import assert from "node:assert/strict";
import {reserveFoundingSlot} from "./founding-firestore.js";
function setup({confirmed=0,reserved=0,existing=null,ownerUid="u1",nextSlot=99,freeSlots=[]}={}){
 const writes=[], refs={};
 const db={collection(name){return {doc(id){return refs[name]??=( {name,id} );}}},runTransaction(fn){return fn({
 get:async ref=>ref.name==="billingInventory"?{exists:true,data:()=>({confirmed,reserved,nextSlot,freeSlots})}:
 ref.name==="foundingReservations"?{exists:!!existing,data:()=>existing}:
 {exists:true,data:()=>({ownerUid})},
 set:(ref,value)=>writes.push({name:ref.name,value})
 });}};
 return {db,writes};
}
test("reserves slot and increments shared inventory",async()=>{
 const {db,writes}=setup({confirmed:98,reserved:0});
 const result=await reserveFoundingSlot({db,uid:"u1",nowSeconds:100});
 assert.equal(result.slot,99);assert.equal(writes.length,2);assert.equal(writes[0].value.reserved,1);
});
test("all 100 spots held or paid yield standard",async()=>{
 const {db,writes}=setup({confirmed:99,reserved:1});
 assert.equal((await reserveFoundingSlot({db,uid:"u1",nowSeconds:100})).status,"standard");
 assert.equal(writes.length,0);
});
test("existing unexpired hold is reused",async()=>{
 const {db,writes}=setup({confirmed:50,reserved:1,existing:{status:"reserved",slot:51,expiresAt:200}});
 assert.equal((await reserveFoundingSlot({db,uid:"u1",nowSeconds:100})).slot,51);
 assert.equal(writes.length,0);
});
test("expired holds are blocked until cleanup",async()=>{
 const {db,writes}=setup({confirmed:50,reserved:1,existing:{status:"reserved",slot:51,expiresAt:100}});
 assert.equal((await reserveFoundingSlot({db,uid:"u1",nowSeconds:100})).status,"expired_cleanup_required");
 assert.equal(writes.length,0);
});
test("ownership mismatch rejects reservation",async()=>{
 const {db}=setup({ownerUid:"other"});
 await assert.rejects(reserveFoundingSlot({db,uid:"u1",nowSeconds:100}));
});

test("reuses only explicitly released slots, not confirmed slot numbers",async()=>{
 const {db,writes}=setup({confirmed:80,reserved:0,nextSlot:100,freeSlots:[12]});
 const result=await reserveFoundingSlot({db,uid:"u1",nowSeconds:100});
 assert.equal(result.slot,12);
 assert.equal(writes[0].value.nextSlot,100);
 assert.deepEqual(writes[0].value.freeSlots,[]);
});
test("never creates a duplicate number when all slot numbers were used",async()=>{
 const {db,writes}=setup({confirmed:99,reserved:0,nextSlot:101,freeSlots:[]});
 assert.equal((await reserveFoundingSlot({db,uid:"u1",nowSeconds:100})).status,"standard");
 assert.equal(writes.length,0);
});
