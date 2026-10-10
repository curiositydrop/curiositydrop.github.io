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
   // Slot numbers are identities, not occupancy counts. Released slots go
   // into an explicit free list; otherwise allocate a never-before-used number.
   const nextSlot=stock.exists?stock.data().nextSlot ?? 1:1;
   const freeSlots=stock.exists?stock.data().freeSlots ?? []:[];
   if(!Number.isSafeInteger(nextSlot) || nextSlot<1 || nextSlot>FOUNDING_CAP+1 ||
      !Array.isArray(freeSlots) || new Set(freeSlots).size!==freeSlots.length ||
      freeSlots.some(n=>!Number.isSafeInteger(n)||n<1||n>=nextSlot))
     throw new Error("Invalid slot inventory");
   const slot=freeSlots.length ? freeSlots[0] : nextSlot;
   if(slot>FOUNDING_CAP) return {status:"standard"};
   tx.set(inventory,{
     confirmed,reserved:reserved+1,
     nextSlot:freeSlots.length ? nextSlot : nextSlot+1,
     freeSlots:freeSlots.length ? freeSlots.slice(1) : []
   },{merge:true});
   tx.set(reservation,{uid,status:"reserved",slot,expiresAt:nowSeconds+holdSeconds});
   return {status:"reserved",slot,expiresAt:nowSeconds+holdSeconds};
 });
}
