import test from "node:test";
import assert from "node:assert/strict";
import {confirmFoundingPayment} from "./founding-confirmation.js";
const subscription={id:"sub_1",customer:"cus_1",metadata:{firebaseUid:"u1",plan:"founding"}};
const invoice={id:"in_1",subscription:"sub_1",status:"paid",amount_paid:4499};
function setup({reservation={slot:1,status:"reserved",expiresAt:200},confirmed=0,reserved=1,ownerUid="u1",stripeCustomerId="cus_1"}={}){
 const writes=[],refs={};
 const db={collection(name){return {doc(){return refs[name]??={name};}}},runTransaction(fn){return fn({
  get:async ref=>ref.name==="billingInventory"?{exists:true,data:()=>({confirmed,reserved})}:
  ref.name==="foundingReservations"?{exists:!!reservation,data:()=>reservation}:
  {exists:true,data:()=>({ownerUid,stripeCustomerId})},
  update:(ref,data)=>writes.push({name:ref.name,data})
 });}};
 return {db,writes};
}
const args=db=>({db,uid:"u1",subscription,invoice,nowSeconds:100});
test("verified first payment moves reserved to confirmed atomically",async()=>{
 const {db,writes}=setup();const result=await confirmFoundingPayment(args(db));
 assert.deepEqual(result,{status:"confirmed",slot:1});
 assert.deepEqual(writes[0].data,{confirmed:1,reserved:0});
 assert.equal(writes[2].data.foundingSlot,1);
});
test("duplicate confirmed payment is idempotent",async()=>{
 const {db,writes}=setup({reservation:{status:"confirmed",slot:1,subscriptionId:"sub_1",invoiceId:"in_1"}});
 assert.equal((await confirmFoundingPayment(args(db))).status,"already_confirmed");
 assert.equal(writes.length,0);
});
test("expired hold does not confirm or alter counters",async()=>{
 const {db,writes}=setup({reservation:{status:"reserved",slot:1,expiresAt:100}});
 assert.equal((await confirmFoundingPayment(args(db))).status,"expired_requires_review");
 assert.equal(writes.length,0);
});
test("unpaid invoices and mismatched metadata are rejected",async()=>{
 const {db,writes}=setup();
 await assert.rejects(confirmFoundingPayment({...args(db),invoice:{...invoice,status:"open"}}));
 await assert.rejects(confirmFoundingPayment({...args(db),subscription:{...subscription,metadata:{plan:"founding",firebaseUid:"other"}}}));
 assert.equal(writes.length,0);
});
test("unknown slot or owner mismatch blocks confirmation",async()=>{
 const {db}=setup({ownerUid:"other"});
 await assert.rejects(confirmFoundingPayment(args(db)),/Ownership/);
});

test("modern nested invoice subscription can confirm founding payment",async()=>{
 const {db,writes}=setup();
 const modern={...invoice,subscription:undefined,parent:{subscription_details:{subscription:"sub_1"}}};
 assert.equal((await confirmFoundingPayment({...args(db),invoice:modern})).status,"confirmed");
 assert.equal(writes.length,3);
});
test("payment with the wrong Stripe customer cannot claim founding slot",async()=>{
 const {db,writes}=setup({stripeCustomerId:"cus_elsewhere"});
 await assert.rejects(confirmFoundingPayment(args(db)),/customer mismatch/);
 assert.equal(writes.length,0);
});
