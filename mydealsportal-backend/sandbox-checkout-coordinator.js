// TEST-MODE ONLY. Caller must verify Firebase Auth.
export const STANDARD_TEST_PRICE = "price_1UOpZgIHJWXNHkKxIi1crSCn";
export function eligibleSandboxBusiness(business, uid) {
 return business?.ownerUid === uid && business.status === "draft" &&
  business.subscriptionStatus === "unpaid" && !business.checkoutSessionId &&
  !business.stripeSubscriptionId;
}
export async function prepareSandboxCheckout({stripe,db,uid,email,business,origin,nowSeconds}) {
 if (!stripe?.checkout?.sessions?.create || !stripe?.checkout?.sessions?.expire ||
     !stripe?.customers?.create || !db?.runTransaction ||
     !eligibleSandboxBusiness(business,uid) || !email ||
     !Number.isSafeInteger(nowSeconds) || !/^https:\/\//.test(origin))
   throw Error("Valid test checkout context required");
 const customerId=business.stripeCustomerId || (await stripe.customers.create({
   email,name:String(business.name||"").slice(0,200),
   metadata:{project:"mydealsportal",firebaseUid:uid,environment:"test"}
 },{idempotencyKey:"mdp-test-customer-"+uid})).id;
 if(!/^cus_[A-Za-z0-9]+$/.test(customerId||""))throw Error("Invalid customer");
 const session=await stripe.checkout.sessions.create({
   mode:"subscription",customer:customerId,
   line_items:[{price:STANDARD_TEST_PRICE,quantity:1}],
   client_reference_id:uid,
   metadata:{project:"mydealsportal",environment:"test",firebaseUid:uid,plan:"standard"},
   subscription_data:{metadata:{project:"mydealsportal",environment:"test",firebaseUid:uid,plan:"standard"}},
   success_url:origin+"/mydealsportal-preview/dashboard.html?checkout=success",
   cancel_url:origin+"/mydealsportal-preview/dashboard.html?checkout=cancel"
 },{idempotencyKey:"mdp-standard-checkout-"+uid});
 try{
   await db.runTransaction(async tx=>{
     const ref=db.collection("businesses").doc(uid),snap=await tx.get(ref);
     if(!snap.exists || !eligibleSandboxBusiness(snap.data(),uid) ||
       (snap.data().stripeCustomerId && snap.data().stripeCustomerId!==customerId))
       throw Error("Checkout registration conflict");
     tx.update(ref,{stripeCustomerId:customerId,checkoutSessionId:session.id,
       checkoutPlan:"standard",checkoutStartedAt:nowSeconds,subscriptionStatus:"pending"});
   });
 }catch(error){
   try{await stripe.checkout.sessions.expire(session.id)}catch(expiryError){
     throw new AggregateError([error,expiryError],"Checkout expiry requires manual review");
   }
   throw error;
 }
 return {sessionId:session.id,url:session.url};
}
