import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { classifyStripeEvent } from "./webhook-policy.js";
import { resolveSandboxSubscription } from "./sandbox-event-resolver.js";

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
    const stripe = stripeClient();
    const existingId = biz.data().stripeCustomerId;
    let customerId = existingId;
    if (!customerId) {
      const customer=await stripe.customers.create({
        email:decoded.email, name:biz.data().name,
        metadata:{firebaseUid:decoded.uid,project:"mydealsportal"}
      },{idempotencyKey:"mdp-test-customer-"+decoded.uid});
      customerId=customer.id;
      await ref.update({stripeCustomerId:customerId});
    }
    const session=await stripe.checkout.sessions.create({
      mode:"subscription",
      customer:customerId,
      line_items:[{price:"price_1UO4QpIqvlhcw8H0bCoRbJmF",quantity:1}],
      client_reference_id:decoded.uid,
      metadata:{firebaseUid:decoded.uid,sandboxOnly:"true"},
      subscription_data:{metadata:{firebaseUid:decoded.uid,sandboxOnly:"true"}},
      success_url:siteOrigin()+"/mydealsportal-preview/dashboard.html?checkout=success",
      cancel_url:siteOrigin()+"/mydealsportal-preview/dashboard.html?checkout=cancel"
    });
    send(res,200,{url:session.url});
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
    res.status(200).json({received:true});
  } catch(err) {
    console.error("Webhook storage",err);
    res.status(500).send("Retry");
  }
});
