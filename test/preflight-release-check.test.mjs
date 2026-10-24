import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { assessProductionPreflight, PRE_RELEASE_CHECKS } from "../scripts/preflight-release-check.mjs";

const SHA = "a".repeat(40), OLD = "b".repeat(40);
function fixture() {
  return {
    sha: SHA,
    checkRuns: PRE_RELEASE_CHECKS.map(name => ({name,head_sha:SHA,app:{slug:"github-actions"},status:"completed",conclusion:"success"})),
    statuses:[]
  };
}
function fail(f,match){const r=assessProductionPreflight(f);assert.equal(r.pass,false);assert.ok(r.errors.some(x=>x.includes(match)),r.errors.join(" | "));}
test("accepts exact-SHA required checks green",()=>assert.equal(assessProductionPreflight(fixture()).pass,true));
test("rejects failed agent contract when core-proof is green",()=>{
  const f=fixture();f.checkRuns[1].conclusion="failure";fail(f,"verify-agent-contract");
});
test("rejects pending agent contract before releasing production",()=>{
  const f=fixture();f.checkRuns[1].status="queued";f.checkRuns[1].conclusion=null;fail(f,"verify-agent-contract");
});
test("rejects predecessor-SHA green check",()=>{
  const f=fixture();f.checkRuns[1].head_sha=OLD;fail(f,"verify-agent-contract");
});
test("rejects unrelated failed current-head verification",()=>{
  const f=fixture();f.checkRuns.push({name:"security",head_sha:SHA,status:"completed",conclusion:"failure"});fail(f,"security");
});
test("does not make in-flight own deployment/proof jobs a circular dependency",()=>{
  const f=fixture();f.checkRuns.push({name:"Promote exact green SHA to production",head_sha:SHA,status:"in_progress",conclusion:null});
  f.checkRuns.push({name:"Public exact-SHA multiplayer proof",head_sha:SHA,status:"queued",conclusion:null});
  assert.equal(assessProductionPreflight(f).pass,true);
});
test("does not require downstream Cloudflare build before branch promotion",()=>{
  const f=fixture();f.checkRuns.push({name:"Workers Builds: sync-party-game",head_sha:SHA,app:{slug:"cloudflare-workers-and-pages"},status:"queued",conclusion:null});
  assert.equal(assessProductionPreflight(f).pass,true);
});
test("rejects red legacy commit status",()=>{const f=fixture();f.statuses=[{context:"security",state:"error"}];fail(f,"security");});
test("rejects missing mandatory checks",()=>{const f=fixture();f.checkRuns=[];fail(f,"core-proof");});
test("does not make the merge-review PR gate a release prerequisite",()=>{
  const f=fixture();f.checkRuns.push({name:"merge-review",head_sha:SHA,app:{slug:"github-actions"},status:"in_progress",conclusion:null});
  assert.equal(assessProductionPreflight(f).pass,true);
});
test("still blocks a non-Actions check that impersonates merge-review",()=>{
  const f=fixture();f.checkRuns.push({name:"merge-review",head_sha:SHA,app:{slug:"spoofed-app"},status:"in_progress",conclusion:null});
  fail(f,"merge-review");
});
test("CLI fails closed when its path contains URL-significant characters",()=>{
  const dir=mkdtempSync(join(tmpdir(),"preflight#"));
  const copy=join(dir,"preflight-release-check.mjs");
  copyFileSync(new URL("../scripts/preflight-release-check.mjs",import.meta.url),copy);
  const r=spawnSync(process.execPath,[copy],{env:{PATH:process.env.PATH},encoding:"utf8"});
  assert.equal(r.status,1);
  assert.match(r.stderr,/PRODUCTION PREFLIGHT BLOCKED/);
});
