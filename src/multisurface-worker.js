import baseWorker, { ControlRoomLedger, GameRoom, GrowthLedger } from "./worker.js";
import { buildSurfaceManifest, isAllowedClientOrigin, listSurfaceProfiles } from "./surfaces.js";

export { ControlRoomLedger, GameRoom, GrowthLedger };

const SDK_PATH = "/sync-client.js";
const API_PREFIX = "/api/";

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const isApi = url.pathname.startsWith(API_PREFIX);

    if (url.pathname === SDK_PATH && request.method === "GET") {
      return sdkResponse(request, env);
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

    const response = await baseWorker.fetch(request, env, ctx);
    return isApi ? withCors(response, origin) : response;
  }
};
