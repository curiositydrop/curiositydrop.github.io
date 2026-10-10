// Read-only release gate for client-side Firestore authorization.
// Not a replacement for Firebase Emulator Suite tests.
import {readFileSync} from "node:fs";
const rules=readFileSync(new URL("../mydealsportal-preview/firestore.rules",import.meta.url),"utf8");
const findings=[];
if(/allow\s+update\s*,\s*delete\s*:\s*if\s+owns\(resource\.data\)/.test(rules))
 findings.push("Broad owner update/delete permissions remain.");
if(!/publishingApproved/.test(rules))
 findings.push("No server-managed public deal approval gate.");
if(/allow\s+create\s*:\s*if\s+signedIn\(\)/.test(rules) &&
 !/request\.resource\.data\.status\s*==\s*["']draft["']/.test(rules))
 findings.push("Client can register businesses without draft status enforcement.");
if(findings.length){
 console.error("BLOCKED: Firestore rules not ready for paid advertising:");
 findings.forEach(x=>console.error("- "+x));
 process.exitCode=1;
}else{
 console.log("Static rules checks passed. Emulator-based security tests still required.");
}
