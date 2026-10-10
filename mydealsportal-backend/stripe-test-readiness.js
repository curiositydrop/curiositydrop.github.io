// Read-only Stripe test-mode readiness probe. No Checkout sessions, coupons,
// schedules, customers, invoices, or payments are created or modified.
// Run with MYDEALSPORTAL_STRIPE_TEST_KEY=sk_test_... npm run stripe:test:readiness
import Stripe from "stripe";

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
   const envName=planKey==="founding"?"MYDEALSPORTAL_STRIPE_TEST_FOUNDING_PRICE":"MYDEALSPORTAL_STRIPE_TEST_STANDARD_PRICE";
   const priceId=process.env[envName];
   if(!priceId?.startsWith("price_"))throw Error("Missing isolated test price: "+envName);
   const price=await stripe.prices.retrieve(priceId);
   if(price.livemode!==false)throw Error("LIVE Stripe price: "+planKey);
   if(price.active!==true || price.type!=="recurring" ||
      price.recurring?.interval!=="month" || price.unit_amount!==(planKey==="founding"?4499:4999) ||
      price.currency!=="usd" || price.recurring?.interval_count!==1)
     throw Error("Test-mode price mismatch: "+planKey);
   console.log(planKey,"test price verified:",price.id);
  }
  const founding=process.env.MYDEALSPORTAL_STRIPE_TEST_FOUNDING_PRICE;
  const standard=process.env.MYDEALSPORTAL_STRIPE_TEST_STANDARD_PRICE;
  if(founding===standard)throw Error("Test plans cannot share a price ID");
  console.log("Readiness passed; NO Stripe objects were created or charged.");
 }catch(e){
  console.error("Stripe test readiness failed:",e.message);
  console.error("Live price IDs cannot be used with a test key. Configure isolated test prices.");
  process.exitCode=1;
 }
}
