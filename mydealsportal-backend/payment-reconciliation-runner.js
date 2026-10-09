// Server-only Stripe -> Firebase reconciliation. Not attached to production
// webhook until the complete billing lifecycle is reviewed and tested.
import {reconcileVerifiedSubscription} from "./stripe-reconciliation.js";
import {recordBillingReconciliation} from "./billing-firestore.js";

export async function reconcilePaymentEvent({stripe,db,FieldValue,eventId,subscriptionId,nowSeconds}) {
 if(!stripe?.subscriptions?.retrieve || !stripe?.invoices?.list ||
    !/^sub_[A-Za-z0-9]+$/.test(subscriptionId||"") ||
    !Number.isSafeInteger(nowSeconds)||nowSeconds<0)
   throw new Error("Verified Stripe subscription context required");
 const subscription=await stripe.subscriptions.retrieve(subscriptionId);
 if(subscription.id!==subscriptionId || subscription.livemode!==true ||
    subscription.metadata?.project!=="mydealsportal" ||
    !subscription.metadata?.firebaseUid)
   throw new Error("Verified live MyDealsPortal subscription required");
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
 const state=reconcileVerifiedSubscription({
   subscription,firstInvoice:initial,latestInvoice:latest,nowSeconds
 });
 return recordBillingReconciliation({
   db,FieldValue,uid:subscription.metadata.firebaseUid,eventId,state
 });
}
