import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const rules=readFileSync(new URL("../mydealsportal-preview/firestore.rules",import.meta.url),"utf8");
const client=readFileSync(new URL("../mydealsportal-preview/firebase-client.js",import.meta.url),"utf8");
test("new businesses cannot self-claim a paid subscription",()=>{
 assert.match(rules,/request\.resource\.data\.status\s*==\s*"draft"/);
 assert.match(rules,/request\.resource\.data\.subscriptionStatus\s*==\s*"unpaid"/);
 assert.match(rules,/affectedKeys\(\)\.hasOnly\(\[\s*"name"/);
 assert.match(client,/category,status:"draft",subscriptionStatus:"unpaid"/);
});
test("new deals cannot be approved by their owners",()=>{
 assert.match(rules,/request\.resource\.data\.publishingApproved\s*==\s*false/);
 assert.match(rules,/resource\.data\.publishingApproved\s*==\s*true/);
 assert.match(client,/payload\.publishingApproved=false/);
 assert.match(client,/where\("publishingApproved","==",true\)/);
});
test("rules refuse broad owner-driven billing and publication writes",()=>{
 assert.doesNotMatch(rules,/allow update, delete: if owns\(resource\.data\)/);
 assert.doesNotMatch(rules,/allow create: if signedIn\(\)\s*&& request\.resource\.data\.ownerUid == request\.auth\.uid\s*;/);
});
