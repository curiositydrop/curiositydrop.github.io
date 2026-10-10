import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("public search never mixes real inventory with demo offers",()=>{
 const html=read("../mydealsportal-preview/index.html");
 assert.match(html,/function source\(\)\{return firestoreLoaded\?liveDeals:allDeals\(\)\}/);
 assert.doesNotMatch(html,/liveDeals\.concat\(allDeals\(\)\)/);
});
test("public deal query has a matching composite index",()=>{
 const client=read("../mydealsportal-preview/firebase-client.js");
 const index=JSON.parse(read("../mydealsportal-preview/firestore.indexes.json"));
 const cfg=JSON.parse(read("../firebase.json"));
 assert.match(client,/where\("active","==",true\),where\("publishingApproved","==",true\)/);
 assert.equal(cfg.firestore.indexes,"mydealsportal-preview/firestore.indexes.json");
 assert.ok(index.indexes.some(i=>i.collectionGroup==="deals" &&
  i.fields.some(f=>f.fieldPath==="active") &&
  i.fields.some(f=>f.fieldPath==="publishingApproved")));
});
test("client cannot directly set server-only publishing approval on updates",()=>{
 const client=read("../mydealsportal-preview/firebase-client.js");
 const update=client.split("if(id){")[1].split("return id;")[0];
 assert.doesNotMatch(update,/publishingApproved|stripeCustomerId|subscriptionStatus/);
 assert.match(client,/payload\.publishingApproved=false/);
});
