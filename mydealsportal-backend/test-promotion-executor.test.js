import test from "node:test";
import assert from "node:assert/strict";
import {applyTestPromotionSchedule} from "./test-promotion-executor.js";
const subscription={id:"sub_123",livemode:false,status:"active",schedule:null,current_period_end:2000,metadata:{plan:"founding"},items:{data:[{quantity:1,price:{id:"price_1UOVlFIHJWXNHkKxKgfNFoRy"},current_period_end:2000}]}};
const coupon={id:"coupon_123",percent_off:100,valid:true};
function setup(){
 let create=0,update=0;const stripe={coupons:{retrieve:async()=>coupon},subscriptions:{retrieve:async()=>subscription},subscriptionSchedules:{
  retrieve:async()=>({id:"sub_sched_123",livemode:false,subscription:"sub_123",phases:[{start_date:1000,end_date:2000,items:[{price:"price_1UOVlFIHJWXNHkKxKgfNFoRy",quantity:1}]}]}),
  create:async()=>{create++;return {id:"sub_sched_123",livemode:false,subscription:"sub_123",phases:[{start_date:1000,end_date:2000,items:[{price:"price_1UOVlFIHJWXNHkKxKgfNFoRy",quantity:1}]}]};},
  update:async(id,body)=>{update++;assert.equal(body.phases[1].duration.interval_count,2);return {id,livemode:false};}
 }};
 return {stripe,stats:()=>({create,update})};
}
const opts={apiKey:"sk_test_for_unit_test",subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500,coupon};
test("test mode updates schedule after confirmed paid period",async()=>{
 const f=setup();const result=await applyTestPromotionSchedule({...opts,stripe:f.stripe});
 assert.equal(result.testMode,true);assert.deepEqual(f.stats(),{create:1,update:1});
});
test("live keys and live subscriptions cannot mutate schedules",async()=>{
 const f=setup();
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe,apiKey:"sk_live_forbidden"}));
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe,subscription:{...subscription,livemode:true}}));
 assert.deepEqual(f.stats(),{create:0,update:0});
});
test("unpaid initial invoices and already scheduled subscriptions cannot mutate",async()=>{
 const f=setup();
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe,initialInvoicePaid:false}));
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe,subscription:{...subscription,schedule:"sub_sched_prior"}}));
 assert.deepEqual(f.stats(),{create:0,update:0});
});
test("changed subscription before application fails without creating schedule",async()=>{
 const f=setup();f.stripe.subscriptions.retrieve=async()=>({...subscription,current_period_end:2001,items:{data:[{...subscription.items.data[0],current_period_end:2001}]}});
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe}),/changed/);
 assert.deepEqual(f.stats(),{create:0,update:0});
});

test("rejects invalid coupon fetched from Stripe without creating a schedule",async()=>{
 const f=setup();f.stripe.coupons.retrieve=async()=>({...coupon,percent_off:50});
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe}),/100%/);
 assert.deepEqual(f.stats(),{create:0,update:0});
});

test("failed phase update reports existing schedule ID for recovery",async()=>{
 const f=setup();f.stripe.subscriptionSchedules.update=async()=>{throw new Error("Stripe temporarily unavailable");};
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe}),/inspect schedule sub_sched_123/);
 assert.equal(f.stats().create,1);
});

test("resumes existing unconfigured test schedule without creating another",async()=>{
 const f=setup();
 f.stripe.subscriptions.retrieve=async()=>({...subscription,schedule:"sub_sched_123"});
 const result=await applyTestPromotionSchedule({...opts,stripe:f.stripe,subscription:{...subscription,schedule:"sub_sched_123"}});
 assert.equal(result.scheduleId,"sub_sched_123");
 assert.deepEqual(f.stats(),{create:0,update:1});
});
test("refuses to overwrite an already customized promotion",async()=>{
 const f=setup();
 f.stripe.subscriptions.retrieve=async()=>({...subscription,schedule:"sub_sched_123"});
 f.stripe.subscriptionSchedules.retrieve=async()=>({id:"sub_sched_123",livemode:false,subscription:"sub_123",phases:[{},{}]});
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe,subscription:{...subscription,schedule:"sub_sched_123"}}),/will not overwrite/);
 assert.deepEqual(f.stats(),{create:0,update:0});
});

test("refuses unexpected schedule added concurrently",async()=>{
 const f=setup();f.stripe.subscriptions.retrieve=async()=>({...subscription,schedule:"sub_sched_other"});
 await assert.rejects(applyTestPromotionSchedule({...opts,stripe:f.stripe}),/changed/);
 assert.deepEqual(f.stats(),{create:0,update:0});
});
