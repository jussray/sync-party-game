import { DurableObject } from "cloudflare:workers";
import { advance, createRoomState, joinPlayer, publicFingerprint, publicState, revealRound, startGame, submitChoice } from "./game.js";

const enc = new TextEncoder();
const MAX_MESSAGE_BYTES = 2048;
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
const sessionKey = (playerId) => `session:${playerId}`;

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

    if (url.pathname === "/api/rooms/create" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const name = cleanName(body.name);
      if (!name) return json({ error: "Nickname required" }, { status: 400 });
      const code = roomCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request(`${url.origin}/internal/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name })
      }));
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})\/(join|ws)$/);
    if (match) {
      const [, code, action] = match;
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const target = new URL(request.url);
      target.pathname = `/internal/${action}`;
      return stub.fetch(new Request(target, request));
    }

    return env.ASSETS.fetch(request);
  }
};

function cleanName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 18) : "";
}

export class GameRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/internal/create" && request.method === "POST") {
      const existing = await this.ctx.storage.get("state");
      if (existing) return json({ error: "Room collision" }, { status: 409 });
      const { code, name } = await request.json();
      const player = { id: makeId("p"), name: cleanName(name), resumeToken: makeId("r"), connected: false };
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
