import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getApps,initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
if(!getApps().length)initializeApp();
export const approvePaidDeal=onDocumentCreated({
 document:"deals/{dealId}",region:"us-central1"
},async event=>{
 const deal=event.data?.data();
 if(!deal?.ownerUid||deal.publishingApproved!==false)return;
 const business=await getFirestore().collection("businesses").doc(deal.ownerUid).get();
 const data=business.data();
 if(!data||data.ownerUid!==deal.ownerUid||data.status!=="active"||
   !["active","trialing"].includes(data.subscriptionStatus))return;
 await event.data.ref.update({publishingApproved:true});
});
