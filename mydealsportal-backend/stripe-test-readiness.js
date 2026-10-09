// Read-only Stripe test-mode readiness probe. No Checkout sessions, coupons,
// schedules, customers, invoices, or payments are created or modified.
// Run with MYDEALSPORTAL_STRIPE_TEST_KEY=sk_test_... npm run stripe:test:readiness
import Stripe from "stripe";
import {planFromKey} from "./billing-policy.js";
const key=process.env.MYDEALSPORTAL_STRIPE_TEST_KEY;
if(!key?.startsWith("sk_test_")){
 console.error("A Stripe sk_test_ key is required; live keys are forbidden.");
 process.exitCode=1;
}else{
 try{
  const stripe=new Stripe(key);
  const account=await stripe.accounts.retrieve();
  if(!account?.id?.startsWith("acct_"))throw Error("Account identity not returned");
  console.log("Stripe test API authenticated. Account:",account.id);
  for(const planKey of ["founding","standard"]){
   const plan=planFromKey(planKey);
   const price=await stripe.prices.retrieve(plan.priceId);
   if(price.livemode!==false)throw Error("LIVE Stripe price: "+planKey);
   if(price.active!==true || price.type!=="recurring" ||
      price.recurring?.interval!=="month" || price.unit_amount!==(planKey==="founding"?4499:4999))
     throw Error("Test-mode price mismatch: "+planKey);
   console.log(planKey,"test price verified:",price.id);
  }
  console.log("Readiness passed; NO Stripe objects were created or charged.");
 }catch(e){
  console.error("Stripe test readiness failed:",e.message);
  console.error("Live price IDs cannot be used with a test key. Configure isolated test prices.");
  process.exitCode=1;
 }
}
