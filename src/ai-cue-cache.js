// Call this inside DurableObjectState.blockConcurrencyWhile: one quota debit per unique cue.
export async function reserveAiCue(storage, key, limit, now = Date.now()) {
  const existing = await storage.get(key);
  if (existing) return existing;
  const used = (await storage.get("ai:used")) || 0;
  if (used >= limit) return { status: "quota" };
  await storage.put("ai:used", used + 1);
  await storage.put(key, { status: "pending", at: now });
  return { status: "reserved" };
}
