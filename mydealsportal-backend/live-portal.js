import {onRequest} from "firebase-functions/v2/https";
import {liveKey,stripe,signedIn,businessDoc,allowOrigin} from "./live-common.js";
export const liveBillingPortal=onRequest({region:"us-central1",secrets:[liveKey]},async(req,res)=>{
 if(!allowOrigin(req,res))return;
 if(req.method!=="POST"){res.status(405).end();return;}
 try {
  const user=await signedIn(req);
  const biz=(await businessDoc(user.uid).get()).data();
  if(!biz||biz.ownerUid!==user.uid||!biz.stripeCustomerId)throw Error("No customer");
  const portal=await stripe().billingPortal.sessions.create({
   customer:biz.stripeCustomerId,
   return_url:"https://curiositydrop.github.io/mydealsportal-preview/dashboard.html"
  });
  res.json({url:portal.url});
 }catch(e){console.error("Billing portal",e);res.status(400).json({error:"Billing portal unavailable"});}
});
