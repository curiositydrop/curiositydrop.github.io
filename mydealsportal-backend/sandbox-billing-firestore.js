// Isolated test entitlement writes. NEVER toggles real publishingEnabled.
// Production billing uses a separate collection and reconciliation flow.
export async function recordSandboxBilling({db,FieldValue,uid,eventId,state}){
 if(!db?.runTransaction || !FieldValue?.serverTimestamp ||
   !/^evt_[A-Za-z0-9]+$/.test(eventId||"") ||
   !/^sub_[A-Za-z0-9]+$/.test(state?.stripeSubscriptionId||"") ||
   !/^cus_[A-Za-z0-9]+$/.test(state?.stripeCustomerId||"") ||
   typeof state.publishingEnabled!=="boolean")
  throw Error("Invalid verified sandbox entitlement");
 const ref=db.collection("businesses").doc(uid);
 const event=db.collection("stripeSandboxBillingEvents").doc(eventId);
 return db.runTransaction(async tx=>{
  const [biz,prior]=await Promise.all([tx.get(ref),tx.get(event)]);
  if(prior.exists)return "duplicate";
  if(!biz.exists || biz.data().ownerUid!==uid ||
    biz.data().stripeCustomerId!==state.stripeCustomerId ||
    (biz.data().sandboxSubscriptionId && biz.data().sandboxSubscriptionId!==state.stripeSubscriptionId))
    throw Error("Sandbox business ownership or customer mismatch");
  tx.update(ref,{
    sandboxSubscriptionId:state.stripeSubscriptionId,
    sandboxSubscriptionStatus:state.stripeStatus,
    sandboxInitialInvoicePaid:state.initialInvoicePaid,
    sandboxPublishingEnabled:state.publishingEnabled &&
      biz.data().suspended!==true && biz.data().billingSuspended!==true,
    sandboxBillingUpdatedAt:FieldValue.serverTimestamp()
  });
  tx.create(event,{uid,subscriptionId:state.stripeSubscriptionId,processedAt:FieldValue.serverTimestamp()});
  return "updated";
 });
}
