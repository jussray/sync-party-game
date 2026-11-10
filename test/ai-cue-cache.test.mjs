import test from "node:test";
import assert from "node:assert/strict";
import { reserveAiCue } from "../src/ai-cue-cache.js";

function storage() {
  const values = new Map();
  return {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, value); }
  };
}

test("first cue reserves one paid call; duplicates reuse the reservation", async () => {
  const store = storage();
  assert.deepEqual(await reserveAiCue(store, "ai:one", 1, 42), { status: "reserved" });
  assert.deepEqual(await reserveAiCue(store, "ai:one", 1, 100), { status: "pending", at: 42 });
  assert.equal(await store.get("ai:used"), 1);
  assert.deepEqual(await reserveAiCue(store, "ai:two", 1, 101), { status: "quota" });
});

test("a completed cue can be reused without extra provider calls", async () => {
  const store = storage();
  await reserveAiCue(store, "ai:one", 1, 42);
  await store.put("ai:one", { status: "ready", value: { text: "The room is in sync." } });
  const found = await reserveAiCue(store, "ai:one", 1, 100);
  assert.equal(found.value.text, "The room is in sync.");
  assert.equal(await store.get("ai:used"), 1);
});
