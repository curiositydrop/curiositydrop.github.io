import test from "node:test";
import assert from "node:assert/strict";
import {validateCheckoutReservation} from "./checkout-reservation-validation.js";
const base={uid:"u1",business:{ownerUid:"u1"},reservation:{uid:"u1",slot:100,status:"reserved",expiresAt:200},nowSeconds:100};
test("valid reserved founding slot stays bound to business",()=>{
 assert.deepEqual(validateCheckoutReservation(base),{uid:"u1",plan:"founding",slot:100,expiresAt:200,status:"reserved"});
});
test("rejects stolen, expired or unreserved slots",()=>{
 for(const reservation of [{...base.reservation,uid:"another"},{...base.reservation,expiresAt:100},{...base.reservation,status:"confirmed"},{...base.reservation,slot:101}])
  assert.throws(()=>validateCheckoutReservation({...base,reservation}));
});
test("rejects different owners and ongoing checkout",()=>{
 assert.throws(()=>validateCheckoutReservation({...base,business:{ownerUid:"someoneElse"}}));
 assert.throws(()=>validateCheckoutReservation({...base,business:{ownerUid:"u1",checkoutSessionId:"cs_existing"}}));
});
