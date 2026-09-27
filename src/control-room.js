import { DurableObject } from "cloudflare:workers";

const enc = new TextEncoder();
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify(stable(value)))));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bump(record, key) {
  if (!key) return record;
  return { ...record, [key]: (record[key] || 0) + 1 };
}

function clampCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(32, Math.trunc(number)));
}

function continuityCookie(controlFingerprint, seq) {
  return `sync-control-v1.${controlFingerprint.slice(0, 16)}.${seq}`;
}

function emptySnapshot() {
  return {
    seq: 0,
    events_recorded: 0,
    rooms_observed: 0,
    active_rooms: 0,
    connected_players: 0,
    counters: {},
    first_at: null,
    last_at: null,
    recent_events: [],
    rooms: {},
    control_fingerprint: null,
    continuity_cookie: null
  };
}

function controlStub(env) {
  if (!env.CONTROL) return null;
  return env.CONTROL.get(env.CONTROL.idFromName("sync-control-room-v1"));
}

export async function recordControlRoomCommit(env, state, event, actor) {
  const stub = controlStub(env);
  if (!stub) return null;

  const players = Object.values(state?.players || {});
  const roomFingerprint = (await digest({ room: state?.code || "unknown" })).slice(0, 20);
  const payload = {
    event,
    actor_kind: actor === "system" ? "system" : "player",
    room_fingerprint: roomFingerprint,
    state_hash: typeof state?.stateHash === "string" ? state.stateHash : null,
    game_version: typeof state?.gameVersion === "string" ? state.gameVersion : null,
    game_seq: Number.isInteger(state?.seq) ? state.seq : 0,
    phase: typeof state?.phase === "string" ? state.phase.slice(0, 32) : "unknown",
    connected_players: players.filter((player) => player?.connected).length,
    total_players: players.length,
    at: Date.now()
  };

  const response = await stub.fetch(new Request("https://control.internal/internal/room-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }));
  if (!response.ok) throw new Error(`Control room ledger rejected event (${response.status})`);
  return response.json();
}

export async function fetchControlRoomSnapshot(env, detail = false) {
  const stub = controlStub(env);
  if (!stub) return detail ? emptySnapshot() : publicSnapshot(emptySnapshot());
  const response = await stub.fetch(new Request(`https://control.internal/internal/snapshot${detail ? "?detail=1" : ""}`));
  if (!response.ok) throw new Error(`Control room snapshot unavailable (${response.status})`);
  return response.json();
}

export function buildControlRoomEnvelope(env, snapshot, options = {}) {
  const exportMode = options.exportMode === true;
  const runtimeVerified = Boolean(env.DEPLOY_SHA && env.DEPLOY_BUILD);
  return {
    schema: "sync-control-room/v1",
    service: "sync-party-game",
    generated_at: Date.now(),
    runtime: {
      status: runtimeVerified ? "VERIFIED" : "LOCAL_OR_UNVERIFIED",
      sha: env.DEPLOY_SHA || null,
      build: env.DEPLOY_BUILD || null,
      platform: "cloudflare-workers"
    },
    authority: {
      repository: "jussray/sync-party-game",
      source_branch: "main",
      production_branch: "production",
      release_gate: "core-proof -> exact green SHA -> production",
      mutation_authority: "GitHub production branch + Cloudflare Workers Builds"
    },
    proof: {
      required: "Playwright",
      suite: "npm run test:e2e",
      exact_sha_runtime_contract: true,
      runtime_verified: runtimeVerified
    },
    relay: {
      target: "Founder Control Room",
      mode: exportMode ? "protected-export" : "privacy-safe-pull",
      endpoint: exportMode ? "/api/control-room/export" : "/api/control-room/snapshot",
      protected_export_configured: Boolean(env.CONTROL_ROOM_READ_KEY)
    },
    control: snapshot
  };
}

function publicSnapshot(snapshot) {
  const { rooms, ...safe } = snapshot || emptySnapshot();
  return safe;
}

function sanitizeEvent(input) {
  const event = typeof input?.event === "string" && /^[A-Z0-9_]{1,48}$/.test(input.event)
    ? input.event
    : "UNKNOWN";
  const roomFingerprint = typeof input?.room_fingerprint === "string" && /^[0-9a-f]{20,64}$/.test(input.room_fingerprint)
    ? input.room_fingerprint.slice(0, 20)
    : null;
  if (!roomFingerprint) throw new Error("room_fingerprint required");

  return {
    event,
    actor_kind: input?.actor_kind === "system" ? "system" : "player",
    room_fingerprint: roomFingerprint,
    state_hash: typeof input?.state_hash === "string" && /^[0-9a-f]{20,64}$/.test(input.state_hash) ? input.state_hash.slice(0, 64) : null,
    game_version: typeof input?.game_version === "string" ? input.game_version.slice(0, 40) : null,
    game_seq: Number.isInteger(input?.game_seq) ? Math.max(0, input.game_seq) : 0,
    phase: typeof input?.phase === "string" ? input.phase.slice(0, 32) : "unknown",
    connected_players: clampCount(input?.connected_players),
    total_players: clampCount(input?.total_players),
    at: Number.isFinite(Number(input?.at)) ? Number(input.at) : Date.now()
  };
}

export class ControlRoomLedger extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/internal/room-event" && request.method === "POST") {
      try {
        return json(await this.record(await request.json()));
      } catch (error) {
        return json({ error: error.message || "Invalid control event" }, { status: 400 });
      }
    }

    if (url.pathname === "/internal/snapshot" && request.method === "GET") {
      const snapshot = (await this.ctx.storage.get("snapshot")) || emptySnapshot();
      if (url.searchParams.get("detail") === "1") {
        return json({
          ...snapshot,
          rooms: Object.values(snapshot.rooms || {}).sort((a, b) => (b.last_at || 0) - (a.last_at || 0))
        });
      }
      return json(publicSnapshot(snapshot));
    }

    return new Response("Not found", { status: 404 });
  }

  async record(input) {
    const event = sanitizeEvent(input);
    const current = (await this.ctx.storage.get("snapshot")) || emptySnapshot();
    const seq = (current.seq || 0) + 1;
    const counters = bump(current.counters || {}, event.event);
    const room = {
      room_fingerprint: event.room_fingerprint,
      state_hash: event.state_hash,
      game_version: event.game_version,
      game_seq: event.game_seq,
      phase: event.phase,
      connected_players: event.connected_players,
      total_players: event.total_players,
      last_event: event.event,
      last_at: event.at
    };

    const roomMap = { ...(current.rooms || {}), [event.room_fingerprint]: room };
    const retainedRooms = Object.values(roomMap)
      .sort((a, b) => (b.last_at || 0) - (a.last_at || 0))
      .slice(0, 256);
    const rooms = Object.fromEntries(retainedRooms.map((entry) => [entry.room_fingerprint, entry]));
    const activeRooms = retainedRooms.filter((entry) => entry.connected_players > 0).length;
    const connectedPlayers = retainedRooms.reduce((total, entry) => total + (entry.connected_players || 0), 0);
    const eventFingerprint = await digest(event);
    const recentEvents = [
      ...(current.recent_events || []),
      {
        seq,
        event: event.event,
        actor_kind: event.actor_kind,
        room_fingerprint: event.room_fingerprint,
        state_hash: event.state_hash,
        game_seq: event.game_seq,
        phase: event.phase,
        connected_players: event.connected_players,
        at: event.at,
        event_fingerprint: eventFingerprint
      }
    ].slice(-64);

    const fingerprintInput = {
      seq,
      counters,
      active_rooms: activeRooms,
      connected_players: connectedPlayers,
      rooms: retainedRooms,
      last_at: event.at
    };
    const controlFingerprint = await digest(fingerprintInput);
    const snapshot = {
      seq,
      events_recorded: seq,
      rooms_observed: counters.ROOM_CREATED || 0,
      active_rooms: activeRooms,
      connected_players: connectedPlayers,
      counters,
      first_at: current.first_at || event.at,
      last_at: event.at,
      recent_events: recentEvents,
      rooms,
      control_fingerprint: controlFingerprint,
      continuity_cookie: continuityCookie(controlFingerprint, seq)
    };

    await this.ctx.storage.put("snapshot", snapshot);
    return {
      accepted: true,
      seq,
      event_fingerprint: eventFingerprint,
      control_fingerprint: controlFingerprint,
      continuity_cookie: snapshot.continuity_cookie
    };
  }
}
