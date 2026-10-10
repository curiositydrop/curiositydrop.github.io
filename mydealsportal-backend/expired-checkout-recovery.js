// Server-only expired checkout recovery. Never trusts browser state.
// Safe only after reading the canonical Checkout Session from Stripe.
export async function releaseExpiredCheckout({stripe,db,uid,sessionId}) {
 if(!stripe?.checkout?.sessions?.retrieve || !db?.runTransaction ||
    typeof uid!=="string" || !uid.trim() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId||""))
   throw new Error("Verified recovery context required");
 const session=await stripe.checkout.sessions.retrieve(sessionId);
 if(session?.id!==sessionId || session.status!=="expired" ||
    session.payment_status==="paid" || session.subscription ||
    session.metadata?.firebaseUid!==uid ||
    session.metadata?.project!=="mydealsportal" ||
    !["founding","standard"].includes(session.metadata?.plan))
   throw new Error("Stripe has not verified an expired unpaid checkout for this owner");
 const customer=typeof session.customer==="string"?session.customer:session.customer?.id;
 if(!customer || !/^cus_[A-Za-z0-9_]+$/.test(customer))
   throw new Error("Stripe checkout customer missing");
 const ref=db.collection("businesses").doc(uid);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists || snap.data().ownerUid!==uid)
    throw new Error("Business ownership mismatch");
  const data=snap.data();
  if(data.checkoutSessionId!==sessionId)return {status:"superseded"};
  if(data.stripeSubscriptionId || data.stripeCustomerId!==customer ||
     data.checkoutPlan!==session.metadata.plan)
    throw new Error("Business billing state changed; review required");
  // This does NOT change founding reservations or paid entitlements.
  tx.update(ref,{checkoutSessionId:null,checkoutPlan:null,
   subscriptionStatus:"checkout_expired",publishingEnabled:false});
  return {status:"released"};
 });
}
