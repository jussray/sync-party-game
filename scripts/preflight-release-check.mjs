/**
 * Before the trusted core-proof workflow promotes a production branch, require
 * every independent pre-release check on the EXACT candidate SHA to be green.
 * Never trust a predecessor SHA or any self-referential deploy/proof check.
 */
export const PRE_RELEASE_CHECKS = Object.freeze(["core-proof", "verify-agent-contract"]);
const OWN_DEPLOY_CHECKS = new Set(["Promote exact green SHA to production", "Public exact-SHA multiplayer proof"]);
const SHA = /^[0-9a-f]{40}$/;

export function assessProductionPreflight({ sha, checkRuns = [], statuses = [] }) {
  const errors = [];
  if (!SHA.test(sha || "")) errors.push("Invalid exact candidate SHA");
  for (const name of PRE_RELEASE_CHECKS) {
    const matches = checkRuns.filter(x => x?.name === name && x?.head_sha === sha && x?.app?.slug === "github-actions");
    if (matches.length !== 1 || matches[0].status !== "completed" || matches[0].conclusion !== "success") {
      errors.push("Required release check not green on candidate: " + name);
    }
  }
  for (const check of checkRuns) {
    if (OWN_DEPLOY_CHECKS.has(check?.name)) continue;
    // Workers Builds is downstream of promoting production; can't be a prerequisite.
    if (check?.name === "Workers Builds: sync-party-game" && check?.app?.slug === "cloudflare-workers-and-pages") continue;
    // merge-review is a PR-head gate, not a release prerequisite; only the Actions-published check is exempt.
    if (check?.name === "merge-review" && check?.app?.slug === "github-actions") continue;
    if (check?.head_sha !== sha || check?.status !== "completed" || check?.conclusion !== "success") {
      errors.push("Current-head pre-release check is red or pending: " + String(check?.name).slice(0, 100));
    }
  }
  const contexts = new Map();
  for (const status of statuses) {
    if (!status?.context) {errors.push("Legacy status context is missing");continue;}
    if (!contexts.has(status.context)) contexts.set(status.context, status);
  }
  for (const [name, item] of contexts) {
    if (item?.state !== "success") errors.push("Current-head legacy status not green: " + name.slice(0, 100));
  }
  return { pass: errors.length === 0, errors: [...new Set(errors)] };
}

async function getJson(token, path) {
  const response = await fetch("https://api.github.com" + path, {
    headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("GitHub API preflight failed (HTTP " + response.status + ")");
  return response.json();
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.TARGET_SHA;
  const token = process.env.GITHUB_TOKEN;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || "") || !SHA.test(sha || "") || !token) {
    throw new Error("Missing exact release authority inputs");
  }
  const root = "/repos/" + repository + "/commits/" + sha;
  const [checks, statuses] = await Promise.all([
    getJson(token, root + "/check-runs?per_page=100&filter=latest"),
    getJson(token, root + "/status")
  ]);
  if (checks.total_count > 100) throw new Error("Release checks exceeded pagination limit");
  const result = assessProductionPreflight({ sha, checkRuns: checks.check_runs, statuses: statuses.statuses });
  console.log(JSON.stringify({ exact_sha: sha, pre_release_green: result.pass, reasons: result.errors }, null, 2));
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch(error => {console.error("PRODUCTION PREFLIGHT BLOCKED: " + error.message);process.exitCode = 1;});
}
