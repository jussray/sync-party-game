import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ANALYTICS_TRUTH_VERSION,
  GROWTH_EVENTS,
  PUBLIC_GROWTH_EVENTS,
  classifyClientTraffic,
  normalizeGrowthEvent
} from "../src/growth-contract.js";

const [worker, ledger, dashboard] = await Promise.all([
  readFile(new URL("../src/worker.js", import.meta.url), "utf8"),
  readFile(new URL("../src/growth-ledger.js", import.meta.url), "utf8"),
  readFile(new URL("../public/usage.html", import.meta.url), "utf8")
]);

assert.equal(ANALYTICS_TRUTH_VERSION, "analytics-truth-v2");
assert.deepEqual(PUBLIC_GROWTH_EVENTS, ["landing_view", "play_intent"]);
for (const event of ["room_created", "room_joined", "game_started", "game_finished", "rematch_started", "player_game_started", "player_game_finished", "player_rematch_started"]) {
  assert.ok(GROWTH_EVENTS.includes(event), `missing governed event: ${event}`);
  assert.ok(!PUBLIC_GROWTH_EVENTS.includes(event), `server event leaked into public lane: ${event}`);
}

assert.equal(classifyClientTraffic({ user_agent: "Googlebot/2.1" }), "automation_likely");
assert.equal(classifyClientTraffic({ user_agent: "Mozilla/5.0 HeadlessChrome/140.0" }), "automation_likely");
assert.equal(classifyClientTraffic({ user_agent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0" }), "browser_signal");
assert.equal(classifyClientTraffic({ user_agent: "custom-client/1.0" }), "unverified_client");

const forged = normalizeGrowthEvent({
  event: "landing_view",
  event_id: "event_attack_12345678",
  evidence_class: "server_authoritative",
  traffic_class: "browser_signal"
}, { publicOnly: true, evidenceClass: "automation_likely" });
assert.equal(forged.evidence_class, "automation_likely");
assert.equal(forged.traffic_class, "automation_likely");

const authoritative = normalizeGrowthEvent({
  event: "game_started",
  event_id: "event_attack_87654321",
  growth: { traffic_class: "browser_signal" }
});
assert.equal(authoritative.evidence_class, "server_authoritative");

const requiredWorkerWitnesses = [
  "ANALYTICS_TRUTH_VERSION",
  "version\") === \"legacy\"",
  "player_game_started",
  "player_game_finished",
  "player_rematch_started",
  "requestTrafficClass(request)",
  "campaign_rollup"
];
for (const witness of requiredWorkerWitnesses) assert.ok(worker.includes(witness), `worker truth witness missing: ${witness}`);

for (const witness of ["product_counters", "automation_counters", "legacy_merged: false", "unique_growth_identities", "acquisition:"]) {
  assert.ok(ledger.includes(witness), `ledger truth witness missing: ${witness}`);
}

assert.ok(ledger.includes('normalized.evidence_class === "server_authoritative" && !isAutomation'), "product counters must require server authority and exclude automation-likely traffic");
assert.ok(dashboard.includes("No metric on this page claims a unique human."), "dashboard must not relabel anonymous identities as humans");
assert.ok(dashboard.includes("Legacy V1 remains frozen"), "dashboard must disclose the legacy boundary");

console.log("ANALYTICS_TRUTH_ATTACK=PASS");
console.log("measurement=analytics-truth-v2");
console.log("public_lane=landing_view,play_intent");
console.log("product_lane=server_authoritative_non_automation");
console.log("legacy=read_only_not_merged");
