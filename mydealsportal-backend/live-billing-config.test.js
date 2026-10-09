import test from "node:test";
import assert from "node:assert/strict";
import { assertLiveBillingConfiguration, LIVE_SECRET_NAMES } from "./live-billing-config.js";
import { PLANS } from "./billing-policy.js";
const valid={
 apiKey:"sk_live_example_only",
 webhookSigningSecret:"whsec_example_only",
 priceIds:{founding:PLANS.founding.priceId,standard:PLANS.standard.priceId}
};
test("accepts only the approved live catalog",()=>{
 const config=assertLiveBillingConfiguration(valid);
 assert.equal(config.livemode,true);
 assert.deepEqual(config.prices,valid.priceIds);
 assert.equal(JSON.stringify(config).includes("sk_live_"),false);
});
test("refuses test keys, missing secrets and mismatched prices",()=>{
 for(const bad of [
  {...valid,apiKey:"sk_test_example"},
  {...valid,webhookSigningSecret:""},
  {...valid,priceIds:{...valid.priceIds,founding:"price_wrong"}},
  {...valid,priceIds:{founding:PLANS.standard.priceId,standard:PLANS.standard.priceId}}
 ]) assert.throws(()=>assertLiveBillingConfiguration(bad));
});
test("live and sandbox have dedicated secret names",()=>{
 assert.notEqual(LIVE_SECRET_NAMES.stripeApiKey,"STRIPE_SECRET_KEY");
 assert.notEqual(LIVE_SECRET_NAMES.webhookSigningSecret,"STRIPE_WEBHOOK_SECRET");
});
