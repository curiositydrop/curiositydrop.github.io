import test from "node:test";
import assert from "node:assert/strict";
import {desiredPublication,synchronizeDeals} from "./publication-sync.js";
test("paid business can be publication eligible",()=>assert.equal(desiredPublication({paid:true,suspended:false}),true));
test("suspended businesses stay hidden",()=>assert.equal(desiredPublication({paid:true,suspended:true}),false));
test("unpaid businesses stay hidden",()=>assert.equal(desiredPublication({paid:false,suspended:false}),false));

test("server sync publishes and revokes a business owner's deals",async()=>{
 const business={ownerUid:"u1",publishingEnabled:true};
 const deals=[{ref:{id:"d1"},data:()=>({ownerUid:"u1"})},{ref:{id:"d2"},data:()=>({ownerUid:"u1"})}];
 const updated=[];
 const db={
   collection(name){
     if(name==="businesses")return {doc:()=>({get:async()=>({exists:true,data:()=>business})})};
     return {where:(field,op,value)=>{
       assert.deepEqual([field,op,value],["ownerUid","==","u1"]);
       return {get:async()=>({docs:deals})};
     }};
   },
   batch(){return {update(ref,data){updated.push({ref,data})},commit:async()=>{}}}
 };
 assert.deepEqual(await synchronizeDeals(db,"u1"),{visible:true,updated:2});
 assert.ok(updated.every(x=>x.data.publishingApproved===true));
 business.billingSuspended=true;
 updated.length=0;
 assert.deepEqual(await synchronizeDeals(db,"u1"),{visible:false,updated:2});
 assert.ok(updated.every(x=>x.data.publishingApproved===false));
});
