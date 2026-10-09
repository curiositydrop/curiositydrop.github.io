import test from "node:test";
import assert from "node:assert/strict";
import {buildPromotionPhases} from "./promotion-schedule.js";
const founding={planKey:"founding",priceId:"price_1UOVlFIHJWXNHkKxKgfNFoRy",initialInvoicePaid:true,firstPeriodEnd:2000};
test("founding promotion uses two free months after paid month",()=>{
 const p=buildPromotionPhases(founding);assert.equal(p.promotionCycles,2);
 assert.deepEqual(p.phases[0].duration,{interval:"month",interval_count:2});
 assert.equal(p.phases[0].discountPercent,100);assert.equal(p.endBehavior,"release");
});
test("standard promotion uses one free month",()=>{
 const p=buildPromotionPhases({...founding,planKey:"standard",priceId:"price_1UOVlJIHJWXNHkKxDCIpogsu"});
 assert.equal(p.promotionCycles,1);
 assert.deepEqual(p.phases[0].duration,{interval:"month",interval_count:1});
});
test("rejects unverified payment and wrong price",()=>{
 assert.throws(()=>buildPromotionPhases({...founding,initialInvoicePaid:false}));
 assert.throws(()=>buildPromotionPhases({...founding,priceId:"price_wrong"}));
 assert.throws(()=>buildPromotionPhases({...founding,firstPeriodEnd:null}));
});
