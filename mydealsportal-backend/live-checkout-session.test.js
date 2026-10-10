import test from "node:test";
import assert from "node:assert/strict";
import {createVerifiedCheckoutSession} from "./live-checkout-session.js";
const base={uid:"u1",email:"owner@example.com",emailVerified:true,
 business:{ownerUid:"u1",name:"Test Co",subscriptionStatus:"none"},
 customerId:"cus_123",planKey:"standard",origin:"https://curiositydrop.github.io",
 requestId:"request_123456"};
test("creates paid-first subscription with server-fixed price",async()=>{
 let captured;
 const stripe={checkout:{sessions:{create:async(p,o)=>{captured={p,o};return {id:"cs_123",url:"https://checkout.stripe.com/c/pay/123"};}}}};
 const s=await createVerifiedCheckoutSession({...base,stripe});
 assert.equal(s.sessionId,"cs_123");
 assert.equal(captured.p.line_items[0].price,"price_1UOVlJIHJWXNHkKxDCIpogsu");
 assert.equal(captured.p.mode,"subscription");
 assert.equal(captured.p.subscription_data.trial_period_days,undefined);
 assert.match(captured.o.idempotencyKey,/request_123456/);
});
test("rejects missing reservation or unverified owner before Stripe call",async()=>{
 let calls=0;
 const stripe={checkout:{sessions:{create:async()=>{calls++;return {};}}}};
 await assert.rejects(createVerifiedCheckoutSession({...base,stripe,planKey:"founding"}));
 await assert.rejects(createVerifiedCheckoutSession({...base,stripe,emailVerified:false}));
 await assert.rejects(createVerifiedCheckoutSession({...base,stripe,business:{...base.business,ownerUid:"other"}}));
 assert.equal(calls,0);
});
test("rejects invalid server-issued request ID before Stripe call",async()=>{
 let calls=0;
 const stripe={checkout:{sessions:{create:async()=>{calls++;return {};}}}};
 await assert.rejects(createVerifiedCheckoutSession({...base,stripe,requestId:"x"}));
 assert.equal(calls,0);
});
