/**
 * Exact-head, fail-closed PR merge-review evidence gate.
 * This is an additional CI check, NOT a substitute for repository branch protection.
 * Never execute or checkout PR-head code in the pull_request_target job.
 */
export const REQUIRED_CHECKS = Object.freeze(["core-proof", "verify-agent-contract"]);
const SHA = /^[0-9a-f]{40}$/;
const clean = (value) => typeof value === "string" ? value : "";

export function evaluateMergeReview({ pr, currentMainSha, checkRuns = [], reviews = [], statuses = [] }) {
  const reasons = [];
  const head = clean(pr?.head?.sha);
  const author = clean(pr?.user?.login).toLowerCase();
  const base = clean(pr?.base?.sha);
  if (pr?.state !== "open") reasons.push("PR is not open");
  if (pr?.base?.ref !== "main") reasons.push("PR does not target main");
  if (pr?.draft !== false) reasons.push("Draft PR is not merge-authorized");
  if (!SHA.test(head)) reasons.push("Invalid or missing exact PR head SHA");
  if (!SHA.test(currentMainSha) || base !== currentMainSha) reasons.push("PR base is stale or current main is unverified");
  if (pr?.mergeable !== true) reasons.push("PR mergeability is false or unknown");

  for (const name of REQUIRED_CHECKS) {
    const selected = checkRuns.filter(x =>
      x?.name === name && x?.head_sha === head && x?.app?.slug === "github-actions");
    if (selected.length !== 1 || selected[0].status !== "completed" || selected[0].conclusion !== "success") {
      reasons.push(name + " has no unique successful check on exact PR head");
    }
  }

  // A failed, cancelled, timed-out, or still-running CURRENT-head check may never pass.
  // Ignore this merge-review job itself to avoid a circular dependency.
  for (const item of checkRuns) {
    if (item?.name === "merge-review") continue;
    if (item?.head_sha !== head || item?.status !== "completed" || item?.conclusion !== "success") {
      reasons.push("Unverified current-head check: " + clean(item?.name).slice(0, 80));
    }
  }

  // Legacy commit statuses: consider the latest state for each context, not old overwritten statuses.
  const latestByContext = new Map();
  for (const item of statuses) {
    const context = clean(item?.context);
    if (!context) { reasons.push("Commit status is missing context"); continue; }
    if (!latestByContext.has(context)) latestByContext.set(context, item);
  }
  for (const [context, item] of latestByContext) {
    if (item?.state !== "success") reasons.push("Unverified commit status: " + context.slice(0, 80));
  }

  // A prior approval on a predecessor commit never authorizes a new SHA.
  // Use each reviewer's latest relevant decision, ignoring COMMENTED reviews.
  const decisions = new Map();
  const ordered = [...reviews].sort((a, b) =>
    clean(a?.submitted_at).localeCompare(clean(b?.submitted_at)));
  for (const review of ordered) {
    const reviewer = clean(review?.user?.login).toLowerCase();
    if (!reviewer || reviewer === author || review?.commit_id !== head) continue;
    if (review.state === "APPROVED") decisions.set(reviewer, true);
    if (review.state === "CHANGES_REQUESTED" || review.state === "DISMISSED") decisions.set(reviewer, false);
  }
  if (![...decisions.values()].some(Boolean)) {
    reasons.push("No independent APPROVED review bound to exact PR head");
  }
  return { pass: reasons.length === 0, head, reasons: [...new Set(reasons)] };
}

async function readJson(api, token, path) {
  const res = await fetch(api + path, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error("GitHub API " + res.status + " for " + path.split("?")[0]);
  return res.json();
}

export async function checkPullRequest({ api, token, repository, number }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !Number.isSafeInteger(number) || number < 1 || !token) {
    throw new Error("Missing or invalid GitHub authority inputs");
  }
  const base = "/repos/" + repository;
  const pr = await readJson(api, token, base + "/pulls/" + number);
  const main = await readJson(api, token, base + "/branches/main");
  const head = pr?.head?.sha;
  if (!SHA.test(head || "")) throw new Error("Invalid PR head SHA");

  const [checks, reviews, status] = await Promise.all([
    readJson(api, token, base + "/commits/" + head + "/check-runs?per_page=100&filter=latest"),
    readJson(api, token, base + "/pulls/" + number + "/reviews?per_page=100"),
    readJson(api, token, base + "/commits/" + head + "/status")
  ]);
  // Do not silently drop checks/reviews on repositories that exceed a single API page.
  if (checks.total_count > 100 || reviews.length >= 100) {
    throw new Error("Merge review evidence exceeds page limit; manual verification required");
  }
  return evaluateMergeReview({
    pr,
    currentMainSha: main?.commit?.sha,
    checkRuns: checks.check_runs,
    reviews,
    statuses: status.statuses
  });
}

async function main() {
  const { readFile } = await import("node:fs/promises");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const number = Number(event?.pull_request?.number);
  const result = await checkPullRequest({
    api: process.env.GITHUB_API_URL || "https://api.github.com",
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    number
  });
  console.log(JSON.stringify({
    repository: process.env.GITHUB_REPOSITORY,
    pr: number,
    exact_head: result.head,
    pass: result.pass,
    reasons: result.reasons
  }, null, 2));
  if (!result.pass) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch(err => {
    console.error("MERGE REVIEW BLOCKED: " + err.message);
    process.exitCode = 1;
  });
}
