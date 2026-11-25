import baseWorker, { ControlRoomLedger, GameRoom, GrowthLedger, LeaderboardLedger } from "./worker.js";
import { invokeProvider, providerStates } from "./provider-runtime.js";
import { AiBudget } from "./ai-budget.js";
import { buildSurfaceManifest, isAllowedClientOrigin, listSurfaceProfiles } from "./surfaces.js";

export { ControlRoomLedger, GameRoom, GrowthLedger, LeaderboardLedger, AiBudget };

const SDK_PATH = "/sync-client.js";
const API_PREFIX = "/api/";
// The public leaderboard is anonymous, read-only data. Only the Juss & Co Game Hub
// origins may read it cross-origin; every other API keeps the strict origin gate.
const LEADERBOARD_PATH = "/api/leaderboard";
const LEADERBOARD_READ_ORIGINS = new Set([
  "https://games.jussco.company",
  "https://www.jussco.company",
  "https://jussco.company"
]);

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-sync-surface",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
}

function withCors(response, origin) {
  if (!origin || response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function sdkResponse(request, env) {
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("cache-control", "public, max-age=300");
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

function aiOperatorAuthorized(request, env) {
  if (!env.SYNC_AI_OPERATOR_KEY) return false;
  const direct = request.headers.get("x-sync-ai-key");
  const bearer = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  return (direct || bearer || "") === env.SYNC_AI_OPERATOR_KEY;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const isApi = url.pathname.startsWith(API_PREFIX);

    if (url.pathname === SDK_PATH && request.method === "GET") {
      return sdkResponse(request, env);
    }

    if (url.pathname === LEADERBOARD_PATH && origin && LEADERBOARD_READ_ORIGINS.has(origin) && (request.method === "GET" || request.method === "OPTIONS")) {
      const readHeaders = { "access-control-allow-origin": origin, "access-control-allow-methods": "GET", "access-control-max-age": "600", "vary": "Origin" };
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: readHeaders });
      const board = await baseWorker.fetch(request, env, ctx);
      const headers = new Headers(board.headers);
      for (const [key, value] of Object.entries(readHeaders)) headers.set(key, value);
      return new Response(board.body, { status: board.status, statusText: board.statusText, headers });
    }

    if (isApi && origin && !isAllowedClientOrigin(origin, url.origin)) {
      return json({ error: "Client origin is not allowed" }, { status: 403, headers: { "cache-control": "no-store" } });
    }

    if (isApi && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/surfaces" && request.method === "GET") {
      const response = json({
        surfaces: listSurfaceProfiles().map(({ id, label, presentation, shared_game }) => ({ id, label, presentation, shared_game }))
      }, { headers: { "cache-control": "no-store" } });
      return withCors(response, origin);
    }

    const surfaceMatch = url.pathname.match(/^\/api\/surfaces\/(cloudflare|chat)$/);
    if (surfaceMatch && request.method === "GET") {
      const manifest = await buildSurfaceManifest(surfaceMatch[1], url.origin);
      return withCors(json(manifest, { headers: { "cache-control": "no-store" } }), origin);
    }

    if (url.pathname === "/api/control-room/providers" && request.method === "GET") {
      if (!env.SYNC_AI_OPERATOR_KEY) return json({ error: "AI operator lane is not configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      if (!aiOperatorAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      return json({ service: "sync-party-game", providers: providerStates(env), authority: "none" }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/control-room/providers/invoke" && request.method === "POST") {
      if (!env.SYNC_AI_OPERATOR_KEY) return json({ error: "AI operator lane is not configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      if (!aiOperatorAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      const body = await request.json().catch(() => ({}));
      try {
        const result = await invokeProvider(env, body);
        return json({ service: "sync-party-game", sha: env.DEPLOY_SHA || null, result }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Provider invocation failed" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }

    const response = await baseWorker.fetch(request, env, ctx);
    return isApi ? withCors(response, origin) : response;
  }
};