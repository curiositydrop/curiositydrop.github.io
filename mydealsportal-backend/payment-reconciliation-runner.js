// Server-only Stripe -> Firebase reconciliation. Not attached to production
// webhook until the complete billing lifecycle is reviewed and tested.
import {reconcileVerifiedSubscription} from "./stripe-reconciliation.js";
import {recordBillingReconciliation} from "./billing-firestore.js";

export async function reconcilePaymentEvent({stripe,db,FieldValue,eventId,subscriptionId,nowSeconds}) {
 if(!db?.collection || !stripe?.subscriptions?.retrieve || !stripe?.invoices?.list || !stripe?.refunds?.list ||
    !/^sub_[A-Za-z0-9]+$/.test(subscriptionId||"") ||
    !Number.isSafeInteger(nowSeconds)||nowSeconds<0)
   throw new Error("Verified Stripe subscription context required");
 const subscription=await stripe.subscriptions.retrieve(subscriptionId);
 if(subscription.id!==subscriptionId || subscription.livemode!==true ||
    subscription.metadata?.project!=="mydealsportal" ||
    !subscription.metadata?.firebaseUid)
   throw new Error("Verified live MyDealsPortal subscription required");
 const uid=subscription.metadata.firebaseUid;
 const businessSnapshot=await db.collection("businesses").doc(uid).get();
 if(!businessSnapshot.exists || businessSnapshot.data().ownerUid!==uid)
   throw new Error("Verified business owner required");
 const business=businessSnapshot.data();
 const customer=typeof subscription.customer==="string"?subscription.customer:subscription.customer?.id;
 if(!customer || (business.stripeCustomerId && business.stripeCustomerId!==customer))
   throw new Error("Subscription customer mismatch");
 // An administrative hold cannot be overridden by a Stripe payment.
 const businessSuspended=business.billingSuspended===true || business.suspended===true;
 // Fail closed on incomplete invoice history; do not guess if the first
 // paid invoice is missing. Pagination is required before launch for accounts
 // with longer histories.
 const history=await stripe.invoices.list({subscription:subscriptionId,limit:100});
 if(!Array.isArray(history.data)||history.has_more || !history.data.length)
   throw new Error("Complete invoice history required");
 const invoices=history.data;
 const initial=invoices.filter(x=>x.billing_reason==="subscription_create")
   .sort((a,b)=>a.created-b.created)[0];
 if(!initial)throw new Error("Initial subscription invoice missing");
 const latest=[...invoices].sort((a,b)=>b.created-a.created)[0];
 // A refund of the initial charge must revoke the paid-first entitlement.\n // Partial refunds are conservatively treated as disputed until reviewed.\n const paymentIntent=typeof initial.payment_intent==="string" ? initial.payment_intent : initial.payment_intent?.id;\n if(!paymentIntent)throw new Error("Initial payment intent required for refund verification");\n const refunds=await stripe.refunds.list({payment_intent:paymentIntent,limit:100});\n if(!Array.isArray(refunds.data)||refunds.has_more)throw new Error("Refund history incomplete");\n const initialPaymentRefunded=refunds.data.some(r=>r.status!=="failed" && r.status!=="canceled");\n const state=reconcileVerifiedSubscription({
   subscription,firstInvoice:initial,latestInvoice:latest,businessSuspended:businessSuspended||initialPaymentRefunded,nowSeconds
 });
 return recordBillingReconciliation({
   db,FieldValue,uid:subscription.metadata.firebaseUid,eventId,state
 });
}
