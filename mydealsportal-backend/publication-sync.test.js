import test from "node:test";
import assert from "node:assert/strict";
import {desiredPublication} from "./publication-sync.js";
test("paid business can be publication eligible",()=>assert.equal(desiredPublication({paid:true,suspended:false}),true));
test("suspended businesses stay hidden",()=>assert.equal(desiredPublication({paid:true,suspended:true}),false));
test("unpaid businesses stay hidden",()=>assert.equal(desiredPublication({paid:false,suspended:false}),false));
