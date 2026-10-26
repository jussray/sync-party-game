import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Sample the production identity while the real Playwright suite executes.
// Polling cannot prove every request hit one deployment; observed drift fails closed.
export function assertPinnedIdentity(value, expectedSha, expectedBuild) {
  const clean = (v) => typeof v === "string" ? v.replace(/[^\x20-\x7e]/g, "?").slice(0, 120) : "<missing>";
  if (value?.service !== "sync-party-game" || value?.sha !== expectedSha || value?.build !== expectedBuild) {
    throw new Error(
      `Production identity drift: expected sha=${clean(expectedSha)} build=${clean(expectedBuild)}; ` +
      `observed sha=${clean(value?.sha)} build=${clean(value?.build)}`
    );
  }
}

export async function monitorSuite({
  runSuite,
  readIdentity,
  expectedSha,
  expectedBuild,
  intervalMs = 750,
  pause = delay,
  stopSuite = () => {},
  onSample = () => {}
}) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha || "") || !expectedBuild || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Missing or invalid pinned production identity / monitor interval");
  }

  async function probe() {
    assertPinnedIdentity(await readIdentity(), expectedSha, expectedBuild);
    onSample();
  }

  // If the first probe fails, do not even start the browser suite.
  await probe();
  let suiteDone = false;
  const completion = Promise.resolve().then(runSuite)
    .then(() => ({ passed: true }), (error) => ({ passed: false, error }))
    .finally(() => { suiteDone = true; });
  let drift = null;

  while (!suiteDone) {
    await Promise.race([completion, pause(intervalMs)]);
    if (suiteDone) break;
    try {
      await probe();
    } catch (error) {
      drift = error;
      stopSuite();
      break;
    }
  }

  const outcome = await completion;
  // An independent post-suite check is required even if the suite fails.
  try {
    await probe();
  } catch (error) {
    drift ||= error;
  }
  if (drift) throw drift;
  if (!outcome.passed) throw outcome.error;
}

async function main() {
  const expectedSha = process.env.EXPECTED_SHA;
  const expectedBuild = process.env.PINNED_BUILD;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  let samples = 0;
  let result = "FAILED";
  let failure = "";
  let child;

  const readIdentity = async () => {
    const response = await fetch(new URL("/api/version", baseURL), {
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Production identity probe returned HTTP ${response.status}`);
    return response.json();
  };

  const runSuite = () => new Promise((resolveSuite, rejectSuite) => {
    child = spawn("npm", ["run", "test:e2e"], {
      stdio: "inherit",
      detached: process.platform !== "win32"
    });
    child.once("error", rejectSuite);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveSuite();
      else rejectSuite(new Error(`Multiplayer suite failed: exit=${code} signal=${signal}`));
    });
  });

  const stopSuite = () => {
    if (!child?.pid || child.exitCode !== null) return;
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };

  try {
    await monitorSuite({
      runSuite, readIdentity, expectedSha, expectedBuild, stopSuite,
      onSample: () => { samples += 1; }
    });
    result = "PASS";
    console.log(`Public identity monitor: ${samples} matching observations, sha=${expectedSha}, build=${expectedBuild}`);
  } catch (error) {
    failure = error?.message || String(error);
    console.error(`Public identity monitor FAILED after ${samples} matching observations: ${failure}`);
    process.exitCode = 1;
  }

  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/production-identity-monitor.txt", [
    "repository=jussray/sync-party-game",
    `sha=${expectedSha || "<missing>"}`,
    `cloudflare_build=${expectedBuild || "<missing>"}`,
    `successful_observations=${samples}`,
    "sampling_interval_ms=750",
    `identity_monitor=${result}`,
    `detail=${failure.replace(/[\r\n]/g, " ").slice(0, 240)}`,
    "scope=sampled identity checks; does not pin every browser request"
  ].join("\n") + "\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
