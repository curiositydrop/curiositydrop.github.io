import test from "node:test";
import assert from "node:assert/strict";
import {previewPromotionSchedule} from "./stripe-promotion-adapter.js";
const subscription={id:"sub_123",status:"active",schedule:null,current_period_end:2000,metadata:{plan:"founding"},items:{data:[{quantity:1,price:{id:"price_1UOVlFIHJWXNHkKxKgfNFoRy"}}]}};
test("previews two free months without any Stripe calls",()=>{
 const draft=previewPromotionSchedule({subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500});
 assert.equal(draft.freeCycles,2);
 assert.equal(draft.paidPeriodEnds,2000);
 assert.equal(draft.readyToApply,false);
});
test("unpaid and scheduled subscriptions cannot get preview",()=>{
 assert.throws(()=>previewPromotionSchedule({subscription,planKey:"founding",initialInvoicePaid:false,nowSeconds:1500}));
 assert.throws(()=>previewPromotionSchedule({subscription:{...subscription,schedule:"sub_sched_1"},planKey:"founding",initialInvoicePaid:true,nowSeconds:1500}));
});
