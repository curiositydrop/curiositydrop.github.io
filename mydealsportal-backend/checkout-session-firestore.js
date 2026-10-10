// Atomically attach a server-created Stripe checkout session to its owner.
// This is a helper, not yet called by a production checkout endpoint.
// For founding plans a reserved, unexpired hold must still exist.
// A crash between Stripe session creation and this commit needs reconciliation.
export async function recordCheckoutSession({db,uid,sessionId,planKey,customerId,nowSeconds}) {
 if(!db?.runTransaction || typeof uid!=="string" || !uid.trim() ||
   !/^cs_[A-Za-z0-9_]+$/.test(sessionId||"") ||
   !["founding","standard"].includes(planKey) ||
   typeof customerId!=="string" || !/^cus_[A-Za-z0-9_]+$/.test(customerId) ||
   !Number.isSafeInteger(nowSeconds) || nowSeconds<0)
   throw new Error("Invalid checkout context");
 const bizRef=db.collection("businesses").doc(uid);
 const holdRef=db.collection("foundingReservations").doc(uid);
 return db.runTransaction(async tx=>{
   const [biz,hold]=await Promise.all([tx.get(bizRef),tx.get(holdRef)]);
   if(!biz.exists || biz.data().ownerUid!==uid) throw new Error("Business ownership mismatch");
   const data=biz.data();
   if((data.stripeCustomerId && data.stripeCustomerId!==customerId) ||
      data.stripeSubscriptionId || data.checkoutSessionId ||
      ["active","pending","incomplete","past_due","trialing"].includes(data.subscriptionStatus))
     throw new Error("Checkout or subscription already exists");
   if(planKey==="founding"){
     const r=hold.exists?hold.data():null;
     if(!r || r.uid!==uid || r.status!=="reserved" ||
        !Number.isSafeInteger(r.slot) || r.slot<1 || r.slot>100 ||
        !Number.isSafeInteger(r.expiresAt) || r.expiresAt<=nowSeconds)
       throw new Error("Valid founding hold required");
   }
   tx.update(bizRef,{
     stripeCustomerId:customerId,
     checkoutSessionId:sessionId,
     checkoutPlan:planKey,
     checkoutStartedAt:nowSeconds,
     subscriptionStatus:"pending"
   });
   return {status:"recorded",sessionId};
 });
}
