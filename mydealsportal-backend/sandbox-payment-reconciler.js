// Test-mode-only Stripe -> Firebase entitlement reconciler.
// Retrieves authoritative Stripe state. Never accepts checkout redirect or
// browser flags as proof; never accepts live Stripe objects.
import {reconcileVerifiedSubscription} from "./stripe-reconciliation.js";
import {recordBillingReconciliation} from "./billing-firestore.js";
const TEST_PRICES={founding:"price_1UOpZeIHJWXNHkKxQP3tbT6i",standard:"price_1UOpZgIHJWXNHkKxIi1crSCn"};
export async function reconcileSandboxPayment({stripe,db,FieldValue,subscriptionId,eventId,nowSeconds}){
 if(!stripe?.subscriptions?.retrieve || !stripe?.invoices?.list || !db?.collection ||
    !/^sub_[A-Za-z0-9]+$/.test(subscriptionId||"") ||
    !Number.isSafeInteger(nowSeconds))
   throw new Error("Sandbox verification context required");
 const sub=await stripe.subscriptions.retrieve(subscriptionId);
 const plan=sub.metadata?.plan,uid=sub.metadata?.firebaseUid;
 if(sub.livemode!==false || sub.id!==subscriptionId || sub.metadata?.project!=="mydealsportal" ||
    sub.metadata?.environment!=="test" || !Object.hasOwn(TEST_PRICES,plan) ||
    !uid || sub.items?.data?.length!==1 ||
    sub.items.data[0].price?.id!==TEST_PRICES[plan] || sub.items.data[0].quantity!==1)
   throw new Error("Untrusted sandbox subscription");
 const customer=typeof sub.customer==="string"?sub.customer:sub.customer?.id;
 if(!/^cus_[A-Za-z0-9]+$/.test(customer||""))throw new Error("Untrusted customer");
 const snap=await db.collection("businesses").doc(uid).get();
 if(!snap.exists || snap.data().ownerUid!==uid ||
    snap.data().checkoutPlan!==plan ||
    snap.data().stripeCustomerId!==customer ||
    (snap.data().stripeSubscriptionId && snap.data().stripeSubscriptionId!==sub.id))
   throw new Error("No matched test business checkout");
 const history=await stripe.invoices.list({subscription:sub.id,limit:100});
 if(!history.data?.length || history.has_more)throw new Error("Incomplete test invoice history");
 const initial=history.data.filter(x=>x.billing_reason==="subscription_create").sort((a,b)=>a.created-b.created)[0];
 const latest=[...history.data].sort((a,b)=>b.created-a.created)[0];
 if(!initial)throw new Error("Test initial invoice missing");
 const state=reconcileVerifiedSubscription({
    subscription:sub,firstInvoice:initial,latestInvoice:latest,
    businessSuspended:snap.data().suspended===true || snap.data().billingSuspended===true,nowSeconds
 });
 // This test-only bridge refuses to grant access without a paid first invoice.
 // Refund/dispute resolution MUST be wired before enabling automatic access.
 if(state.publishingEnabled)throw new Error("Test activation requires refund/dispute verification before enabling");
 return recordBillingReconciliation({db,FieldValue,uid,eventId,state});
}
