import { test, expect } from "@playwright/test";

async function apiCreate(page, name) {
  return page.evaluate(async (nickname) => {
    const response = await fetch("/api/rooms/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nickname })
    });
    if (!response.ok) throw new Error(`create failed: ${response.status}`);
    return response.json();
  }, name);
}

async function apiJoin(page, code, name) {
  return page.evaluate(async ({ roomCode, nickname }) => {
    const response = await fetch(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nickname })
    });
    if (!response.ok) throw new Error(`join failed: ${response.status}`);
    return response.json();
  }, { roomCode: code, nickname: name });
}

async function openRawSocket(page, key, code, identity) {
  await page.evaluate(({ socketKey, roomCode, playerId, resumeToken }) => new Promise((resolve, reject) => {
    window.__syncProofSockets ||= {};
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${roomCode}/ws?playerId=${encodeURIComponent(playerId)}&token=${encodeURIComponent(resumeToken)}`);
    const record = { ws, messages: [], closes: [] };
    window.__syncProofSockets[socketKey] = record;
    ws.onmessage = (event) => {
      try { record.messages.push(JSON.parse(event.data)); }
      catch { record.messages.push({ type: "RAW", data: event.data }); }
    };
    ws.onclose = (event) => record.closes.push({ code: event.code, reason: event.reason });
    ws.onerror = () => reject(new Error(`socket ${socketKey} failed`));
    ws.onopen = () => resolve();
  }), {
    socketKey: key,
    roomCode: code,
    playerId: identity.playerId,
    resumeToken: identity.resumeToken
  });
}

async function sendRaw(page, key, payload) {
  await page.evaluate(({ socketKey, message }) => {
    window.__syncProofSockets[socketKey].ws.send(message);
  }, { socketKey: key, message: typeof payload === "string" ? payload : JSON.stringify(payload) });
}

async function hasMessage(page, key, predicate) {
  return page.evaluate(({ socketKey, kind, includes, phase }) => {
    const messages = window.__syncProofSockets?.[socketKey]?.messages || [];
    return messages.some((message) => {
      if (kind && message.type !== kind) return false;
      if (includes && !String(message.error || "").includes(includes)) return false;
      if (phase && message.state?.phase !== phase) return false;
      return true;
    });
  }, predicate);
}

test("server rejects guest host-actions and revokes the previous socket on reconnect", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto("/");
  await guest.goto("/");

  const created = await apiCreate(host, "AuthorityHost");
  const joined = await apiJoin(guest, created.code, "AuthorityGuest");

  await openRawSocket(host, "host1", created.code, created);
  await openRawSocket(guest, "guest1", created.code, joined);

  await expect.poll(() => hasMessage(host, "host1", { kind: "STATE" })).toBe(true);
  await expect.poll(() => hasMessage(guest, "guest1", { kind: "STATE" })).toBe(true);

  await sendRaw(guest, "guest1", { type: "START_GAME" });
  await expect.poll(() => hasMessage(guest, "guest1", { kind: "ERROR", includes: "Only the host" })).toBe(true);
  expect(await hasMessage(host, "host1", { kind: "STATE", phase: "choosing" })).toBe(false);

  await sendRaw(host, "host1", { type: "START_GAME" });
  await expect.poll(() => hasMessage(host, "host1", { kind: "STATE", phase: "choosing" })).toBe(true);
  await expect.poll(() => hasMessage(guest, "guest1", { kind: "STATE", phase: "choosing" })).toBe(true);

  await openRawSocket(host, "host2", created.code, created);
  await expect.poll(() => host.evaluate(() => window.__syncProofSockets.host1.closes.some((entry) => entry.code === 4001 && entry.reason === "Session replaced"))).toBe(true);
  expect(await host.evaluate(() => window.__syncProofSockets.host1.ws.readyState)).toBe(WebSocket.CLOSED);

  await sendRaw(host, "host2", { type: "PING" });
  await expect.poll(() => hasMessage(host, "host2", { kind: "PONG" })).toBe(true);

  await hostContext.close();
  await guestContext.close();
});

test("oversized websocket messages are closed before JSON parsing", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  const created = await apiCreate(page, "SizeGuard");
  await openRawSocket(page, "size", created.code, created);
  await sendRaw(page, "size", "x".repeat(2050));
  await expect.poll(() => page.evaluate(() => window.__syncProofSockets.size.closes.some((entry) => entry.code === 1009))).toBe(true);
  await context.close();
});