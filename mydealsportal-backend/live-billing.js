import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

// Production-only handlers. Never accept sandbox keys or test events.
const key=defineSecret("MDP_LIVE_STRIPE_SECRET_KEY");
const signing=defineSecret("MDP_LIVE_STRIPE_WEBHOOK_SECRET");
if(!getApps().length) initializeApp();
const db=getFirestore();
const ORIGIN="https://curiositydrop.github.io";
const PRICES={founder:"price_1UOVlFIHJWXNHkKxKgfNFoRy",standard:"price_1UOVlJIHJWXNHkKxDCIpogsu"};
const AMOUNTS={founder:4499,standard:4999};
const slots=db.collection("mdpBilling").doc("founderReservations");
function stripe(){
  const v=key.value();
  if(!v?.startsWith("sk_live_"))throw Error("Live Stripe secret not configured");
  return new Stripe(v);
}
function response(res,status,data){res.status(status).set("Cache-Control","no-store").json(data);}
function allow(req,res){
  const origin=req.get("origin");
  if(origin&&origin!==ORIGIN){response(res,403,{error:"Origin not allowed"});return false;}
  if(origin)res.set("Access-Control-Allow-Origin",origin).set("Vary","Origin");
  res.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods","POST, OPTIONS");
  return true;
}
function monthsFromNow(months){
  const d=new Date();const day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
  const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,monthEnd));
  return Math.floor(d.getTime()/1000);
}
async function reserveFounder(uid){
  return db.runTransaction(async tx=>{
    const doc=await tx.get(slots),all=doc.exists?(doc.data().members||{}):{};
    const now=Date.now(),valid={};
    for(const [id,r] of Object.entries(all)){
      if(r.committed||r.expires>now)valid[id]=r;
    }
    if(!valid[uid]&&Object.keys(valid).length>=100)return "standard";
    valid[uid]=valid[uid]||{expires:now+35*60*1000,committed:false};
    tx.set(slots,{members:valid,updatedAt:FieldValue.serverTimestamp()});
    return "founder";
  });
}
async function releaseReservation(uid){
  await db.runTransaction(async tx=>{
    const s=await tx.get(slots);if(!s.exists)return;
    const data=s.data().members||{};
    if(!data[uid]||data[uid].committed)return;
    delete data[uid];tx.update(slots,{members:data});
  });
}
async function commitReservation(uid){
  await db.runTransaction(async tx=>{
    const s=await tx.get(slots);if(!s.exists)return;
    const data=s.data().members||{};
    if(!data[uid])return;
    data[uid]={committed:true,expires:0};
    tx.update(slots,{members:data});
  });
}

export const liveCheckout=onRequest({region:"us-central1",secrets:[key]},async(req,res)=>{
  if(!allow(req,res))return;
  if(req.method==="OPTIONS"){res.status(204).end();return;}
  if(req.method!=="POST"){response(res,405,{error:"POST only"});return;}
  let uid=null,plan=null;
  try{
    const match=(req.get("Authorization")||"").match(/^Bearer (.+)$/);
    if(!match){response(res,401,{error:"Sign in first"});return;}
    const user=await getAuth().verifyIdToken(match[1],true);uid=user.uid;
    const ref=db.collection("businesses").doc(uid),snap=await ref.get();
    if(!snap.exists||snap.data().ownerUid!==uid){response(res,403,{error:"Business required"});return;}
    const biz=snap.data();
    if(["active","trialing"].includes(biz.subscriptionStatus)||biz.stripeSubscriptionId){
      response(res,409,{error:"Subscription already exists"});return;
    }
    if(biz.stripeCustomerId&&!biz.stripeCustomerId.startsWith("cus_")){
      response(res,409,{error:"Invalid customer account"});return;
    }
    const api=stripe();
    plan=await reserveFounder(uid);
    // First calendar month is paid immediately as a one-time Checkout line item.
    // Recurring charges begin at month 4 (founder) or month 3 (standard).
    // Thus founder months 2-3 and standard month 2 are free.
    let customerId=biz.stripeLiveCustomerId;
    if(!customerId){
      const customer=await api.customers.create({email:user.email,name:biz.name,metadata:{firebaseUid:uid,project:"mydealsportal"}},{idempotencyKey:"mdp-live-customer-"+uid});
      customerId=customer.id;
      await ref.update({stripeLiveCustomerId:customerId});
    }
    const session=await api.checkout.sessions.create({
      mode:"subscription",customer:customerId,
      payment_method_collection:"always",
      line_items:[
        {price:PRICES[plan],quantity:1},
        {price_data:{currency:"usd",unit_amount:AMOUNTS[plan],product_data:{name:"MyDealsPortal first month — "+(plan==="founder"?"Founding 100":"Standard")}},quantity:1}
      ],
      subscription_data:{
        trial_end:monthsFromNow(plan==="founder"?3:2),
        trial_settings:{end_behavior:{missing_payment_method:"cancel"}},
        metadata:{firebaseUid:uid,plan,project:"mydealsportal"}
      },
      client_reference_id:uid,
      metadata:{firebaseUid:uid,plan},
      success_url:ORIGIN+"/mydealsportal-preview/dashboard.html?checkout=success",
      cancel_url:ORIGIN+"/mydealsportal-preview/dashboard.html?checkout=cancel",
      expires_at:Math.floor(Date.now()/1000)+30*60
    },{idempotencyKey:"mdp-live-checkout-"+uid+"-"+Math.floor(Date.now()/(30*60*1000))});
    response(res,200,{url:session.url,plan});
  }catch(e){
    console.error("liveCheckout",e);
    if(uid&&plan==="founder")await releaseReservation(uid).catch(console.error);
    response(res,500,{error:"Could not start secure checkout. Please try again."});
  }
});

export const liveStripeWebhook=onRequest({region:"us-central1",secrets:[key,signing]},async(req,res)=>{
  if(req.method!=="POST"){res.status(405).end();return;}
  let event;
  try{event=stripe().webhooks.constructEvent(req.rawBody,req.get("stripe-signature"),signing.value());}
  catch(e){console.warn("Invalid webhook",e.message);res.status(400).send("Invalid signature");return;}
  if(!event.livemode){res.status(400).send("Test events rejected");return;}
  try{
    const obj=event.data.object,api=stripe();
    if(event.type==="checkout.session.expired"){
      if(obj.metadata?.plan==="founder"&&obj.metadata.firebaseUid)await releaseReservation(obj.metadata.firebaseUid);
    }
    if(event.type==="checkout.session.completed"&&obj.payment_status==="paid"){
      const uid=obj.metadata?.firebaseUid;
      if(uid){
        const sub=await api.subscriptions.retrieve(obj.subscription);
        if(sub.metadata.firebaseUid!==uid)throw Error("Subscription owner mismatch");
        const ref=db.collection("businesses").doc(uid),snap=await ref.get();
        if(!snap.exists||snap.data().ownerUid!==uid)throw Error("Business missing");
        const updates={stripeLiveCustomerId:obj.customer,stripeSubscriptionId:sub.id,
          subscriptionStatus:sub.status,plan:sub.metadata.plan,status:"active",updatedAt:FieldValue.serverTimestamp()};
        await ref.update(updates);
        if(sub.metadata.plan==="founder")await commitReservation(uid);
        const drafts=await db.collection("deals").where("ownerUid","==",uid).get();
        for(let i=0;i<drafts.docs.length;i+=400){
          const batch=db.batch();drafts.docs.slice(i,i+400).forEach(d=>batch.update(d.ref,{publishingApproved:true}));
          await batch.commit();
        }
      }
    }
    if(["customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
      const uid=obj.metadata?.firebaseUid;
      if(uid){
        const ref=db.collection("businesses").doc(uid),snap=await ref.get();
        if(snap.exists&&snap.data().stripeSubscriptionId===obj.id){
          const enabled=["active","trialing"].includes(obj.status);
          await ref.update({subscriptionStatus:obj.status,status:enabled?"active":"draft",updatedAt:FieldValue.serverTimestamp()});
          if(enabled){
            const deals=await db.collection("deals").where("ownerUid","==",uid).get();
            for(let i=0;i<deals.docs.length;i+=400){const batch=db.batch();deals.docs.slice(i,i+400).forEach(d=>batch.update(d.ref,{publishingApproved:true}));await batch.commit();}
          }
          if(!enabled){
            const deals=await db.collection("deals").where("ownerUid","==",uid).get();
            for(let i=0;i<deals.docs.length;i+=400){const batch=db.batch();deals.docs.slice(i,i+400).forEach(d=>batch.update(d.ref,{publishingApproved:false}));await batch.commit();}
          }
        }
      }
    }
    // Publishing entitlement on new deals is granted by a trusted server path only.
    // Client-side Firestore rules do not allow modification of publishingApproved.
    await db.collection("mdpStripeLiveEvents").doc(event.id).set({
      type:event.type,objectId:obj.id,receivedAt:FieldValue.serverTimestamp()
    },{merge:true});
    res.status(200).json({received:true});
  }catch(e){console.error("liveStripeWebhook",e);res.status(500).send("Webhook retry");}
});


export const approveNewPaidDeal=onDocumentCreated({document:"deals/{dealId}",region:"us-central1"},async event=>{
  const snap=event.data;if(!snap)return;
  const data=snap.data();
  if(!data?.ownerUid||data.publishingApproved!==false)return;
  const biz=await db.collection("businesses").doc(data.ownerUid).get();
  if(!biz.exists)return;
  const b=biz.data();
  if(b.ownerUid!==data.ownerUid||b.status!=="active"||!["active","trialing"].includes(b.subscriptionStatus)||!b.stripeSubscriptionId)return;
  await snap.ref.update({publishingApproved:true});
});
