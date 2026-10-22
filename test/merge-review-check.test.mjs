import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMergeReview, REQUIRED_CHECKS } from "../scripts/merge-review-check.mjs";

const SHA = "a".repeat(40), BASE = "b".repeat(40), OLD = "c".repeat(40);
function fixture(overrides = {}) {
  const pr = { state: "open", draft: false, mergeable: true, user: { login: "author" }, head: { sha: SHA }, base: { ref: "main", sha: BASE }, ...overrides.pr };
  const checks = REQUIRED_CHECKS.map(name => ({ name, head_sha: SHA, app: { slug: "github-actions" }, status: "completed", conclusion: "success" }));
  const reviews = [{ user: { login: "reviewer" }, commit_id: SHA, state: "APPROVED", submitted_at: "2026-10-22T01:00:00Z" }];
  return { pr, currentMainSha: BASE, checkRuns: checks, reviews, statuses: [], ...overrides };
}
function denied(f, reason) {
  const outcome = evaluateMergeReview(f);
  assert.equal(outcome.pass, false);
  assert.ok(outcome.reasons.some(x => x.includes(reason)), JSON.stringify(outcome.reasons));
}
test("passes only current approved green PR head", () => assert.equal(evaluateMergeReview(fixture()).pass, true));
test("draft blocks even when checks pass", () => denied(fixture({ pr: { draft: true } }), "Draft"));
test("stale base blocks", () => denied(fixture({ currentMainSha: OLD }), "base is stale"));
test("unmergeable PR blocks", () => denied(fixture({ pr: { mergeable: false } }), "mergeability"));
test("missing CI blocks", () => denied(fixture({ checkRuns: [] }), "core-proof"));
test("failed core-proof blocks", () => {
  const f = fixture();f.checkRuns[0].conclusion = "failure";denied(f, "core-proof");
});
test("pending check blocks", () => {
  const f=fixture();f.checkRuns[0].status="in_progress";f.checkRuns[0].conclusion=null;denied(f,"Unverified current-head");
});
test("unrelated red check blocks", () => {
  const f=fixture();f.checkRuns.push({ name: "additional-safety", head_sha: SHA, status: "completed", conclusion: "cancelled" });denied(f,"additional-safety");
});
test("stale review from predecessor SHA blocks", () => {
  const f=fixture();f.reviews[0].commit_id=OLD;denied(f,"independent APPROVED");
});
test("self-approval does not authorize merge", () => {
  const f=fixture();f.reviews[0].user.login="author";denied(f,"independent APPROVED");
});
test("changes requested after approval blocks", () => {
  const f=fixture();f.reviews.push({ user: { login: "reviewer" }, commit_id: SHA, state: "CHANGES_REQUESTED", submitted_at: "2026-10-22T02:00:00Z" });denied(f,"independent APPROVED");
});
test("latest legacy red status blocks", () => denied(fixture({ statuses: [{ context: "security", state: "failure" }] }), "security"));
test("prior superseded legacy red status does not condemn a green head", () => {
  const f=fixture({ statuses: [{context:"security",state:"success"}, {context:"security",state:"failure"}] });
  assert.equal(evaluateMergeReview(f).pass,true);
});
test("wrong GitHub app cannot impersonate the required checks", () => {
  const f=fixture();f.checkRuns[0].app.slug="other";denied(f,"core-proof");
});
test("review and check cannot be borrowed from another head", () => {
  const f=fixture();f.checkRuns[1].head_sha=OLD;denied(f,"verify-agent-contract");
});
