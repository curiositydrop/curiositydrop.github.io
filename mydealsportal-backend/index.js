import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { classifyStripeEvent } from "./webhook-policy.js";
import { resolveSandboxSubscription } from "./sandbox-event-resolver.js";
import { prepareSandboxCheckout } from "./sandbox-checkout-coordinator.js";
import { reconcileSandboxPayment } from "./sandbox-payment-reconciler.js";
import { verifyProductionEvent } from "./production-event-guard.js";
import { evaluateLiveCheckoutPreflight, prospectivePricing } from "./live-checkout-preflight.js";
import { prepareAndRecordCheckout } from "./checkout-coordinator.js";
import { reconcilePaymentEvent } from "./payment-reconciliation-runner.js";
import { resolveLiveEventSubscription } from "./live-event-resolver.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const stripeKey = defineSecret("STRIPE_SECRET_KEY");
const webhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// THIS IS SANDBOX STAGING CODE. Do not connect the public UI or use live keys yet.
// The test checkout does NOT grant publishing rights. Promotion schedules,
// founding-slot allocation, and subscription synchronization are still pending.

function stripeClient() {
  const key = stripeKey.value();
  if (!key?.startsWith("sk_test_")) {
    throw new Error("Sandbox functions require a Stripe TEST secret key");
  }
  return new Stripe(key);
}
function send(res, status, data) {
  res.status(status).set("Cache-Control", "no-store").json(data);
}
function siteOrigin() {
  return process.env.SITE_ORIGIN || "https://curiositydrop.github.io";
}
function sameOrigin(req, res) {
  const origin = req.get("origin");
  if (origin && origin !== siteOrigin()) {
    send(res, 403, {error:"Origin not allowed"});
    return false;
  }
  if (origin) res.set("Access-Control-Allow-Origin", origin).set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return true;
}
async function userFromRequest(req) {
  const token = (req.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Missing Firebase ID token");
  return getAuth().verifyIdToken(token, true);
}

// Explicitly test-only: checkout price is fixed to sandbox founding price,
// not a production-ready first-100 allocation mechanism.
export const sandboxCheckout = onRequest({region:"us-central1", secrets:[stripeKey]}, async (req,res) => {
  if (!sameOrigin(req,res)) return;
  if (req.method==="OPTIONS") {res.status(204).end();return;}
  if (req.method!=="POST") {send(res,405,{error:"POST only"});return;}
  try {
    const decoded = await userFromRequest(req);
    const ref = db.collection("businesses").doc(decoded.uid);
    const biz = await ref.get();
    if (!biz.exists || biz.data().ownerUid!==decoded.uid) {
      send(res,403,{error:"Business profile required"});return;
    }
    if(decoded.email_verified!==true)throw Error("Verified email required");
    const business=biz.data();
    const result=await prepareSandboxCheckout({
      stripe:stripeClient(),db,uid:decoded.uid,email:decoded.email,
      business,origin:siteOrigin(),nowSeconds:Math.floor(Date.now()/1000)
    });
    send(res,200,{url:result.url});
  } catch(err) {
    console.error("sandboxCheckout",err);
    send(res,400,{error:"Checkout could not be created"});
  }
});

export const stripeSandboxWebhook = onRequest({
  region:"us-central1",secrets:[stripeKey,webhookSecret]
},async(req,res)=>{
  if(req.method!=="POST") {res.status(405).end();return;}
  const signature=req.get("stripe-signature");
  let event;
  try {
    // Firebase Functions supplies req.rawBody for signature verification.
    event=stripeClient().webhooks.constructEvent(req.rawBody,signature,webhookSecret.value());
  } catch(err) {
    console.warn("Invalid Stripe signature",err.message);
    res.status(400).send("Invalid signature");return;
  }
  try {
    const classified = classifyStripeEvent(event, {expectedLiveMode:false});
    const resolution = classified.action === "reconcile"
      ? await resolveSandboxSubscription({stripe:stripeClient(),event})
      : {status:"ignored",subscriptionId:null};
    const eventRef=db.collection("stripeSandboxEvents").doc(classified.eventId);
    // Sandbox audit only. Reject live-mode events without recording them.
    if (event.livemode !== false) {
      res.status(403).send("Live Stripe events not accepted by sandbox webhook");
      return;
    }
    // No publication or entitlement changes yet.
    await eventRef.create({
      type:classified.type,
      livemode:event.livemode,
      objectId:classified.objectId,
      action:classified.action,
      stripeSubscriptionId:resolution.subscriptionId,
      resolutionStatus:resolution.status,
      businessUid:resolution.uid || null,
      receivedAt:FieldValue.serverTimestamp()
    }).catch(err=>{if(err.code!==6&&err.code!=="already-exists")throw err;});
    // The sandbox reconciler writes ONLY sandboxPublishingEnabled, never live
    // publishingEnabled. Remains disabled until signed webhook + Firestore
    // emulator tests and a registered business checkout are verified.
    const SANDBOX_ENTITLEMENT_WRITES_ENABLED = true;
    if(SANDBOX_ENTITLEMENT_WRITES_ENABLED &&
       classified.action === "reconcile" && resolution.status === "resolved"){
      await reconcileSandboxPayment({
        stripe:stripeClient(),db,FieldValue,
        subscriptionId:resolution.subscriptionId,eventId:classified.eventId,
        nowSeconds:Math.floor(Date.now()/1000)
      });
    }
    res.status(200).json({received:true});
  } catch(err) {
    console.error("Webhook storage",err);
    res.status(500).send("Retry");
  }
});


// Production webhook STAGING ONLY: no billing entitlement writes or checkout.
// This endpoint is intentionally isolated from sandbox credentials/collections.
const liveStripeKey = defineSecret("MYDEALSPORTAL_STRIPE_LIVE_KEY");
const liveWebhookSecret = defineSecret("MYDEALSPORTAL_STRIPE_LIVE_WEBHOOK_SECRET");
export const stripeLiveWebhook = onRequest({
  region: "us-central1",
  secrets: [liveStripeKey, liveWebhookSecret]
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("POST only");
    return;
  }
  let event;
  try {
    const key = liveStripeKey.value();
    const secret = liveWebhookSecret.value();
    if (!key?.startsWith("sk_live_") || !secret?.startsWith("whsec_"))
      throw new Error("Live Stripe configuration unavailable");
    const stripe = new Stripe(key);
    event = stripe.webhooks.constructEvent(req.rawBody, req.get("stripe-signature"), secret);
    verifyProductionEvent(event, "acct_1UNxa7IHJWXNHkKx");
    const classified = classifyStripeEvent(event, {expectedLiveMode:true});
    // Refunds without a verified subscription must remain visible for review,
    // never silently acknowledged as a successful entitlement reconciliation.
    const resolution = classified.action === "reconcile"
      ? await resolveLiveEventSubscription({stripe,event})
      : {status:"ignored",subscriptionId:null};
    const requiresManualReview=resolution.status==="manual_review" ||
      (classified.action==="reconcile" && resolution.status!=="resolved");
    if(requiresManualReview){
      await db.collection("stripeLiveReviewQueue").doc(classified.eventId).set({
        eventType:classified.type,
        objectId:classified.objectId,
        reason:resolution.status,
        receivedAt:FieldValue.serverTimestamp()
      },{merge:true});
    }
    // Durable, audit-only event recording. Do not grant advertising access.
    const audit = db.collection("stripeLiveAuditEvents").doc(classified.eventId);
    await audit.create({
      eventType: classified.type,
      objectId: classified.objectId,
      subscriptionId: classified.stripeSubscriptionId,
      action: classified.action,
      resolutionStatus:resolution.status,
      subscriptionIdResolved:resolution.subscriptionId,
      requiresManualReview,
      livemode: true,
      receivedAt: FieldValue.serverTimestamp()
    }).catch(err => {
      if (err.code !== 6 && err.code !== "already-exists") throw err;
    });
    // Deliberately disabled: reconciliation must be fully validated against
    // production Stripe invoice versions, dispute/refund behavior, and
    // Firestore permissions before allowing entitlement changes.
    const LIVE_ENTITLEMENT_WRITES_ENABLED = false;
    if (LIVE_ENTITLEMENT_WRITES_ENABLED && classified.action === "reconcile") {
      if(resolution.status!=="resolved")
        throw new Error("Event needs reviewed subscription resolution");
      const subscriptionId=resolution.subscriptionId;
      await reconcilePaymentEvent({
        stripe, db, FieldValue,
        eventId: classified.eventId, subscriptionId,
        nowSeconds: Math.floor(Date.now()/1000)
      });
    }
    res.status(200).json({received:true});
  } catch (err) {
    // Invalid signatures must not be accepted; storage failures should retry.
    const badSignature = err?.type === "StripeSignatureVerificationError";
    console.error("Production webhook failure", err?.message);
    res.status(badSignature ? 400 : 500).send(badSignature ? "Invalid signature" : "Retry");
  }
});


// Live checkout preflight. No Stripe session is created and no customer is
// charged. Read-only until reservation lifecycle / promotion scheduling are
// integrated and tested. Do not expose a production charging function yet.
export const liveCheckoutPreflight = onRequest({region:"us-central1"}, async(req,res)=>{
  if (!sameOrigin(req,res)) return;
  if (req.method==="OPTIONS"){res.status(204).end();return;}
  if (req.method!=="POST"){send(res,405,{error:"POST only"});return;}
  try {
    const auth = await userFromRequest(req);
    const business = await db.collection("businesses").doc(auth.uid).get();
    const result = evaluateLiveCheckoutPreflight({
      auth,
      business:business.exists ? business.data() : null
    });
    // Informational only: a real checkout must reserve the slot atomically.
    const inventory = await db.collection("billingInventory").doc("founding100").get();
    const stock = inventory.exists ? inventory.data() : {confirmed:0,reserved:0};
    const pricing = prospectivePricing({confirmed:stock.confirmed,reserved:stock.reserved});
    send(res,200,{...result,...pricing,message:"Price is indicative; live checkout is not enabled yet."});
  }catch(err){
    console.error("liveCheckoutPreflight",err);
    send(res,401,{error:"Authentication or eligibility could not be verified"});
  }
});


// INACTIVE production Checkout integration, standard plan only.
// This is a dry-wired path with a hardcoded off switch. Do not enable until
// Founding 100 inventory and customer creation lifecycle are audited.
// It never creates a session while disabled.
const LIVE_CHECKOUT_ENABLED = false;
export const liveCheckout = onRequest({
  region:"us-central1",secrets:[liveStripeKey]
},async(req,res)=>{
  if(req.method==="OPTIONS"){
    if(!sameOrigin(req,res))return;
    res.status(204).end();return;
  }
  if(req.method!=="POST"){send(res,405,{error:"POST only"});return;}
  if(!sameOrigin(req,res))return;
  if(!LIVE_CHECKOUT_ENABLED){
    send(res,503,{error:"Checkout is not yet available"});return;
  }
  // Second independent fail-closed guard: enabling the feature switch alone
  // cannot enable billing without a reviewed replacement of this block.
  send(res,503,{error:"Checkout activation requires completed billing review"});
  return;
  // Future integration draft (unreachable until reviewed):
  /*
  try{
    const auth=await userFromRequest(req);
    const ref=db.collection("businesses").doc(auth.uid);
    const snapshot=await ref.get();
    const business=snapshot.exists?snapshot.data():null;
    evaluateLiveCheckoutPreflight({auth,business});
    const key=liveStripeKey.value();
    if(!key?.startsWith("sk_live_"))throw new Error("Live secret unavailable");
    // A production launch must additionally implement customer creation,
    // atomic checkout locks, and Founding 100 allocation before this is on.
    const customerId=business?.stripeCustomerId;
    if(!customerId)throw new Error("Customer creation must be configured");
    const stripe=new Stripe(key);
    const result=await prepareAndRecordCheckout({
      stripe,db,uid:auth.uid,email:auth.email,emailVerified:auth.email_verified,
      business,customerId,planKey:"standard",origin:siteOrigin(),
      requestId:"checkout_"+auth.uid.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,60),
      nowSeconds:Math.floor(Date.now()/1000)
    });
    send(res,200,{url:result.url});
  }catch(err){
    console.error("Live checkout disabled integration",err);
    send(res,409,{error:"Checkout not available"});
  }
  */
});
