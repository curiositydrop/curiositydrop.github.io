// Server-only publication synchronization draft.
export function desiredPublication({paid, suspended}) {
  return paid === true && suspended !== true;
}

export async function synchronizeDeals(db,uid) {
  const business = await db.collection("businesses").doc(uid).get();
  if (!business.exists || business.data().ownerUid !== uid) throw Error("Owner mismatch");
  const info = business.data();
  const visible = desiredPublication({paid:info.publishingEnabled, suspended:info.suspended || info.billingSuspended});
  const deals = await db.collection("deals").where("ownerUid","==",uid).get();
  let updated = 0;
  for (let i=0;i<deals.docs.length;i+=400) {
    const batch = db.batch();
    for (const deal of deals.docs.slice(i,i+400)) {
      if (deal.data().ownerUid !== uid) throw Error("Deal owner mismatch");
      batch.update(deal.ref,{publishingApproved:visible});
      updated++;
    }
    if (deals.docs.slice(i,i+400).length) await batch.commit();
  }
  return {visible,updated};
}
