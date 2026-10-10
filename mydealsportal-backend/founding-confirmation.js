// Confirm only after the server fetches the initial paid invoice and Stripe subscription.
// Do not pass a browser checkout result or an unverified webhook payload.
export async function confirmFoundingPayment({db,uid,subscription,invoice,nowSeconds}) {
 if(!db?.runTransaction || typeof uid!=="string" || !uid ||
    !Number.isSafeInteger(nowSeconds) || nowSeconds<0 ||
    !subscription || !/^sub_[A-Za-z0-9]+$/.test(subscription.id||"") ||
    subscription.metadata?.firebaseUid!==uid || subscription.metadata?.plan!=="founding" ||
    !invoice || !/^in_[A-Za-z0-9]+$/.test(invoice.id||"") ||
    (invoice.parent?.subscription_details?.subscription ?? invoice.subscription)!==subscription.id || invoice.status!=="paid" ||
    !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid<4499)
   throw new Error("Verified first payment required");
 const stockRef=db.collection("billingInventory").doc("founding100");
 const heldRef=db.collection("foundingReservations").doc(uid);
 const bizRef=db.collection("businesses").doc(uid);
 return db.runTransaction(async tx=>{
   const [stock,held,biz]=await Promise.all([tx.get(stockRef),tx.get(heldRef),tx.get(bizRef)]);
   if(!biz.exists || biz.data().ownerUid!==uid) throw new Error("Ownership mismatch");
   const reservation=held.exists?held.data():null;
   if(!reservation || !Number.isSafeInteger(reservation.slot) ||
       reservation.slot<1 || reservation.slot>100) throw new Error("No founding reservation");
   if(reservation.status==="confirmed") {
     if(reservation.subscriptionId===subscription.id && reservation.invoiceId===invoice.id)
       return {status:"already_confirmed",slot:reservation.slot};
     throw new Error("Reservation already assigned to another payment");
   }
   if(reservation.status!=="reserved") throw new Error("Reservation not held");
   if(!Number.isSafeInteger(reservation.expiresAt) || reservation.expiresAt<=nowSeconds) return {status:"expired_requires_review"};
   const customer=typeof subscription.customer==="string"?subscription.customer:subscription.customer?.id;
   if(!customer || (biz.data().stripeCustomerId && biz.data().stripeCustomerId!==customer))
     throw new Error("Stripe customer mismatch");
   if(biz.data().stripeSubscriptionId && biz.data().stripeSubscriptionId!==subscription.id)
     throw new Error("Subscription mismatch");
   const counts=stock.exists?stock.data():null;
   const confirmed=counts?.confirmed,reserved=counts?.reserved;
   if(!Number.isSafeInteger(confirmed)||!Number.isSafeInteger(reserved)||
      confirmed<0||reserved<1||confirmed+reserved>100)
     throw new Error("Invalid inventory counts");
   tx.update(stockRef,{confirmed:confirmed+1,reserved:reserved-1});
   tx.update(heldRef,{status:"confirmed",subscriptionId:subscription.id,invoiceId:invoice.id,confirmedAt:nowSeconds});
   tx.update(bizRef,{foundingSlot:reservation.slot});
   return {status:"confirmed",slot:reservation.slot};
 });
}
