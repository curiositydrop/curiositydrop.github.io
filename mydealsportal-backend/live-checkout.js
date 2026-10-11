import { onRequest } from "firebase-functions/v2/https";
import { liveKey, stripe, signedIn, businessDoc, allowOrigin } from "./live-common.js";
import { billingPlan } from "./billing-policy.js";
import { chooseOffer } from "./live-activation.js";
export const liveCheckout = onRequest({region:"us-central1",secrets:[liveKey]},async(req,res)=>{
  if(!allowOrigin(req,res))return;
  if(req.method!=="POST"){res.status(405).end();return;}
  let stage="authentication";
  try {
    const user=await signedIn(req);
    if(!user.email_verified){res.status(403).json({error:"Please verify your business email address before checkout. Open your verification email, then sign out and back in."});return;}
    stage="business_lookup";
    const ref=businessDoc(user.uid),snap=await ref.get(),biz=snap.data();
    if(!biz||biz.ownerUid!==user.uid)throw Error("Business required");
    if(["active","trialing"].includes(biz.subscriptionStatus))throw Error("Already subscribed");
    stage="stripe_initialization";
    const api=stripe();
    stage="previous_checkout";
    if(biz.pendingCheckoutId){
      const prior=await api.checkout.sessions.retrieve(biz.pendingCheckoutId);
      if(prior.status==="open" && prior.url){res.json({url:prior.url});return;}
    }
    stage="offer_selection";
    const offer=await chooseOffer(user.uid);
    stage="stripe_customer";
    let customer=biz.stripeCustomerId;
    if(!customer){
      const newCustomer=await api.customers.create({email:user.email,name:biz.name},{idempotencyKey:"mdp-customer-"+user.uid});
      customer=newCustomer.id;
      await ref.update({stripeCustomerId:customer});
    }
    stage="stripe_checkout_session";
    const session=await api.checkout.sessions.create({
      mode:"payment",customer,
      line_items:[{price:billingPlan(offer.plan).firstMonthPrice,quantity:1}],
      payment_intent_data:{setup_future_usage:"off_session"},
      metadata:{uid:user.uid,plan:offer.plan,slot:offer.slot||""},
      success_url:"https://curiositydrop.github.io/mydealsportal-preview/dashboard.html?checkout=success",
      cancel_url:"https://curiositydrop.github.io/mydealsportal-preview/dashboard.html?checkout=cancel",
      expires_at:Math.floor(Date.now()/1000)+1800
    });
    stage="save_checkout";
    await ref.update({pendingCheckoutId:session.id});
    res.json({url:session.url});
  }catch(err){console.error("Checkout stage:",stage,err);res.status(400).json({error:"Checkout could not start ("+stage+"). Please contact support with this code."});}
});
