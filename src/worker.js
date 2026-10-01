import { DurableObject } from "cloudflare:workers";
import { advance, createRoomState, joinPlayer, publicFingerprint, publicState, revealRound, startGame, submitChoice } from "./game.js";
import { ANALYTICS_TRUTH_VERSION, campaignKey, classifyClientTraffic, normalizeGrowthEnvelope, normalizeGrowthEvent } from "./growth-contract.js";
import { buildControlRoomEnvelope, fetchControlRoomSnapshot, recordControlRoomCommit } from "./control-room.js";
export { ControlRoomLedger } from "./control-room.js";
export { GrowthLedger } from "./growth-ledger.js";

const enc = new TextEncoder();
const MAX_MESSAGE_BYTES = 2048;
const GROWTH_V2_PREFIX = `${ANALYTICS_TRUTH_VERSION}:`;
const GROWTH_V2_ALL = `${GROWTH_V2_PREFIX}all`;
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
const sessionKey = (playerId) => `session:${playerId}`;
const growthKey = (playerId) => `growth:${playerId}`;
const participationKey = "growth:active-game-participants";

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify(stable(value)))));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

function messageBytes(message) {
  if (typeof message === "string") return enc.encode(message).byteLength;
  if (message instanceof ArrayBuffer) return message.byteLength;
  if (ArrayBuffer.isView(message)) return message.byteLength;
  return MAX_MESSAGE_BYTES + 1;
}

function requestTrafficClass(request) {
  return classifyClientTraffic({
    user_agent: request.headers.get("user-agent"),
    sec_fetch_site: request.headers.get("sec-fetch-site"),
    sec_ch_ua: request.headers.get("sec-ch-ua")
  });
}

function v2CampaignObjectName(key) {
  return `${GROWTH_V2_PREFIX}campaign:${key}`;
}

async function writeGrowthLedger(env, objectName, event, scope) {
  const stub = env.GROWTH.get(env.GROWTH.idFromName(objectName));
  const response = await stub.fetch(new Request("https://growth.internal/internal/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, scope })
  }));
  if (!response.ok) throw new Error(`Growth ledger rejected event (${response.status})`);
  return response.json();
}

async function recordGrowth(env, input, options = {}) {
  if (!env.GROWTH) return null;
  const event = normalizeGrowthEvent({
    ...input,
    event_id: input?.event_id || makeId("ge")
  }, options);
  const key = campaignKey(event);

  const allReceipt = await writeGrowthLedger(env, GROWTH_V2_ALL, event, { type: "all", key: "all" });
  let campaignRollup = true;
  try {
    await writeGrowthLedger(env, v2CampaignObjectName(key), event, { type: "campaign", key });
  } catch {
    campaignRollup = false;
  }

  return { ...allReceipt, campaign_key: key, campaign_rollup: campaignRollup };
}

async function readGrowthSummary(env, { campaign = null, legacy = false } = {}) {
  if (legacy) {
    const legacyKey = campaign || "unattributed";
    const stub = env.GROWTH.get(env.GROWTH.idFromName(legacyKey));
    const response = await stub.fetch(new Request("https://growth.internal/internal/summary"));
    const body = await response.json().catch(() => ({}));
    return {
      ...body,
      measurement_version: "legacy-v1",
      legacy: true,
      legacy_merged: false,
      scope: { type: "campaign", key: legacyKey }
    };
  }

  const scope = campaign ? { type: "campaign", key: campaign } : { type: "all", key: "all" };
  const objectName = campaign ? v2CampaignObjectName(campaign) : GROWTH_V2_ALL;
  const stub = env.GROWTH.get(env.GROWTH.idFromName(objectName));
  const query = new URLSearchParams({ scope: scope.type, key: scope.key });
  const response = await stub.fetch(new Request(`https://growth.internal/internal/summary?${query}`));
  return response.json();
}

function controlReadKey(request) {
  const direct = request.headers.get("x-sync-control-room-key");
  if (direct) return direct;
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/version" && request.method === "GET") {
      return json({
        service: "sync-party-game",
        sha: env.DEPLOY_SHA || null,
        build: env.DEPLOY_BUILD || null
      }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/control-room/snapshot" && request.method === "GET") {
      try {
        const snapshot = await fetchControlRoomSnapshot(env, false);
        return json(buildControlRoomEnvelope(env, snapshot), { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return json({ error: error.message || "Control room unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/control-room/export" && request.method === "GET") {
      if (!env.CONTROL_ROOM_READ_KEY) {
        return json({ error: "Protected control-room export is not configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      if (controlReadKey(request) !== env.CONTROL_ROOM_READ_KEY) {
        return json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      }
      try {
        const snapshot = await fetchControlRoomSnapshot(env, true);
        return json(buildControlRoomEnvelope(env, snapshot, { exportMode: true }), { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return json({ error: error.message || "Control room export unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/api/growth/event" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      try {
        const evidenceClass = requestTrafficClass(request);
        const receipt = await recordGrowth(env, body, { publicOnly: true, evidenceClass });
        if (!receipt) return json({ error: "Growth ledger unavailable" }, { status: 503 });
        return json(receipt, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return json({ error: error.message || "Invalid growth event" }, { status: 400 });
      }
    }

    if (url.pathname === "/api/growth/summary" && request.method === "GET") {
      if (!env.GROWTH_READ_KEY) return json({ error: "Growth summary is not configured" }, { status: 503 });
      if (request.headers.get("x-growth-read-key") !== env.GROWTH_READ_KEY) return json({ error: "Unauthorized" }, { status: 401 });
      const campaign = normalizeGrowthEnvelope({ campaign_id: url.searchParams.get("campaign") }).campaign_id;
      const legacy = url.searchParams.get("version") === "legacy";
      return json(await readGrowthSummary(env, { campaign, legacy }), { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/rooms/create" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const name = cleanName(body.name);
      if (!name) return json({ error: "Nickname required" }, { status: 400 });
      const code = roomCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const growth = normalizeGrowthEnvelope({ ...body.growth, traffic_class: requestTrafficClass(request) });
      return stub.fetch(new Request(`${url.origin}/internal/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name, growth })
      }));
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})\/(join|ws)$/);
    if (match) {
      const [, code, action] = match;
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const target = new URL(request.url);
      target.pathname = `/internal/${action}`;

      if (action === "join" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const growth = normalizeGrowthEnvelope({ ...body.growth, traffic_class: requestTrafficClass(request) });
        return stub.fetch(new Request(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, growth })
        }));
      }

      return stub.fetch(new Request(target, request));
    }

    return env.ASSETS.fetch(request);
  }
};

function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 18) : "";
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/internal/create" && request.method === "POST") {
      const existing = await this.ctx.storage.get("state");
      if (existing) return json({ error: "Room collision" }, { status: 409 });
      const { code, name, growth } = await request.json();
      const player = { id: makeId("p"), name: cleanName(name), resumeToken: makeId("r"), connected: false };
      await this.ctx.storage.put(growthKey(player.id), normalizeGrowthEnvelope(growth));
      let state = createRoomState(code, player);
      state = await this.commit(state, "ROOM_CREATED", player.id);
      return json({ code, playerId: player.id, resumeToken: player.resumeToken, host: true });
    }

    if (url.pathname === "/internal/join" && request.method === "POST") {
      let state = await this.ctx.storage.get("state");
      if (!state) return json({ error: "Room not found" }, { status: 404 });
      const body = await request.json().catch(() => ({}));
      const name = cleanName(body.name);
      if (!name) return json({ error: "Nickname required" }, { status: 400 });
      const player = { id: makeId("p"), name, resumeToken: makeId("r"), connected: false };
      try {
        state = joinPlayer(state, player);
      } catch (error) {
        return json({ error: error.message }, { status: 409 });
      }
      await this.ctx.storage.put(growthKey(player.id), normalizeGrowthEnvelope(body.growth));
      state = await this.commit(state, "PLAYER_JOINED", player.id);
      this.broadcast(state);
      return json({ code: state.code, playerId: player.id, resumeToken: player.resumeToken, host: false });
    }

    if (url.pathname === "/internal/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected websocket", { status: 426 });
      let state = await this.ctx.storage.get("state");
      if (!state) return new Response("Room not found", { status: 404 });

      const playerId = url.searchParams.get("playerId");
      const token = url.searchParams.get("token");
      const player = state.players[playerId];
      if (!player || player.resumeToken !== token) return new Response("Invalid player", { status: 401 });

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const connectionId = makeId("c");
      server.serializeAttachment({ playerId, connectionId });
      this.ctx.acceptWebSocket(server);

      await this.ctx.storage.put(sessionKey(playerId), connectionId);
      if (!player.connected) {
        state = { ...state, players: { ...state.players, [playerId]: { ...player, connected: true } } };
        state = await this.commit(state, "PLAYER_CONNECTED", playerId);
      } else {
        state = await this.commit(state, "PLAYER_RECONNECTED", playerId);
      }

      for (const socket of this.ctx.getWebSockets()) {
        if (socket === server) continue;
        try {
          const attachment = socket.deserializeAttachment() || {};
          if (attachment.playerId === playerId && attachment.connectionId !== connectionId) {
            socket.close(4001, "Session replaced");
          }
        } catch {}
      }

      this.broadcast(state);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws, message) {
    let state = await this.ctx.storage.get("state");
    if (!state) return;
    const { playerId, connectionId } = ws.deserializeAttachment() || {};
    const activeConnectionId = playerId ? await this.ctx.storage.get(sessionKey(playerId)) : null;
    if (!playerId || !connectionId || activeConnectionId !== connectionId || !state.players?.[playerId]?.connected) {
      return this.sendError(ws, "Stale session");
    }
    if (messageBytes(message) > MAX_MESSAGE_BYTES) {
      try { ws.close(1009, "Message too large"); } catch {}
      return;
    }

    let action;
    try {
      action = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return this.sendError(ws, "Bad message");
    }

    try {
      if (action.type === "START_GAME") {
        state = startGame(state, playerId);
        state = await this.commit(state, "GAME_STARTED", playerId);
        await this.ctx.storage.setAlarm(state.deadline);
      } else if (action.type === "SUBMIT_CHOICE") {
        state = submitChoice(state, playerId, action.choiceIndex);
        state = await this.commit(state, "ANSWER_LOCKED", playerId);

        const activeIds = Object.values(state.players).filter((player) => player.connected).map((player) => player.id);
        const allActiveAnswered = activeIds.length >= 2 && activeIds.every((id) => Object.prototype.hasOwnProperty.call(state.answers, id));
        if (allActiveAnswered) {
          state = revealRound(state);
          state = await this.commit(state, "ROUND_REVEALED", "system");
          await this.ctx.storage.deleteAlarm();
        }
      } else if (action.type === "NEXT_ROUND") {
        state = advance(state, playerId);
        state = await this.commit(state, state.phase === "results" ? "GAME_FINISHED" : "ROUND_STARTED", playerId);
        if (state.deadline) await this.ctx.storage.setAlarm(state.deadline);
      } else if (action.type === "REMATCH") {
        if (state.phase !== "results") throw new Error("Cannot rematch now");
        state = startGame(state, playerId);
        state = await this.commit(state, "REMATCH_STARTED", playerId);
        await this.ctx.storage.setAlarm(state.deadline);
      } else if (action.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG", at: Date.now() }));
        return;
      } else {
        return this.sendError(ws, "Unknown action");
      }

      this.broadcast(state);
    } catch (error) {
      this.sendError(ws, error.message || "Action failed");
    }
  }

  async webSocketClose(ws) {
    const { playerId, connectionId } = ws.deserializeAttachment() || {};
    let state = await this.ctx.storage.get("state");
    if (!state?.players?.[playerId]) return;

    const activeConnectionId = await this.ctx.storage.get(sessionKey(playerId));
    if (!connectionId || activeConnectionId !== connectionId) return;

    const stillConnected = this.ctx.getWebSockets().some((socket) => {
      if (socket === ws) return false;
      try {
        const attachment = socket.deserializeAttachment() || {};
        return attachment.playerId === playerId && attachment.connectionId === connectionId;
      } catch { return false; }
    });
    if (stillConnected || !state.players[playerId].connected) return;

    await this.ctx.storage.delete(sessionKey(playerId));
    state = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], connected: false } } };
    state = await this.commit(state, "PLAYER_DISCONNECTED", playerId);
    this.broadcast(state);
  }

  async alarm() {
    let state = await this.ctx.storage.get("state");
    if (!state || state.phase !== "choosing") return;
    state = revealRound(state);
    state = await this.commit(state, "ROUND_REVEALED_TIMEOUT", "system");
    this.broadcast(state);
  }

  async recordGrowthForCommit(event, actor, state) {
    const gameEvent = {
      ROOM_CREATED: "room_created",
      PLAYER_JOINED: "room_joined",
      GAME_STARTED: "game_started",
      GAME_FINISHED: "game_finished",
      REMATCH_STARTED: "rematch_started"
    }[event];
    if (!gameEvent) return;

    const actorGrowth = (await this.ctx.storage.get(growthKey(actor))) || {};
    try {
      await recordGrowth(this.env, {
        event: gameEvent,
        growth: actorGrowth,
        game_seq: state.seq,
        event_id: makeId("ge")
      });
    } catch {
      // Growth evidence must never block or mutate gameplay authority.
    }

    const participantEvent = {
      GAME_STARTED: "player_game_started",
      GAME_FINISHED: "player_game_finished",
      REMATCH_STARTED: "player_rematch_started"
    }[event];
    if (!participantEvent) return;

    let participantIds;
    if (event === "GAME_STARTED" || event === "REMATCH_STARTED") {
      participantIds = Object.values(state.players).filter((player) => player.connected).map((player) => player.id);
      await this.ctx.storage.put(participationKey, participantIds);
    } else {
      participantIds = (await this.ctx.storage.get(participationKey)) || Object.keys(state.players);
    }

    for (const playerId of participantIds) {
      const growth = (await this.ctx.storage.get(growthKey(playerId))) || {};
      try {
        await recordGrowth(this.env, {
          event: participantEvent,
          growth,
          game_seq: state.seq,
          event_id: makeId("ge")
        });
      } catch {
        // Per-player conversion evidence is observational only.
      }
    }

    if (event === "GAME_FINISHED") await this.ctx.storage.delete(participationKey);
  }

  async commit(state, event, actor) {
    const previousStateHash = state.stateHash || null;
    const next = { ...state, seq: state.seq + 1 };
    const stateHash = await hash(publicFingerprint(next));
    const committed = { ...next, stateHash };
    const receipts = (await this.ctx.storage.get("receipts")) || [];
    receipts.push({
      event,
      actor,
      room: committed.code,
      gameVersion: committed.gameVersion,
      seq: committed.seq,
      previousStateHash,
      stateHash,
      at: Date.now()
    });
    await this.ctx.storage.put({ state: committed, receipts: receipts.slice(-128) });
    await this.recordGrowthForCommit(event, actor, committed);
    try {
      await recordControlRoomCommit(this.env, committed, event, actor);
    } catch {
      // Control telemetry is observational and must never become gameplay authority.
    }
    return committed;
  }

  broadcast(state) {
    const payload = JSON.stringify({ type: "STATE", state: publicState(state), serverTime: Date.now() });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch {}
    }
  }

  sendError(ws, error) {
    try { ws.send(JSON.stringify({ type: "ERROR", error })); } catch {}
  }
}
