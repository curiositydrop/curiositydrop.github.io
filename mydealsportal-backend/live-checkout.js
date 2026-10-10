import { onRequest } from "firebase-functions/v2/https";
import { liveKey, stripe, signedIn, businessDoc, allowOrigin } from "./live-common.js";
import { billingPlan } from "./billing-policy.js";
import { chooseOffer } from "./live-activation.js";
export const liveCheckout = onRequest({region:"us-central1",secrets:[liveKey]},async(req,res)=>{
  if(!allowOrigin(req,res))return;
  if(req.method!=="POST"){res.status(405).end();return;}
  try {
    const user=await signedIn(req);
    if(!user.email_verified)throw Error("Email verification required");
    const ref=businessDoc(user.uid),snap=await ref.get(),biz=snap.data();
    if(!biz||biz.ownerUid!==user.uid)throw Error("Business required");
    if(["active","trialing"].includes(biz.subscriptionStatus))throw Error("Already subscribed");
    const api=stripe();
    if(biz.pendingCheckoutId){
      const prior=await api.checkout.sessions.retrieve(biz.pendingCheckoutId);
      if(prior.status==="open" && prior.url){res.json({url:prior.url});return;}
    }
    const offer=await chooseOffer(user.uid);
    let customer=biz.stripeCustomerId;
    if(!customer){
      const newCustomer=await api.customers.create({email:user.email,name:biz.name},{idempotencyKey:"mdp-customer-"+user.uid});
      customer=newCustomer.id;
      await ref.update({stripeCustomerId:customer});
    }
    const session=await api.checkout.sessions.create({
      mode:"payment",customer,
      line_items:[{price:billingPlan(offer.plan).firstMonthPrice,quantity:1}],
      payment_intent_data:{setup_future_usage:"off_session"},
      metadata:{uid:user.uid,plan:offer.plan,slot:offer.slot||""},
      success_url:"https://curiositydrop.github.io/mydealsportal-preview/dashboard.html?checkout=success",
      cancel_url:"https://curiositydrop.github.io/mydealsportal-preview/dashboard.html?checkout=cancel",
      expires_at:Math.floor(Date.now()/1000)+1800
    });
    await ref.update({pendingCheckoutId:session.id});
    res.json({url:session.url});
  }catch(err){console.error("Checkout",err);res.status(400).json({error:"Checkout unavailable"});}
});
