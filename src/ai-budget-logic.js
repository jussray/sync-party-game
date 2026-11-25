const DEFAULT_DAILY_LIMIT = 12;
const MAX_DAILY_LIMIT = 50;

export function dailyAiLimit(env = {}) {
  const raw = String(env.SYNC_AI_DAILY_BUDGET || "").trim();
  const requested = Number(raw);
  if (!raw || !Number.isSafeInteger(requested) || requested < 1) return DEFAULT_DAILY_LIMIT;
  return Math.min(MAX_DAILY_LIMIT, requested);
}

// Call under the Durable Object concurrency gate: atomic across all rooms.
export async function reserveDailyAiCall(storage, timestamp, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_DAILY_LIMIT) {
    throw new Error("Invalid global AI budget");
  }
  const day = new Date(timestamp).toISOString().slice(0, 10);
  const entry = (await storage.get("global-ai-daily")) || {};
  const used = entry.day === day ? entry.used : 0;
  if (!Number.isSafeInteger(used) || used < 0) throw new Error("Invalid AI budget state");
  if (used >= limit) return { status: "exhausted", used, remaining: 0 };
  await storage.put("global-ai-daily", { day, used: used + 1 });
  return { status: "reserved", used: used + 1, remaining: limit - used - 1 };
}
