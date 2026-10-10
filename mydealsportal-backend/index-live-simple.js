// Minimal LIVE Payment Link webhook. Kept separate from sandbox checkout.
import {getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import Stripe from "stripe";
if(!getApps().length) initializeApp();
const db=getFirestore();
const secret=defineSecret("MYDEALSPORTAL_STRIPE_LIVE_SECRET_KEY");
const signing=defineSecret("MYDEALSPORTAL_STRIPE_LIVE_WEBHOOK_SECRET");
const LINKS={
  plink_1UP2LQIHJWXNHkKxbd4a9YGN:{plan:"founding",amount:4499,price:"price_1UOVlFIHJWXNHkKxKgfNFoRy"},
  plink_1UP2MVIHJWXNHkKxlNCssSRN:{plan:"standard",amount:4999,price:"price_1UOVlJIHJWXNHkKxDCIpogsu"}
};
const stripe=()=>{const key=secret.value();if(!key.startsWith("sk_live_"))throw Error("Live Stripe key required");return new Stripe(key);};
async function publish(uid,enabled){
  // Changes to advertising are always server-owned, never editable by a customer.
  const ref=db.collection("businesses").doc(uid);
  const business=await ref.get();
  if(!business.exists)return;
  await ref.update({status:enabled?"active":"draft",subscriptionStatus:enabled?"active":"inactive",publishingEnabled:enabled,updatedAt:FieldValue.serverTimestamp()});
  let q=db.collection("deals").where("ownerUid","==",uid),last=null;
  for(;;){
    let page=q.orderBy(FieldValue.documentId()).limit(300);
    if(last)page=page.startAfter(last);
    const result=await page.get();
    if(result.empty)break;
    const batch=db.batch();
    for(const doc of result.docs)batch.update(doc.ref,{publishingApproved:enabled});
    await batch.commit();
    last=result.docs[result.docs.length-1];
    if(result.size<300)break;
  }
}
async function paidCheckout(session){
  if(session.livemode!==true || session.payment_status!=="paid" || session.mode!=="subscription")return;
  const plan=LINKS[session.payment_link]; if(!plan)return;
  const uid=session.client_reference_id;
  if(typeof uid!=="string" || !/^[A-Za-z0-9_-]{15,128}$/.test(uid))return;
  const user=await getAuth().getUser(uid);
  if(!user.emailVerified || !user.email || user.email.toLowerCase()!==(session.customer_details?.email||"").toLowerCase())return;
  const ref=db.collection("businesses").doc(uid),snap=await ref.get();
  if(!snap.exists || snap.data().ownerUid!==uid)return;
  if(snap.data().stripeSubscriptionId && snap.data().stripeSubscriptionId!==session.subscription)return;
  const sub=await stripe().subscriptions.retrieve(session.subscription);
  if(sub.livemode!==true || sub.customer!==session.customer || sub.items.data.length!==1 || sub.items.data[0].price.id!==plan.price)return;
  const items=await stripe().checkout.sessions.listLineItems(session.id,{limit:10});
  if(items.has_more || !items.data.some(i=>i.price?.type==="one_time" && i.amount_total===plan.amount))return;
  if(!["trialing","active"].includes(sub.status))return;
  await ref.update({stripeCustomerId:session.customer,stripeSubscriptionId:sub.id,checkoutPlan:plan.plan,subscriptionStatus:"active",updatedAt:FieldValue.serverTimestamp()});
  await publish(uid,true);
}
async function subscriptionChange(sub){
  if(sub.livemode!==true)return;
  const snap=await db.collection("businesses").where("stripeSubscriptionId","==",sub.id).limit(2).get();
  if(snap.size!==1)return;
  const biz=snap.docs[0];
  if(biz.data().stripeCustomerId!==sub.customer)return;
  const active=["active","trialing"].includes(sub.status);
  await publish(biz.id,active);
}
export const myDealsLiveStripeWebhook=onRequest({region:"us-central1",secrets:[secret,signing],invoker:"public"},async(req,res)=>{
  if(req.method!=="POST"){res.status(405).end();return;}
  let event;
  try{event=stripe().webhooks.constructEvent(req.rawBody,req.get("stripe-signature"),signing.value());}
  catch{res.status(400).send("Invalid signature");return;}
  try{
    if(event.livemode!==true){res.status(400).send("Test events not accepted");return;}
    if(event.type==="checkout.session.completed")await paidCheckout(event.data.object);
    if(["customer.subscription.updated","customer.subscription.deleted"].includes(event.type))await subscriptionChange(event.data.object);
    res.status(200).json({received:true});
  }catch(err){console.error("Stripe live webhook processing failed",event.id,err);res.status(500).send("Retry");}
});
