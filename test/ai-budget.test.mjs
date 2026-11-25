import test from "node:test";
import assert from "node:assert/strict";
import { reserveDailyAiCall, dailyAiLimit } from "../src/ai-budget-logic.js";

function storage() {
  const data = new Map();
  return { get: async (k) => data.get(k), put: async (k, v) => { data.set(k, v); } };
}

test("global daily AI budget fails closed after the cap", async () => {
  const store = storage();
  const day = Date.parse("2026-11-25T08:00:00Z");
  assert.deepEqual(await reserveDailyAiCall(store, day, 2), { status: "reserved", used: 1, remaining: 1 });
  assert.deepEqual(await reserveDailyAiCall(store, day, 2), { status: "reserved", used: 2, remaining: 0 });
  assert.deepEqual(await reserveDailyAiCall(store, day, 2), { status: "exhausted", used: 2, remaining: 0 });
  const nextDay = day + 86400000;
  assert.deepEqual(await reserveDailyAiCall(store, nextDay, 2), { status: "reserved", used: 1, remaining: 1 });
});

test("provider-wide daily limit defaults low and is always capped", () => {
  assert.equal(dailyAiLimit({}), 12);
  assert.equal(dailyAiLimit({ SYNC_AI_DAILY_BUDGET: "5" }), 5);
  assert.equal(dailyAiLimit({ SYNC_AI_DAILY_BUDGET: "1000000" }), 50);
  assert.equal(dailyAiLimit({ SYNC_AI_DAILY_BUDGET: "nope" }), 12);
  assert.equal(dailyAiLimit({ SYNC_AI_DAILY_BUDGET: "-1" }), 12);
});
