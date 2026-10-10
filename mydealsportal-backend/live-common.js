import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
if (!getApps().length) initializeApp();
export const liveKey = defineSecret("STRIPE_SECRET_KEY");
export const webhookKey = defineSecret("STRIPE_WEBHOOK_SECRET");
export function stripe() {
  const key = liveKey.value();
  if (!key?.startsWith("sk_live_")) throw Error("Live key required");
  return new Stripe(key);
}
export const businessDoc = uid => getFirestore().collection("businesses").doc(uid);
export async function signedIn(req) {
  const token = (req.get("authorization") || "").match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Error("Authentication required");
  return getAuth().verifyIdToken(token, true);
}
export function allowOrigin(req, res) {
  const origin = req.get("origin");
  if (origin && origin !== "https://curiositydrop.github.io") {
    res.status(403).end();
    return false;
  }
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  return true;
}
