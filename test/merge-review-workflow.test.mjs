import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const mergeWorkflow = read("../.github/workflows/merge-review.yml");
const deployWorkflow = read("../.github/workflows/deploy.yml");
const mergeScript = read("../scripts/merge-review-check.mjs");

test("merge review runs trusted main code without checking out the PR head", () => {
  assert.match(mergeWorkflow, /pull_request_target:/);
  assert.match(mergeWorkflow, /ref: main/);
  assert.match(mergeWorkflow, /persist-credentials: false/);
  assert.doesNotMatch(mergeWorkflow, /ref:\s*\$\{\{[^\n]*head\.sha/);
  assert.match(mergeWorkflow, /checks: write/);
  assert.match(mergeWorkflow, /pull-requests: read/);
});

test("merge review refreshes after independent CI and review conclusions", () => {
  assert.match(mergeWorkflow, /pull_request_review:/);
  assert.match(mergeWorkflow, /workflow_run:[\s\S]*workflows: \["core-proof", "Agent Contract v1"\]/);
  assert.match(mergeWorkflow, /check_run:/);
  assert.match(mergeWorkflow, /check_run\.name != 'merge-review'/);
  assert.match(mergeWorkflow, /workflow_dispatch:/);
});

test("merging review publishes on the PR head, not the base branch", () => {
  assert.match(mergeScript, /head_sha: head, status: "in_progress"/);
  assert.match(mergeScript, /name: "merge-review"/);
  assert.match(mergeScript, /conclusion: verdict\.pass \? "success" : "failure"/);
  assert.match(mergeScript, /fresh\.head\?\.sha !== head/);
});

test("release preflight runs before production branch mutation", () => {
  const promo = deployWorkflow.split("\n  production-proof:")[0];
  const guard = promo.indexOf("run: node scripts/preflight-release-check.mjs");
  const push = promo.indexOf('git push origin "$TARGET_SHA:refs/heads/production"');
  assert.ok(guard > 0 && push > guard, "preflight must run before the production ref push");
  assert.match(promo, /checks: read/);
  assert.match(promo, /statuses: read/);
  assert.doesNotMatch(promo, /CLOUDFLARE_API_TOKEN/);
});
