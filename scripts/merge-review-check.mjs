/**
 * Exact-head, fail-closed PR merge-review evidence gate.
 * This is an additional CI check, NOT a substitute for repository branch protection.
 * Never execute or checkout PR-head code in the pull_request_target job.
 */
export const REQUIRED_CHECKS = Object.freeze(["core-proof", "verify-agent-contract"]);
const SHA = /^[0-9a-f]{40}$/;
const clean = (value) => typeof value === "string" ? value : "";

export function evaluateMergeReview({ pr, currentMainSha, mainIsAncestor, checkRuns = [], reviews = [], statuses = [] }) {
  const reasons = [];
  const head = clean(pr?.head?.sha);
  const author = clean(pr?.user?.login).toLowerCase();
  const base = clean(pr?.base?.sha);
  if (pr?.state !== "open") reasons.push("PR is not open");
  if (pr?.base?.ref !== "main") reasons.push("PR does not target main");
  if (pr?.draft !== false) reasons.push("Draft PR is not merge-authorized");
  if (!SHA.test(head)) reasons.push("Invalid or missing exact PR head SHA");
  if (!SHA.test(currentMainSha) || base !== currentMainSha) reasons.push("PR base is stale or current main is unverified");
  if (mainIsAncestor !== true) reasons.push("Current main is not proven an ancestor of this PR head");
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
  const mainSha = main?.commit?.sha;
  if (!SHA.test(head || "") || !SHA.test(mainSha || "")) throw new Error("Invalid PR or main SHA");

  const [checks, reviews, status, ancestry] = await Promise.all([
    readJson(api, token, base + "/commits/" + head + "/check-runs?per_page=100&filter=latest"),
    readJson(api, token, base + "/pulls/" + number + "/reviews?per_page=100"),
    readJson(api, token, base + "/commits/" + head + "/status"),
    readJson(api, token, base + "/compare/" + mainSha + "..." + head)
  ]);
  // Do not silently drop checks/reviews on repositories that exceed a single API page.
  if (checks.total_count > 100 || reviews.length >= 100) {
    throw new Error("Merge review evidence exceeds page limit; manual verification required");
  }
  return {
    ...evaluateMergeReview({
      pr,
      currentMainSha: mainSha,
      mainIsAncestor: ancestry?.merge_base_commit?.sha === mainSha && ["ahead", "identical"].includes(ancestry?.status),
      checkRuns: checks.check_runs,
      reviews,
      statuses: status.statuses
    }),
    checked_main_sha: mainSha
  };
}


async function writeCheck(api, token, repository, suffix, body, method) {
  const response = await fetch(api + "/repos/" + repository + "/check-runs" + suffix, {
    method,
    headers: {
      authorization: "Bearer " + token,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("GitHub check publication failed (HTTP " + response.status + ")");
  return response.json();
}

export async function publishMergeReview({ api, token, repository, number }) {
  const root = "/repos/" + repository;
  const pr = await readJson(api, token, root + "/pulls/" + number);
  if (pr.state !== "open" || pr.base?.ref !== "main") return { skipped: true };
  const head = pr.head?.sha;
  if (!SHA.test(head || "")) throw new Error("Invalid review target head");

  // Install a pending check ON the untrusted PR HEAD before reading any evidence.
  // Never run code from that PR head; only GitHub metadata enters the verifier.
  const run = await writeCheck(api, token, repository, "", {
    name: "merge-review", head_sha: head, status: "in_progress",
    details_url: "https://github.com/" + repository + "/actions/runs/" + process.env.GITHUB_RUN_ID
  }, "POST");

  let verdict = { pass: false, head, reasons: ["Unable to verify merge-review evidence"] };
  try {
    verdict = await checkPullRequest({ api, token, repository, number });
    const [fresh, currentMain] = await Promise.all([
      readJson(api, token, root + "/pulls/" + number),
      readJson(api, token, root + "/branches/main")
    ]);
    if (verdict.head !== head || fresh.head?.sha !== head || fresh.state !== "open" ||
        fresh.draft !== false || fresh.base?.ref !== "main" ||
        currentMain?.commit?.sha !== verdict.checked_main_sha ||
        fresh.base?.sha !== verdict.checked_main_sha) {
      verdict = { pass: false, head, reasons: ["PR changed while merge review was running"] };
    }
  } catch (error) {
    verdict = { pass: false, head, reasons: [error?.message || "Unknown verification error"] };
  }

  await writeCheck(api, token, repository, "/" + run.id, {
    status: "completed",
    conclusion: verdict.pass ? "success" : "failure",
    completed_at: new Date().toISOString(),
    output: {
      title: verdict.pass ? "Exact-head merge review: PASS" : "Exact-head merge review: BLOCKED",
      summary: ["Target: \`" + head + "\`", ...verdict.reasons.map(x => "- " + x)].join("\n").slice(0, 65000)
    }
  }, "PATCH");
  return { ...verdict, check_run_id: run.id };
}

async function relevantPullRequests(event, token, api, repository) {
  if (event?.inputs?.pr_number !== undefined) {
    const n = Number(event.inputs.pr_number);
    if (!Number.isSafeInteger(n) || n < 1) throw new Error("Invalid manual PR number");
    return [n];
  }
  if (Number.isSafeInteger(event?.pull_request?.number)) {
    return [event.pull_request.number];
  }
  const sha = event?.workflow_run?.head_sha || event?.check_run?.head_sha;
  if (!SHA.test(sha || "")) return [];
  const list = await readJson(api, token, "/repos/" + repository + "/commits/" + sha + "/pulls?per_page=100");
  if (!Array.isArray(list) || list.length >= 100) {
    throw new Error("Unable to enumerate complete PR association list");
  }
  return list.filter(x => x.state === "open" && x.base?.ref === "main" && x.head?.sha === sha).map(x => x.number);
}

async function main() {
  const { readFile } = await import("node:fs/promises");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const api = "https://api.github.com";
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || "") || !token) {
    throw new Error("Missing repository identity or read/check-write token");
  }
  const numbers = await relevantPullRequests(event, token, api, repository);
  for (const number of numbers) {
    const result = await publishMergeReview({ api, token, repository, number });
    console.log(JSON.stringify({
      repository, pr: number, exact_head: result.head || null,
      pass: result.pass || false, reasons: result.reasons || [], check_run_id: result.check_run_id || null
    }));
    if (!result.pass && !result.skipped) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch(err => {
    console.error("MERGE REVIEW BLOCKED: " + err.message);
    process.exitCode = 1;
  });
}
