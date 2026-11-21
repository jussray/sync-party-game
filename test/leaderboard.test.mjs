import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// leaderboard.js imports cloudflare:workers for the Durable Object; stub it for node --test.
const source = readFileSync(new URL("../src/leaderboard.js", import.meta.url), "utf8")
  .replace('import { DurableObject } from "cloudflare:workers";', "class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }")
  .replace('from "./game.js"', `from "${new URL("../src/game.js", import.meta.url).href}"`);
const lb = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const finished = (overrides = {}) => ({
  phase: "results",
  code: "ABCDE",
  rounds: 3,
  syncHistory: [100, 50, 75],
  players: { p_1: { id: "p_1", name: "Ava" }, p_2: { id: "p_2", name: "Ben" } },
  scores: { p_1: 6, p_2: 3 },
  answers: { p_1: 0, p_2: 1 },
  lastResults: { totalAnswers: 2, winners: ["p_1"] },
  ...overrides
});

test("entry carries only anonymous numbers and a UTC day", () => {
  const entry = lb.leaderboardEntry(finished(), Date.UTC(2026, 10, 21, 23, 59));
  assert.deepEqual(entry, { sync: 75, players: 2, rounds: 3, day: "2026-11-21" });
  const text = JSON.stringify(entry);
  for (const secret of ["ABCDE", "Ava", "Ben", "p_1", "p_2"]) assert.equal(text.includes(secret), false, secret);
});

test("only complete games with 2+ answering players qualify", () => {
  assert.equal(lb.leaderboardEntry(finished({ phase: "reveal" })), null);
  assert.equal(lb.leaderboardEntry(finished({ syncHistory: [100, 100] })), null);
  assert.equal(lb.leaderboardEntry(finished({ lastResults: { totalAnswers: 1 } })), null);
  assert.equal(lb.leaderboardEntry(finished({ lastResults: null })), null);
  assert.equal(lb.leaderboardEntry(null), null);
});

test("validEntry rejects extra fields, names and out-of-range values", () => {
  const ok = { sync: 80, players: 4, rounds: 5, day: "2026-11-21" };
  assert.deepEqual(lb.validEntry(ok), ok);
  assert.equal(lb.validEntry({ ...ok, name: "Ava" }), null);
  assert.equal(lb.validEntry({ ...ok, room: "ABCDE" }), null);
  assert.equal(lb.validEntry({ ...ok, sync: 101 }), null);
  assert.equal(lb.validEntry({ ...ok, players: 1 }), null);
  assert.equal(lb.validEntry({ ...ok, day: "<script>" }), null);
  assert.equal(lb.validEntry([ok]), null);
});

test("ranking: sync desc, then bigger room, then earlier day; capped at size", () => {
  let board = [];
  board = lb.insertEntry(board, { sync: 70, players: 2, rounds: 5, day: "2026-11-20" }).board;
  board = lb.insertEntry(board, { sync: 70, players: 6, rounds: 5, day: "2026-11-21" }).board;
  const result = lb.insertEntry(board, { sync: 90, players: 2, rounds: 5, day: "2026-11-21" });
  assert.equal(result.rank, 1);
  assert.deepEqual(result.board.map((e) => [e.sync, e.players]), [[90, 2], [70, 6], [70, 2]]);

  let full = Array.from({ length: lb.LEADERBOARD_SIZE }, () => ({ sync: 60, players: 2, rounds: 5, day: "2026-11-01" }));
  const low = lb.insertEntry(full, { sync: 10, players: 2, rounds: 5, day: "2026-11-21" });
  assert.equal(low.rank, null);
  assert.equal(low.board.length, lb.LEADERBOARD_SIZE);
  assert.equal(lb.insertEntry(full, { sync: 99, players: 2, rounds: 5, day: "2026-11-21" }).board.length, lb.LEADERBOARD_SIZE);
});

test("publicBoard drops corrupt rows and adds ranks", () => {
  const board = lb.publicBoard([{ sync: 50, players: 3, rounds: 5, day: "2026-11-21" }, { sync: 50, players: 3, rounds: 5, day: "2026-11-21", name: "x" }, null]);
  assert.equal(board.version, "sync-leaderboard-v1");
  assert.deepEqual(board.entries, [{ rank: 1, sync: 50, players: 3, rounds: 5, day: "2026-11-21" }]);
});

test("Durable Object records validated entries and serves the public board", async () => {
  const store = new Map();
  const ctx = { storage: { get: async (k) => store.get(k), put: async (obj) => { for (const [k, v] of Object.entries(obj)) store.set(k, v); } } };
  const ledger = new lb.LeaderboardLedger(ctx, {});
  const post = (body) => ledger.fetch(new Request("https://leaderboard.internal/internal/record", { method: "POST", body: JSON.stringify(body) }));
  assert.equal((await post({ sync: 80, players: 2, rounds: 5, day: "2026-11-21", room: "ABCDE" })).status, 400);
  const ok = await post({ sync: 80, players: 2, rounds: 5, day: "2026-11-21" });
  assert.deepEqual(await ok.json(), { rank: 1, size: 1 });
  const board = await (await ledger.fetch(new Request("https://leaderboard.internal/internal/board"))).json();
  assert.equal(board.entries.length, 1);
  assert.equal(typeof board.updated_at, "string");
});

const HUMANS = ["browser_signal", "browser_signal"];

test("recordLeaderboard is a no-op without the binding or a qualifying game", async () => {
  assert.equal(await lb.recordLeaderboard({}, finished(), HUMANS), null);
  let called = false;
  const env = { LEADERBOARD: { idFromName: () => "id", get: () => ({ fetch: async () => { called = true; return new Response("{}"); } }) } };
  assert.equal(await lb.recordLeaderboard(env, finished({ phase: "lobby" }), HUMANS), null);
  assert.equal(called, false);
});

test("only fully human-verified games reach the board; bots and unverified fail closed", async () => {
  assert.equal(lb.humanVerifiedGame(HUMANS), true);
  assert.equal(lb.humanVerifiedGame(["browser_signal", "automation_likely"]), false);
  assert.equal(lb.humanVerifiedGame(["browser_signal", "unverified_client"]), false);
  assert.equal(lb.humanVerifiedGame(["browser_signal", null]), false);
  assert.equal(lb.humanVerifiedGame(["browser_signal"]), false);
  assert.equal(lb.humanVerifiedGame(null), false);
  let calls = 0;
  const env = { LEADERBOARD: { idFromName: () => "id", get: () => ({ fetch: async () => { calls += 1; return new Response(JSON.stringify({ rank: 1 })); } }) } };
  assert.equal(await lb.recordLeaderboard(env, finished(), ["automation_likely", "automation_likely"]), null);
  assert.equal(calls, 0);
  assert.deepEqual(await lb.recordLeaderboard(env, finished(), HUMANS), { rank: 1 });
  assert.equal(calls, 1);
});

test("board storage moved off the bot-seeded v1 object", () => {
  assert.notEqual(lb.LEADERBOARD_OBJECT, "sync-leaderboard-v1");
  assert.equal(lb.LEADERBOARD_VERSION, "sync-leaderboard-v1");
});
