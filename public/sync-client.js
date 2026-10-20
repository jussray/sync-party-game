function normalizeBase(value) {
  return String(value || "").replace(/\/$/, "");
}

export function inferSyncSurface(hostname = globalThis.location?.hostname || "") {
  return hostname.endsWith(".chatgpt.site") ? "chat" : "cloudflare";
}

export function createSyncClient(options = {}) {
  const baseUrl = normalizeBase(options.baseUrl || globalThis.location?.origin);
  if (!baseUrl) throw new Error("Sync API base URL is required");

  const surface = options.surface || inferSyncSurface();
  const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
  if (!fetchImpl) throw new Error("fetch is required");

  const wsBase = baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const headers = { "content-type": "application/json", "x-sync-surface": surface };

  async function requestJson(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Sync request failed (${response.status})`);
    return body;
  }

  return Object.freeze({
    surface,
    baseUrl,
    async profile() {
      return requestJson(`/api/surfaces/${encodeURIComponent(surface)}`, { method: "GET" });
    },
    async createRoom({ name, growth = {} }) {
      return requestJson("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ name, growth, surface })
      });
    },
    async joinRoom({ code, name, growth = {} }) {
      const room = String(code || "").trim().toUpperCase();
      return requestJson(`/api/rooms/${encodeURIComponent(room)}/join`, {
        method: "POST",
        body: JSON.stringify({ name, growth, surface })
      });
    },
    async trackGrowth({ event, event_id, growth = {} }) {
      return requestJson("/api/growth/event", {
        method: "POST",
        body: JSON.stringify({ event, event_id, growth, surface })
      });
    },
    websocketUrl({ code, playerId, resumeToken }) {
      const room = String(code || "").trim().toUpperCase();
      const params = new URLSearchParams({
        playerId: String(playerId || ""),
        token: String(resumeToken || ""),
        surface
      });
      return `${wsBase}/api/rooms/${encodeURIComponent(room)}/ws?${params}`;
    },
    connect(identity) {
      if (!WebSocketImpl) throw new Error("WebSocket is required");
      return new WebSocketImpl(this.websocketUrl(identity));
    }
  });
}
