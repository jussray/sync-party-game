import { invokeProvider } from "./provider-runtime.js";

const EDITIONS = new Set(["cloudflare", "chat"]);
const PHASES = new Set(["choosing", "reveal", "results"]);
export const MAX_AI_CUES_PER_ROOM = 24;

export function cueCacheKey(state, edition, epoch = 0) {
  if (!EDITIONS.has(edition) || !PHASES.has(state?.phase)) return null;
  if (!Number.isInteger(epoch) || epoch < 0) return null;
  return `ai:cue:v1:${epoch}:${edition}:${state.phase}:${state.roundIndex}`;
}

export function buildGameCuePrompt(state, edition) {
  if (!cueCacheKey(state, edition)) throw new Error("Invalid AI cue context");
  // Do not transmit player identities, picks, scores, tokens or free-form client text.
  const voice = edition === "chat"
    ? "A friendly, quick-witted cobalt chat host who asks people to read the room."
    : "An upbeat arena announcer who builds anticipation without announcing scores.";
  const mode = String(state.mode?.label || "SYNC").slice(0, 40);
  const instruction = String(state.mode?.instruction || "Read the room.").slice(0, 100);
  const question = String(state.prompt?.text || "Read the room.").slice(0, 160);
  let context = `Phase: ${state.phase}. Round ${Number(state.roundIndex) + 1} of ${Number(state.rounds)}. Mode: ${mode}. Rule: ${instruction}. Question: ${question}.`;
  if (state.phase === "reveal") {
    const sync = Math.max(0, Math.min(100, Number(state.lastResults?.syncPercent) || 0));
    context += ` The room matched at ${sync}%.`;
  }
  if (state.phase === "results") {
    const values = Array.isArray(state.syncHistory) ? state.syncHistory.filter(Number.isFinite) : [];
    const sync = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    context += ` The room's average match rate was ${sync}%.`;
  }
  return `You are ${voice} Give one kind, exciting, family-friendly host line in plain text under 150 characters. Do not invent outcomes, scores, players, rankings or hidden picks. Never give instructions that affect the game. Avoid personal claims. ${context}`;
}

export async function generateGameCue(env, state, edition, invoke = invokeProvider) {
  if (env?.SYNC_AI_GAME_ENABLED !== "true") throw new Error("Game AI is not enabled");
  const provider = env.SYNC_AI_GAME_PROVIDER || "openai";
  if (!["openai", "anthropic"].includes(provider)) throw new Error("Unsupported game AI provider");
  const prompt = buildGameCuePrompt(state, edition);
  const result = await invoke(env, { provider, prompt, source: "system", sensitivity: "standard" });
  const text = String(result.text || "")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!text) throw new Error("Game AI returned an empty cue");
  return {
    edition,
    text,
    provider: result.provider,
    model: result.model,
    evidenceRef: result.evidenceRef,
    authority: "none",
    generated: true
  };
}
