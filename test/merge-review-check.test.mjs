import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMergeReview, REQUIRED_CHECKS, publishMergeReview } from "../scripts/merge-review-check.mjs";

const SHA = "a".repeat(40), BASE = "b".repeat(40), OLD = "c".repeat(40);
function fixture(overrides = {}) {
  const pr = { state: "open", draft: false, mergeable: true, user: { login: "author" }, head: { sha: SHA }, base: { ref: "main", sha: BASE }, ...overrides.pr };
  const checks = REQUIRED_CHECKS.map(name => ({ name, head_sha: SHA, app: { slug: "github-actions" }, status: "completed", conclusion: "success" }));
  const reviews = [{ user: { login: "reviewer" }, commit_id: SHA, state: "APPROVED", submitted_at: "2026-10-22T01:00:00Z" }];
  return { pr, currentMainSha: BASE, mainIsAncestor: true, checkRuns: checks, reviews, statuses: [], ...overrides };
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

test("branch behind main blocks even when PR base SHA points to moving main", () => {
  denied(fixture({ mainIsAncestor: false }), "not proven an ancestor");
});


function stubMetadata({ approved = true, moveHead = false, moveMain = false, draft = false } = {}) {
  const calls = [];
  const checks = REQUIRED_CHECKS.map(name => ({
    name, head_sha: SHA, app: { slug: "github-actions" },
    status: "completed", conclusion: "success"
  }));
  const reviews = approved ? [{ user: { login: "reviewer" }, commit_id: SHA, state: "APPROVED", submitted_at: "2026-10-22T01:00:00Z" }] : [];
  const pr = {
    number: 23, state: "open", draft, mergeable: true,
    user: { login: "author" }, base: { ref: "main", sha: BASE }, head: { sha: SHA }
  };
  let reads = 0;
  let mainReads = 0;
  async function mockFetch(url, options = {}) {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method, body });
    let data;
    if (method === "POST" && url.endsWith("/check-runs")) data = { id: 7 };
    else if (method === "PATCH" && url.endsWith("/check-runs/7")) data = { id: 7 };
    else if (url.endsWith("/pulls/23")) {
      reads++;
      data = reads > 2 && moveHead ? { ...pr, head: { sha: OLD } } : pr;
    }
    else if (url.endsWith("/branches/main")) data = { commit: { sha: (moveMain && ++mainReads > 1) ? OLD : BASE } };
    else if (url.includes("/check-runs?per_page=100")) data = { total_count: 2, check_runs: checks };
    else if (url.endsWith("/pulls/23/reviews?per_page=100")) data = reviews;
    else if (url.endsWith("/commits/" + SHA + "/status")) data = { statuses: [] };
    else if (url.endsWith("/compare/" + BASE + "..." + SHA)) data = {
      status: "ahead", merge_base_commit: { sha: BASE }
    };
    else throw Error("Unexpected request: " + method + " " + url);
    return { ok: true, status: 200, json: async () => data };
  }
  return { calls, mockFetch };
}

async function withMockFetch(mockFetch, task) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try { return await task(); } finally { globalThis.fetch = originalFetch; }
}

test("publishes pending then successful check against exact PR head", async () => {
  const { calls, mockFetch } = stubMetadata();
  const result = await withMockFetch(mockFetch, () => publishMergeReview({
    api: "https://api.github.test", token: "fake", repository: "jussray/sync-party-game", number: 23
  }));
  assert.equal(result.pass, true);
  const post = calls.find(x => x.method === "POST");
  const patch = calls.find(x => x.method === "PATCH");
  assert.equal(post.body.head_sha, SHA);
  assert.equal(post.body.status, "in_progress");
  assert.equal(post.body.name, "merge-review");
  assert.equal(patch.body.status, "completed");
  assert.equal(patch.body.conclusion, "success");
});

test("publishes failed check on exact PR head without independent approval", async () => {
  const { calls, mockFetch } = stubMetadata({ approved: false });
  const result = await withMockFetch(mockFetch, () => publishMergeReview({
    api: "https://api.github.test", token: "fake", repository: "jussray/sync-party-game", number: 23
  }));
  assert.equal(result.pass, false);
  assert.equal(calls.find(x => x.method === "PATCH").body.conclusion, "failure");
});

test("PR head movement while checking cannot publish a success", async () => {
  const { calls, mockFetch } = stubMetadata({ moveHead: true });
  const result = await withMockFetch(mockFetch, () => publishMergeReview({
    api: "https://api.github.test", token: "fake", repository: "jussray/sync-party-game", number: 23
  }));
  assert.equal(result.pass, false);
  assert.equal(calls.find(x => x.method === "PATCH").body.conclusion, "failure");
});

test("draft PR cannot publish a green merge check", async () => {
  const { calls, mockFetch } = stubMetadata({ draft: true });
  const result = await withMockFetch(mockFetch, () => publishMergeReview({
    api: "https://api.github.test", token: "fake", repository: "jussray/sync-party-game", number: 23
  }));
  assert.equal(result.pass, false);
  assert.equal(calls.find(x => x.method === "PATCH").body.conclusion, "failure");
});


test("main advancing during validation revokes previously green PR decision", async () => {
  const { calls, mockFetch } = stubMetadata({ moveMain: true });
  const result = await withMockFetch(mockFetch, () => publishMergeReview({
    api: "https://api.github.test", token: "fake", repository: "jussray/sync-party-game", number: 23
  }));
  assert.equal(result.pass, false);
  assert.equal(calls.find(x => x.method === "PATCH").body.conclusion, "failure");
});
