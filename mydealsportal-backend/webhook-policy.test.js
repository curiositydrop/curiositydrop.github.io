import test from "node:test";
import assert from "node:assert/strict";
import { classifyStripeEvent } from "./webhook-policy.js";

const evt = (type, object = { id: "in_123", subscription: "sub_123" }) => ({
  id: "evt_123", type, livemode: false, data: { object }
});

test("paid invoice requests reconciliation, never grants access by itself", () => {
  const result = classifyStripeEvent(evt("invoice.paid"), { expectedLiveMode: false });
  assert.equal(result.action, "reconcile");
  assert.equal(result.stripeSubscriptionId, "sub_123");
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.eventId, "evt_123");
});

test("failure, cancellation, subscription changes and refunds require reconciliation", () => {
  for (const type of [
    "invoice.payment_failed", "invoice.voided", "invoice.marked_uncollectible",
    "customer.subscription.created", "customer.subscription.updated",
    "customer.subscription.deleted", "charge.refunded",
    "checkout.session.completed", "checkout.session.async_payment_failed",
    "checkout.session.async_payment_succeeded"
  ]) {
    assert.equal(classifyStripeEvent(evt(type), { expectedLiveMode:false }).action, "reconcile");
  }
});

test("subscription events use the subscription object's own ID", () => {
  const result = classifyStripeEvent(evt("customer.subscription.deleted", { id:"sub_456" }), { expectedLiveMode:false });
  assert.equal(result.stripeSubscriptionId, "sub_456");
});

test("unknown events are ignored safely", () => {
  const result = classifyStripeEvent(evt("customer.created"), { expectedLiveMode:false });
  assert.equal(result.action, "ignore");
  assert.equal(result.grantsEntitlement, false);
});

test("blocks live/test crossover and malformed events", () => {
  assert.throws(() => classifyStripeEvent(evt("invoice.paid"), {expectedLiveMode:true}), /mode mismatch/);
  assert.throws(() => classifyStripeEvent(evt("invoice.paid")), /mode is required/);
  assert.throws(() => classifyStripeEvent({...evt("invoice.paid"),id:""}, {expectedLiveMode:false}), /Malformed/);
  assert.throws(() => classifyStripeEvent({...evt("invoice.paid"),data:{}}, {expectedLiveMode:false}), /Malformed/);
});
