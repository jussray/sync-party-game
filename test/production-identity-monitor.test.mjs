import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPinnedIdentity, monitorSuite } from "../scripts/production-identity-monitor.mjs";

const SHA = "a".repeat(40);
const identity = (build = "A", sha = SHA) => ({ service: "sync-party-game", sha, build });

test("accepts exact service, commit and build identity", () => {
  assert.doesNotThrow(() => assertPinnedIdentity(identity(), SHA, "A"));
});

test("rejects changed build, SHA, service, or missing identity", () => {
  for (const version of [identity("B"), identity("A", "b".repeat(40)), { ...identity(), service: "other" }, {}]) {
    assert.throws(() => assertPinnedIdentity(version, SHA, "A"), /identity drift/i);
  }
});

test("checks production before suite, while running, and after completion", async () => {
  let releaseSuite;
  let ticks = 0;
  let samples = 0;
  await monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => identity(),
    runSuite: () => new Promise(resolve => { releaseSuite = resolve; }),
    pause: async () => {
      await Promise.resolve();
      if (++ticks === 2) releaseSuite();
    },
    onSample: () => { samples += 1; }
  });
  assert.ok(samples >= 3, "requires initial, during-suite, and final samples");
});

test("detects A → B → A change during suite even if final deployment matches", async () => {
  let releaseSuite;
  let checks = 0;
  let stops = 0;
  await assert.rejects(monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => [identity("A"), identity("B"), identity("A")][Math.min(checks++, 2)],
    runSuite: () => new Promise(resolve => { releaseSuite = resolve; }),
    pause: async () => { await Promise.resolve(); },
    stopSuite: () => { stops += 1; releaseSuite(); }
  }), /identity drift/i);
  assert.equal(stops, 1);
  assert.equal(checks, 3, "post-suite identity may match but drift still fails");
});

test("rejects mid-suite SHA drift", async () => {
  let releaseSuite;
  let checks = 0;
  await assert.rejects(monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => checks++ === 0 ? identity() : identity("A", "b".repeat(40)),
    runSuite: () => new Promise(resolve => { releaseSuite = resolve; }),
    pause: async () => { await Promise.resolve(); },
    stopSuite: () => releaseSuite()
  }), /identity drift/i);
});

test("fails closed on a probe failure during suite", async () => {
  let releaseSuite;
  let checks = 0;
  await assert.rejects(monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => {
      if (checks++ === 1) throw new Error("identity endpoint unavailable");
      return identity();
    },
    runSuite: () => new Promise(resolve => { releaseSuite = resolve; }),
    pause: async () => { await Promise.resolve(); },
    stopSuite: () => releaseSuite()
  }), /identity endpoint unavailable/);
});

test("does not start browser suite if first identity sample is wrong", async () => {
  let started = false;
  await assert.rejects(monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => identity("B"),
    runSuite: async () => { started = true; }
  }), /identity drift/i);
  assert.equal(started, false);
});

test("fails if suite fails even when identity remains stable", async () => {
  await assert.rejects(monitorSuite({
    expectedSha: SHA,
    expectedBuild: "A",
    readIdentity: async () => identity(),
    runSuite: async () => { throw new Error("playwright failed"); }
  }), /playwright failed/);
});
