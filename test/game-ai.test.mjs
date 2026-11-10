import test from "node:test";
import assert from "node:assert/strict";
import { buildGameCuePrompt, cueCacheKey, generateGameCue } from "../src/game-ai.js";

const state = {
  phase: "choosing", roundIndex: 0, rounds: 5,
  mode: { label: "Classic Sync", instruction: "Match the majority." },
  prompt: { text: "Choose the best party snack.", choices: ["Pizza", "Fruit"] },
  players: { p1: { name: "PRIVATE PLAYER", resumeToken: "PRIVATE TOKEN" } },
  answers: { p1: 1 }, scores: { p1: 100 },
  lastResults: { syncPercent: 100, winners: ["PRIVATE PLAYER"] }
};

test("AI prompt never receives identities, secrets, live picks or scores", () => {
  const prompt = buildGameCuePrompt(state, "chat");
  assert.match(prompt, /Choose the best party snack/);
  assert.doesNotMatch(prompt, /PRIVATE|100|Pizza|Fruit|p1/);
  assert.doesNotMatch(prompt, /results|winners/i);
});

test("reveal summary may use aggregate sync percentage but not private identities", () => {
  const prompt = buildGameCuePrompt({ ...state, phase: "reveal" }, "cloudflare");
  assert.match(prompt, /100%/);
  assert.doesNotMatch(prompt, /PRIVATE|p1|Pizza|Fruit/);
});

test("AI cache key is edition, phase, round and rematch specific", () => {
  assert.notEqual(cueCacheKey(state, "chat", 0), cueCacheKey(state, "cloudflare", 0));
  assert.notEqual(cueCacheKey(state, "chat", 0), cueCacheKey(state, "chat", 1));
  assert.equal(cueCacheKey({ ...state, phase: "locked" }, "chat", 0), null);
});

test("AI runtime defaults off even if a provider key exists", async () => {
  await assert.rejects(
    () => generateGameCue({ OPENAI_API_KEY: "do-not-send" }, state, "chat", async () => { throw new Error("must not call"); }),
    /not enabled/
  );
});

test("game cue is sanitized and provider evidence never authorizes gameplay", async () => {
  const cue = await generateGameCue({ SYNC_AI_GAME_ENABLED: "true", SYNC_AI_GAME_PROVIDER: "openai" }, state, "chat",
    async (_env, input) => {
      assert.equal(input.source, "system");
      assert.equal(input.sensitivity, "standard");
      assert.equal(input.provider, "openai");
      return { text: "<script>alert(1)</script>\n  Nice pick!", provider: "openai", model: "sample", evidenceRef: "provider:openai:test" };
    });
  assert.equal(cue.authority, "none");
  assert.equal(cue.edition, "chat");
  assert.doesNotMatch(cue.text, /[<>\n]/);
  assert.equal(cue.evidenceRef, "provider:openai:test");
});
