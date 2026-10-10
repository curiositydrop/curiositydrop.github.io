// Server-side MyDealsPortal production pricing. Never trust a client price ID.
export const PLANS = Object.freeze({
  founding: Object.freeze({
    firstMonthPrice: "price_1UP2L5IHJWXNHkKxWInYRa84",
    recurringPrice: "price_1UOVlFIHJWXNHkKxKgfNFoRy",
    amountCents: 4499,
    firstRecurringMonth: 4
  }),
  standard: Object.freeze({
    firstMonthPrice: "price_1UP2MMIHJWXNHkKxvuZuVWQO",
    recurringPrice: "price_1UOVlJIHJWXNHkKxDCIpogsu",
    amountCents: 4999,
    firstRecurringMonth: 3
  })
});
export function billingPlan(plan) {
  if (!Object.hasOwn(PLANS,plan)) throw new Error("Unknown plan");
  return PLANS[plan];
}
// Advance calendar months, clamp month-end (Jan 31 -> Apr 30, for example).
export function advanceMonths(unixSeconds, count) {
  if (!Number.isInteger(unixSeconds)||!Number.isInteger(count)||count<0)
    throw new TypeError("Invalid billing date");
  const start=new Date(unixSeconds*1000);
  const target=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+count,1,
    start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds()));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(),last));
  return Math.floor(target.getTime()/1000);
}
export function nextChargeAt(firstPaidAt,plan) {
  return advanceMonths(firstPaidAt,billingPlan(plan).firstRecurringMonth-1);
}
