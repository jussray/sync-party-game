import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignKey,
  canonicalGrowthIdentity,
  normalizeGrowthContext,
  normalizeGrowthEnvelope,
  normalizeGrowthEvent
} from "../src/growth-contract.js";

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
    medium: "social/-paid",
    content: "hero-1",
    referrer_host: "www.facebook.com"
  });
});

test("keeps anonymous continuity ids but drops unrelated private fields", () => {
  const envelope = normalizeGrowthEnvelope({
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch",
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
    referrer_host: null
  });
  assert.equal("name" in envelope, false);
  assert.equal("email" in envelope, false);
  assert.equal("prompt" in envelope, false);
});

test("public clients cannot manufacture server-authoritative product outcomes", () => {
  assert.throws(() => normalizeGrowthEvent({
    event: "game_finished",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678"
  }, { publicOnly: true }), /server-authoritative/);

  const event = normalizeGrowthEvent({
    event: "landing_view",
    event_id: "event_12345678",
    visitor_id: "visitor_12345678",
    session_id: "session_12345678",
    campaign_id: "sync-launch"
  }, { publicOnly: true });

  assert.equal(event.event, "landing_view");
  assert.equal(event.campaign_id, "sync-launch");
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
    "game_seq"
  ]);
});
