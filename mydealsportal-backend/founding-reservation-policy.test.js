import test from "node:test";
import assert from "node:assert/strict";
import {reserveDecision, confirmationDecision} from "./founding-reservation-policy.js";
test("first 100 total confirmed plus held slots may reserve",()=>{
 assert.equal(reserveDecision({confirmed:98,reserved:1}),"reserve");
 assert.equal(reserveDecision({confirmed:99,reserved:1}),"standard");
 assert.equal(reserveDecision({confirmed:100,reserved:0}),"standard");
});
test("existing reservation can be reused without double allocation",()=>{
 assert.equal(reserveDecision({confirmed:99,reserved:1,existingReservation:true}),"reuse");
});
test("over-allocation and invalid counts are rejected",()=>{
 for(const x of [{confirmed:100,reserved:1},{confirmed:-1,reserved:0},{confirmed:1.5,reserved:0}])
  assert.throws(()=>reserveDecision(x));
});
test("only unexpired held slots confirm",()=>{
 assert.equal(confirmationDecision({status:"reserved",expiresAt:200,nowSeconds:199}),"confirm");
 assert.equal(confirmationDecision({status:"reserved",expiresAt:200,nowSeconds:200}),"expired");
 assert.equal(confirmationDecision({status:"confirmed",expiresAt:200,nowSeconds:300}),"already-confirmed");
 assert.equal(confirmationDecision({status:"released",expiresAt:200,nowSeconds:100}),"reject");
});
