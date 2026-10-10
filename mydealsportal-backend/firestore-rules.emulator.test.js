import test,{before,after} from "node:test";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {doc,setDoc,getDoc,updateDoc,collection,query,where,getDocs} from "firebase/firestore";
import {readFileSync} from "node:fs";

let env;
before(async()=>{
 env=await initializeTestEnvironment({
  projectId:"mdp-rules-authorization-test",
  firestore:{rules:readFileSync(new URL("../mydealsportal-preview/firestore.rules",import.meta.url),"utf8"),host:"127.0.0.1",port:8085}
 });
});
after(async()=>{await env?.cleanup()});
test("business starts unpaid and cannot forge paid registration",async()=>{
 const owner=env.authenticatedContext("owner1").firestore();
 await assertFails(setDoc(doc(owner,"businesses","owner1"),{ownerUid:"owner1",name:"Bad",status:"active",subscriptionStatus:"active"}));
 await assertSucceeds(setDoc(doc(owner,"businesses","owner1"),{ownerUid:"owner1",name:"Good",slug:"good",phone:"",website:"",zip:"04072",city:"Saco",category:"Other",status:"draft",subscriptionStatus:"unpaid"}));
 await assertFails(updateDoc(doc(owner,"businesses","owner1"),{publishingEnabled:true}));
 await assertFails(updateDoc(doc(owner,"businesses","owner1"),{subscriptionStatus:"active"}));
 await assertSucceeds(updateDoc(doc(owner,"businesses","owner1"),{phone:"123"}));
});
test("unpaid owner can draft deals but cannot self approve them",async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),"businesses","owner2"),{ownerUid:"owner2",status:"draft",subscriptionStatus:"unpaid"});
 });
 const owner=env.authenticatedContext("owner2").firestore();
 const deal=doc(owner,"deals","d2");
 await assertFails(setDoc(deal,{ownerUid:"owner2",businessId:"owner2",active:true,publishingApproved:true}));
 await assertSucceeds(setDoc(deal,{ownerUid:"owner2",businessId:"owner2",active:true,publishingApproved:false}));
 await assertFails(updateDoc(deal,{publishingApproved:true}));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),"deals","d2")));
 await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),"deals","d2"),{publishingApproved:true})});
 await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),"deals","d2")));
});
test("owner cannot modify another business or deal",async()=>{
 const stranger=env.authenticatedContext("intruder").firestore();
 await assertFails(updateDoc(doc(stranger,"businesses","owner1"),{phone:"hijack"}));
 await assertFails(updateDoc(doc(stranger,"deals","d2"),{title:"hijack"}));
});
