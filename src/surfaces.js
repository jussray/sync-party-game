export const SURFACE_CONTRACT_VERSION = "sync-surface-v1";
export const CHAT_SITE_ORIGIN = "https://sync-party.p9s5nbwqyt.chatgpt.site";

const SHARED_GAME = Object.freeze({
  authority: "cloudflare-durable-object",
  protocol: "sync-room-v1",
  ruleset: "sync-party-five-round-v1",
  same_room_cross_surface: true,
  authoritative_rule_changes_require_room_contract: true
});

const PROFILES = Object.freeze({
  cloudflare: Object.freeze({
    id: "cloudflare",
    label: "Cloudflare game",
    presentation: Object.freeze({
      id: "cloudflare-party",
      mutable: true,
      entrypoint: "/",
      mirror_target: null
    }),
    shared_game: SHARED_GAME,
    surface_capabilities: Object.freeze([
      "custom-theme",
      "custom-layout",
      "custom-copy",
      "party-sound",
      "control-room-linkage"
    ])
  }),
  chat: Object.freeze({
    id: "chat",
    label: "Chat-site game",
    presentation: Object.freeze({
      id: "chat-party",
      mutable: true,
      entrypoint: "/chat/index.html",
      mirror_target: CHAT_SITE_ORIGIN
    }),
    shared_game: SHARED_GAME,
    surface_capabilities: Object.freeze([
      "custom-theme",
      "custom-layout",
      "custom-copy",
      "party-sound",
      "surface-experiments"
    ])
  })
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getSurfaceProfile(id) {
  const profile = PROFILES[id];
  return profile ? clone(profile) : null;
}

export function listSurfaceProfiles() {
  return Object.keys(PROFILES).map((id) => getSurfaceProfile(id));
}

export function isAllowedClientOrigin(origin, requestOrigin) {
  if (!origin) return true;
  if (origin === requestOrigin) return true;
  return origin === CHAT_SITE_ORIGIN;
}

export async function surfaceFingerprint(profile) {
  const encoded = new TextEncoder().encode(JSON.stringify(stable({
    contract: SURFACE_CONTRACT_VERSION,
    profile
  })));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function buildSurfaceManifest(id, requestOrigin) {
  const profile = getSurfaceProfile(id);
  if (!profile) return null;
  const wsOrigin = requestOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return {
    contract: SURFACE_CONTRACT_VERSION,
    ...profile,
    endpoints: {
      api_origin: requestOrigin,
      ws_origin: wsOrigin,
      sdk: `${requestOrigin}/sync-client.js`
    },
    fingerprint: await surfaceFingerprint(profile)
  };
}
