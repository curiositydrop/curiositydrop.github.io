// Server-only Stripe -> Firebase reconciliation. Not attached to production
// webhook until the complete billing lifecycle is reviewed and tested.
import {reconcileVerifiedSubscription} from "./stripe-reconciliation.js";
import {recordBillingReconciliation} from "./billing-firestore.js";
import {planFromKey} from "./billing-policy.js";

export async function reconcilePaymentEvent({stripe,db,FieldValue,eventId,subscriptionId,nowSeconds}) {
 if(!db?.collection || !stripe?.subscriptions?.retrieve || !stripe?.invoices?.list || !stripe?.invoices?.retrieve || !stripe?.refunds?.list ||
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
 if(!["founding","standard"].includes(subscription.metadata.plan) ||
    (business.checkoutPlan && business.checkoutPlan!==subscription.metadata.plan))
   throw new Error("Subscription plan mismatch");
 // Subscription metadata alone is not evidence the correct price was sold.
 const expectedPrice=planFromKey(subscription.metadata.plan).priceId;
 const items=subscription.items?.data;
 if(!Array.isArray(items) || items.length!==1 ||
    items[0].price?.id!==expectedPrice || items[0].quantity!==1)
   throw new Error("Subscription price mismatch");
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
 // An unpaid initial invoice has no settled payment to inspect. It must
 // reconcile as inactive, not throw and endlessly retry its webhook.
 if(initial.status!=="paid" || !Number.isSafeInteger(initial.amount_paid) ||
    initial.amount_paid<=0){
   const state=reconcileVerifiedSubscription({
     subscription,firstInvoice:initial,latestInvoice:latest,
     businessSuspended,nowSeconds
   });
   return recordBillingReconciliation({
     db,FieldValue,uid,eventId,state
   });
 }
 // A refund of the initial charge must revoke the paid-first entitlement.
 // Partial refunds are conservatively treated as disputed until reviewed.
 const paidInvoice=await stripe.invoices.retrieve(initial.id,{expand:["payments.data.payment.payment_intent"]});
 if(paidInvoice.id!==initial.id)throw new Error("Initial invoice retrieval mismatch");
 const paymentRecords=paidInvoice.payments?.data;
 if(!Array.isArray(paymentRecords) || paidInvoice.payments.has_more)
   throw new Error("Complete invoice payment records required");
 const settled=paymentRecords.filter(p=>p.status==="paid" || p.status==="succeeded");
 if(settled.length!==1)throw new Error("Single verified initial payment required");
 const payment=settled[0].payment;
 const rawIntent=payment?.payment_intent;
 const paymentIntent=typeof rawIntent==="string"?rawIntent:rawIntent?.id;
 if(!paymentIntent)throw new Error("Initial payment intent required for refund verification");
 const refunds=await stripe.refunds.list({payment_intent:paymentIntent,limit:100});
 if(!Array.isArray(refunds.data)||refunds.has_more)throw new Error("Refund history incomplete");
 const initialPaymentRefunded=refunds.data.some(r=>r.status!=="failed" && r.status!=="canceled");
 const state=reconcileVerifiedSubscription({
   subscription,firstInvoice:initial,latestInvoice:latest,businessSuspended:businessSuspended||initialPaymentRefunded,nowSeconds
 });
 return recordBillingReconciliation({
   db,FieldValue,uid:subscription.metadata.firebaseUid,eventId,state
 });
}
