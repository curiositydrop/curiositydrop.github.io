// Validate a promotional schedule before any Stripe mutation. The caller
// must retrieve the subscription and schedule from Stripe on the server.
import {buildPromotionPhases} from "./promotion-schedule.js";
export function preparePromotionSchedule({subscription,planKey,initialInvoicePaid,nowSeconds}) {
 if (!subscription || !/^sub_[A-Za-z0-9]+$/.test(subscription.id||"") ||
     subscription.status!=="active" || subscription.schedule ||
     !Number.isSafeInteger(nowSeconds) || nowSeconds<0 ||
     !Number.isSafeInteger(subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end) ||
     (subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end)<=nowSeconds)
  throw new Error("Subscription not eligible for schedule creation");
 const item=subscription.items?.data;
 if(!Array.isArray(item) || item.length!==1 || item[0].quantity!==1 ||
    typeof item[0].price?.id!=="string")
  throw new Error("Unexpected subscription items");
 if(subscription.metadata?.plan!==planKey)
  throw new Error("Subscription plan mismatch");
 return buildPromotionPhases({
   planKey,priceId:item[0].price.id,initialInvoicePaid,
   firstPeriodEnd:subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end
 });
}
