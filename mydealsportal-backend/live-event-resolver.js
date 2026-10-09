// Resolve signed, live-mode Stripe webhook events to a subscription ID.
// Event payloads are hints, not authority: payment reconciliation retrieves
// the subscription and invoices from Stripe again before any entitlement write.
export async function resolveLiveEventSubscription({stripe,event}) {
 if(event?.livemode!==true || !event.data?.object || !stripe?.checkout?.sessions?.retrieve)
   throw new Error("Verified live Stripe event and client required");
 const type=event.type, object=event.data.object;
 let id=null;
 if(type.startsWith("customer.subscription.")) id=object.id;
 else if(type.startsWith("invoice.")){
   const v=object.parent?.subscription_details?.subscription ?? object.subscription;
   id=typeof v==="string"?v:v?.id;
 } else if(type.startsWith("checkout.session.")){
   // The server-fetched session must match the signed event and be live.
   const session=await stripe.checkout.sessions.retrieve(object.id);
   if(session?.id!==object.id || session.livemode!==true)
     throw new Error("Checkout session mismatch");
   const v=session.subscription;
   id=typeof v==="string"?v:v?.id;
 } else if(["charge.refunded","refund.created","refund.updated"].includes(type)) {
   // Refunds can't safely be mapped to one subscription using event contents
   // alone. Launch must implement verified payment -> invoice resolution.
   return {status:"manual_review",subscriptionId:null};
 } else return {status:"ignored",subscriptionId:null};
 if(typeof id!=="string" || !/^sub_[A-Za-z0-9]+$/.test(id))
   return {status:"unresolved",subscriptionId:null};
 return {status:"resolved",subscriptionId:id};
}
