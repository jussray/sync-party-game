import test from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_TRUTH_VERSION,
  campaignKey,
  canonicalGrowthIdentity,
  classifyClientTraffic,
  normalizeGrowthContext,
  normalizeGrowthEnvelope,
  normalizeGrowthEvent
} from "../src/growth-contract.js";

test("Analytics Truth V2 is the active measurement contract", () => {
  assert.equal(ANALYTICS_TRUTH_VERSION, "analytics-truth-v2");
});

test("normalizes campaign attribution without retaining raw referrer paths", () => {
  const context = normalizeGrowthContext({
    utm_campaign: " Sync Launch 2026! ",
    utm_source: "Facebook",
    utm_medium: "Social / Paid",
    utm_content: "Hero #1",
    referrer: "https://www.facebook.com/groups/example/posts/123?private=yes"
  });
  assert.deepEqual(context, {
    campaign_id: "sync-launch-2026",
    source: "facebook",
    medium: "social/paid",
    content: "hero-1",
    referrer_host: "www.facebook.com"
  });
});

test("keeps anonymous continuity ids and traffic class but drops unrelated private fields", () => {
  const envelope = normalizeGrowthEnvelope({
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch",
    traffic_class: "browser_signal",
    name: "private player name",
    email: "nobody@example.com",
    prompt: "private game content"
  });
  assert.deepEqual(envelope, {
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch",
    source: null,
    medium: null,
    content: null,
    referrer_host: null,
    traffic_class: "browser_signal"
  });
  assert.equal("name" in envelope, false);
  assert.equal("email" in envelope, false);
  assert.equal("prompt" in envelope, false);
});

test("classifies obvious automation without calling browser-like traffic human", () => {
  assert.equal(classifyClientTraffic({ user_agent: "Mozilla/5.0 HeadlessChrome/140.0" }), "automation_likely");
  assert.equal(classifyClientTraffic({ user_agent: "Googlebot/2.1" }), "automation_likely");
  assert.equal(classifyClientTraffic({ user_agent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0" }), "browser_signal");
  assert.equal(classifyClientTraffic({ user_agent: "custom-client/1.0" }), "unverified_client");
});

test("public clients cannot manufacture server-authoritative outcomes or evidence", () => {
  assert.throws(() => normalizeGrowthEvent({
    event: "game_finished",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678"
  }, { publicOnly: true, evidenceClass: "browser_signal" }), /server-authoritative/);

  const event = normalizeGrowthEvent({
    event: "landing_view",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch",
    evidence_class: "server_authoritative",
    traffic_class: "browser_signal"
  }, { publicOnly: true, evidenceClass: "automation_likely" });
  assert.equal(event.event, "landing_view");
  assert.equal(event.campaign_id, "sync-launch");
  assert.equal(event.evidence_class, "automation_likely");
  assert.equal(event.traffic_class, "automation_likely");
});

test("server events are authoritative while retaining request traffic classification", () => {
  const event = normalizeGrowthEvent({
    event: "game_started",
    event_id: "event_12345678",
    growth: {
      visitor_id: "visitor_12345678",
      session_id: "session_12345678",
      traffic_class: "browser_signal"
    }
  });
  assert.equal(event.evidence_class, "server_authoritative");
  assert.equal(event.traffic_class, "browser_signal");
});

test("unattributed traffic stays unattributed instead of being guessed", () => {
  const event = normalizeGrowthEvent({
    event: "room_created",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678"
  });
  assert.equal(campaignKey(event), "unattributed");
});

test("canonical event identity excludes raw names, answers and messages", () => {
  const event = normalizeGrowthEvent({
    event: "game_started",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch",
    game_seq: 7,
    name: "Ray",
    answer: "secret",
    message: "private"
  });
  const identity = canonicalGrowthIdentity(event);
  assert.deepEqual(Object.keys(identity), [
    "event",
    "event_id",
    "visitor_id",
    "session_id",
    "campaign_id",
    "source",
    "medium",
    "content",
    "referrer_host",
    "evidence_class",
    "traffic_class",
    "game_seq"
  ]);
});
