import test from "node:test";
import assert from "node:assert/strict";
import {preparePromotionSchedule} from "./promotion-preflight.js";
const sub={id:"sub_123",status:"active",schedule:null,current_period_end:2000,metadata:{plan:"founding"},items:{data:[{quantity:1,price:{id:"price_1UOVlFIHJWXNHkKxKgfNFoRy"}}]}};
const args={subscription:sub,planKey:"founding",initialInvoicePaid:true,nowSeconds:1000};
test("valid paid subscription produces expected free cycles",()=>{
 assert.equal(preparePromotionSchedule(args).promotionCycles,2);
});
test("existing schedules are never overwritten",()=>{
 assert.throws(()=>preparePromotionSchedule({...args,subscription:{...sub,schedule:"sub_sched_1"}}));
});
test("wrong plan, extra items or expired period rejected",()=>{
 assert.throws(()=>preparePromotionSchedule({...args,planKey:"standard"}));
 assert.throws(()=>preparePromotionSchedule({...args,subscription:{...sub,items:{data:[...sub.items.data,...sub.items.data]}}}));
 assert.throws(()=>preparePromotionSchedule({...args,nowSeconds:2000}));
});
test("unpaid initial invoice cannot schedule discounts",()=>{
 assert.throws(()=>preparePromotionSchedule({...args,initialInvoicePaid:false}));
});
