// Server-only Firestore transaction reserving a Founding 100 slot.
// Caller must authenticate the business owner and validate the business.
// Expired reservations require a separately audited cleanup transaction.
import {reserveDecision, FOUNDING_CAP} from "./founding-reservation-policy.js";
export async function reserveFoundingSlot({db,uid,nowSeconds,holdSeconds=1800}) {
 if (!db?.runTransaction || typeof uid!=="string" || !uid ||
     !Number.isSafeInteger(nowSeconds) || nowSeconds<0 ||
     !Number.isSafeInteger(holdSeconds) || holdSeconds<60 || holdSeconds>3600)
   throw new Error("Invalid reservation request");
 const inventory=db.collection("billingInventory").doc("founding100");
 const reservation=db.collection("foundingReservations").doc(uid);
 const business=db.collection("businesses").doc(uid);
 return db.runTransaction(async tx=>{
   const [stock,held,biz]=await Promise.all([tx.get(inventory),tx.get(reservation),tx.get(business)]);
   if(!biz.exists || biz.data().ownerUid!==uid) throw new Error("Business ownership required");
   if(biz.data().stripeSubscriptionId || biz.data().checkoutSessionId)
     throw new Error("Existing checkout or subscription");
   const current=held.exists?held.data():null;
   if(current?.status==="confirmed") return {status:"confirmed",slot:current.slot};
   if(current?.status==="reserved" && current.expiresAt>nowSeconds)
     return {status:"reserved",slot:current.slot,expiresAt:current.expiresAt};
   // Do not reclaim an expired reservation without decrementing the counter.
   // Cleanup is deliberately separate to avoid inaccurate stock accounting.
   if(current?.status==="reserved") return {status:"expired_cleanup_required"};
   const confirmed=stock.exists?stock.data().confirmed:0;
   const reserved=stock.exists?stock.data().reserved:0;
   const decision=reserveDecision({confirmed,reserved});
   if(decision==="standard") return {status:"standard"};
   const slot=confirmed+reserved+1;
   if(slot>FOUNDING_CAP) throw new Error("Founding inventory exhausted");
   tx.set(inventory,{confirmed,reserved:reserved+1},{merge:true});
   tx.set(reservation,{uid,status:"reserved",slot,expiresAt:nowSeconds+holdSeconds});
   return {status:"reserved",slot,expiresAt:nowSeconds+holdSeconds};
 });
}
