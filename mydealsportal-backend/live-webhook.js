import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { liveKey, webhookKey, stripe } from "./live-common.js";
import { activateAfterPayment, syncSubscription } from "./live-activation.js";
export const liveStripeWebhook=onRequest({region:"us-central1",secrets:[liveKey,webhookKey]},async(req,res)=>{
  if(req.method!=="POST"){res.status(405).end();return;}
  const api=stripe();let event;
  try {event=api.webhooks.constructEvent(req.rawBody,req.get("stripe-signature"),webhookKey.value());}
  catch(e){res.status(400).send("Signature rejected");return;}
  if(!event.livemode){res.status(400).send("Live only");return;}
  try {
    const ref=getFirestore().collection("stripeEvents").doc(event.id);
    if((await ref.get()).exists){res.status(200).send("Already processed");return;}
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded")
      await activateAfterPayment(api,event.data.object);
    if(event.type.startsWith("customer.subscription."))
      await syncSubscription(event.data.object);
    await ref.create({type:event.type,processedAt:FieldValue.serverTimestamp()})
      .catch(e=>{if(e.code!==6&&e.code!=="already-exists")throw e;});
    res.status(200).send("OK");
  }catch(e){console.error("Webhook",e);res.status(500).send("Retry");}
});
