// Transactionally release an expired Founding 100 reservation.
// Caller must establish that no payment is pending or successful at Stripe;
// expiry alone is NOT evidence that a paid checkout may be released.
export async function releaseExpiredFoundingHold({db,uid,nowSeconds,paymentCleared}) {
 if(!db?.runTransaction || typeof uid!=="string" || !uid ||
    !Number.isSafeInteger(nowSeconds) || nowSeconds<0 || paymentCleared!==true)
   throw new Error("Verified payment clearance required");
 const stockRef=db.collection("billingInventory").doc("founding100");
 const holdRef=db.collection("foundingReservations").doc(uid);
 return db.runTransaction(async tx=>{
   const [stock,hold]=await Promise.all([tx.get(stockRef),tx.get(holdRef)]);
   if(!hold.exists) return {status:"missing"};
   const entry=hold.data();
   if(entry.uid!==uid) throw new Error("Reservation owner mismatch");
   if(entry.status!=="reserved") return {status:"unchanged"};
   if(!Number.isSafeInteger(entry.expiresAt) || entry.expiresAt>nowSeconds)
     return {status:"not_expired"};
   if(!stock.exists || !Number.isSafeInteger(stock.data().reserved) ||
       stock.data().reserved<1) throw new Error("Inventory invalid");
   tx.update(stockRef,{reserved:stock.data().reserved-1});
   tx.update(holdRef,{status:"released",releasedAt:nowSeconds,releaseReason:"expired_payment_cleared"});
   return {status:"released"};
 });
}
