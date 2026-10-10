import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { classifyStripeEvent } from "./webhook-policy.js";
import { resolveSandboxSubscription } from "./sandbox-event-resolver.js";
import { prepareSandboxCheckout } from "./sandbox-checkout-coordinator.js";
import { ensureSandboxPromotion } from "./sandbox-promotion-reconciler.js";
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
      const matched=await db.collection("businesses").doc(resolution.uid).get();
      if(matched.exists && matched.data().sandboxPublishingEnabled===true){
        await ensureSandboxPromotion({
          stripe:stripeClient(),apiKey:stripeKey.value(),
          subscriptionId:resolution.subscriptionId,
          planKey:matched.data().checkoutPlan,
          nowSeconds:Math.floor(Date.now()/1000)
        });
      }
    }
    res.status(200).json({received:true});
  } catch(err) {
    console.error("Webhook storage",err);
    res.status(500).send("Retry");
  }
});



// Sandbox-only deployment entrypoint: production functions never exported.
