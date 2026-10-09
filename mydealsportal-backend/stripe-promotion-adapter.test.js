import test from "node:test";
import assert from "node:assert/strict";
import {attachPromotionSchedule} from "./stripe-promotion-adapter.js";
const subscription={id:"sub_123",status:"active",schedule:null,current_period_end:2000,metadata:{plan:"founding"},items:{data:[{quantity:1,price:{id:"price_1UOVlFIHJWXNHkKxKgfNFoRy"}}]}};
test("draft preserves paid period and does not update Stripe",async()=>{
 let updates=0;
 const stripe={subscriptionSchedules:{create:async()=>({id:"sub_sched_1",phases:[{start_date:1000,end_date:2000,items:[{price:"price_1UOVlFIHJWXNHkKxKgfNFoRy",quantity:1}]}]}),update:async()=>{updates++;}}};
 const result=await attachPromotionSchedule({stripe,subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500});
 assert.equal(result.phases[0].end_date,2000);
 assert.equal(result.phases[1].iterations,2);
 assert.equal(result.readyToApply,false);
 assert.equal(updates,0);
});
test("rejects a schedule with unexpected period dates",async()=>{
 const stripe={subscriptionSchedules:{create:async()=>({id:"sub_sched_1",phases:[{start_date:1000,end_date:2100,items:[]}]}),update:async()=>{}}};
 await assert.rejects(attachPromotionSchedule({stripe,subscription,planKey:"founding",initialInvoicePaid:true,nowSeconds:1500}),/require review/);
});
