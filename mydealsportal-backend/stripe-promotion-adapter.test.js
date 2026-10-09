import test from "node:test";
import assert from "node:assert/strict";
import {previewPromotionSchedule,proposeScheduleUpdate} from "./stripe-promotion-adapter.js";
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

test("constructs paid/free/regular phases without applying them",()=>{
 const preview=previewPromotionSchedule({subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500});
 const result=proposeScheduleUpdate({preview,coupon:{id:"coupon_123",percent_off:100,valid:true},schedule:{subscription:"sub_123",phases:[{start_date:1000,end_date:2000,items:[{price:"price_1UOVlFIHJWXNHkKxKgfNFoRy",quantity:1}]}]}});
 assert.equal(result.phases.length,3);
 assert.equal(result.phases[0].end_date,2000);
 assert.equal(result.phases[1].duration.interval_count,2);
 assert.equal(result.phases[1].discounts[0].coupon,"coupon_123");
 assert.equal(result.phases[2].discounts,undefined);
});
test("rejects wrong coupon and copied phase",()=>{
 const preview=previewPromotionSchedule({subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500});
 const schedule={subscription:"sub_123",phases:[{start_date:1000,end_date:2000,items:[{price:"price_1UOVlFIHJWXNHkKxKgfNFoRy",quantity:1}]}]};
 assert.throws(()=>proposeScheduleUpdate({preview,schedule,coupon:{id:"coupon_wrong",percent_off:50,valid:true}}));
 assert.throws(()=>proposeScheduleUpdate({preview,schedule:{...schedule,subscription:"sub_other"},coupon:{id:"coupon_123",percent_off:100,valid:true}}));
});
