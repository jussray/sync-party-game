import { DurableObject } from "cloudflare:workers";
import { averageSync } from "./game.js";

// Public SYNC leaderboard: the best finished rooms by average room sync.
// Privacy contract: an entry holds only numbers and a UTC day. Never names,
// room codes, player ids, answers, tokens or exact timestamps.
export const LEADERBOARD_VERSION = "sync-leaderboard-v1";
// Storage object name. v2 starts a fresh board: v1 storage was seeded by CI
// production-proof bot games and is never served again.
export const LEADERBOARD_OBJECT = "sync-leaderboard-v2-human-verified";
export const LEADERBOARD_SIZE = 25;
export const MIN_ANSWERING_PLAYERS = 2;

const ENTRY_KEYS = "day,players,rounds,sync";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

function int(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

// Server-side only: built from the authoritative room state at GAME_FINISHED.
export function leaderboardEntry(state, now = Date.now()) {
  if (!state || state.phase !== "results") return null;
  const rounds = int(state.rounds, 1, 50);
  if (!rounds || state.syncHistory?.length !== rounds) return null;
  const players = int(state.lastResults?.totalAnswers, MIN_ANSWERING_PLAYERS, 64);
  if (!players) return null;
  return { sync: averageSync(state), players, rounds, day: new Date(now).toISOString().slice(0, 10) };
}

// Rejects anything that is not exactly the public shape.
export function validEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (Object.keys(entry).sort().join(",") !== ENTRY_KEYS) return null;
  const sync = int(entry.sync, 0, 100);
  const players = int(entry.players, MIN_ANSWERING_PLAYERS, 64);
  const rounds = int(entry.rounds, 1, 50);
  const day = typeof entry.day === "string" && DAY.test(entry.day) ? entry.day : null;
  if (sync === null || !players || !rounds || !day) return null;
  return { sync, players, rounds, day };
}

// Higher sync wins; ties go to the bigger room (harder to sync), then the earlier day.
export function compareEntries(a, b) {
  return b.sync - a.sync || b.players - a.players || (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
}

export function insertEntry(board, entry) {
  const clean = validEntry(entry);
  const current = Array.isArray(board) ? board.map(validEntry).filter(Boolean) : [];
  if (!clean) return { board: current, rank: null };
  const next = [...current, clean].sort(compareEntries);
  const index = next.indexOf(clean);
  const kept = next.slice(0, LEADERBOARD_SIZE);
  return { board: kept, rank: index < LEADERBOARD_SIZE ? index + 1 : null };
}

export function publicBoard(board, updatedAt = null) {
  const entries = (Array.isArray(board) ? board.map(validEntry).filter(Boolean) : [])
    .sort(compareEntries)
    .slice(0, LEADERBOARD_SIZE)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  return { version: LEADERBOARD_VERSION, metric: "average_room_sync_percent", min_players: MIN_ANSWERING_PLAYERS, size: LEADERBOARD_SIZE, updated_at: updatedAt, entries };
}

// Only games where EVERY participant was server-classified as a real browser
// count. Automation (headless, Playwright, bots) or unverified clients keep a
// game off the public board, fail closed.
export function humanVerifiedGame(trafficClasses) {
  return Array.isArray(trafficClasses) && trafficClasses.length >= MIN_ANSWERING_PLAYERS &&
    trafficClasses.every((value) => value === "browser_signal");
}

export async function recordLeaderboard(env, state, trafficClasses, now = Date.now()) {
  if (!env.LEADERBOARD) return null;
  if (!humanVerifiedGame(trafficClasses)) return null;
  const entry = leaderboardEntry(state, now);
  if (!entry) return null;
  const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName(LEADERBOARD_OBJECT));
  const response = await stub.fetch(new Request("https://leaderboard.internal/internal/record", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry)
  }));
  if (!response.ok) throw new Error(`Leaderboard rejected entry (${response.status})`);
  return response.json();
}

export async function readLeaderboard(env) {
  if (!env.LEADERBOARD) return null;
  const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName(LEADERBOARD_OBJECT));
  const response = await stub.fetch(new Request("https://leaderboard.internal/internal/board"));
  if (!response.ok) throw new Error(`Leaderboard unavailable (${response.status})`);
  return response.json();
}

export class LeaderboardLedger extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/record" && request.method === "POST") {
      const entry = validEntry(await request.json().catch(() => null));
      if (!entry) return json({ error: "Invalid leaderboard entry" }, { status: 400 });
      const stored = (await this.ctx.storage.get("board")) || [];
      const { board, rank } = insertEntry(stored, entry);
      const updatedAt = new Date().toISOString();
      await this.ctx.storage.put({ board, updatedAt });
      return json({ rank, size: board.length });
    }
    if (url.pathname === "/internal/board" && request.method === "GET") {
      const [board, updatedAt] = await Promise.all([this.ctx.storage.get("board"), this.ctx.storage.get("updatedAt")]);
      return json(publicBoard(board || [], updatedAt || null));
    }
    return json({ error: "Not found" }, { status: 404 });
  }
}
