import { test, expect } from "@playwright/test";

const CHAT_ORIGIN = "https://sync-party.p9s5nbwqyt.chatgpt.site";

test("Cloudflare and chat clients expose one shared game authority", async ({ request }) => {
  const cloudflareResponse = await request.get("/api/surfaces/cloudflare");
  const chatResponse = await request.get("/api/surfaces/chat", { headers: { origin: CHAT_ORIGIN } });
  expect(cloudflareResponse.ok()).toBeTruthy();
  expect(chatResponse.ok()).toBeTruthy();
  expect(chatResponse.headers()["access-control-allow-origin"]).toBe(CHAT_ORIGIN);

  const cloudflare = await cloudflareResponse.json();
  const chat = await chatResponse.json();
  expect(cloudflare.shared_game).toEqual(chat.shared_game);
  expect(cloudflare.presentation.id).not.toBe(chat.presentation.id);
  expect(cloudflare.fingerprint).not.toBe(chat.fingerprint);
  expect(chat.shared_game.same_room_cross_surface).toBe(true);
});

test("chat-site origin can create and join the same authoritative room", async ({ request }) => {
  const create = await request.post("/api/rooms/create", {
    headers: { origin: CHAT_ORIGIN, "content-type": "application/json", "x-sync-surface": "chat" },
    data: { name: "ChatHost", surface: "chat" }
  });
  expect(create.ok()).toBeTruthy();
  expect(create.headers()["access-control-allow-origin"]).toBe(CHAT_ORIGIN);
  const room = await create.json();

  const join = await request.post(`/api/rooms/${room.code}/join`, {
    headers: { origin: CHAT_ORIGIN, "content-type": "application/json", "x-sync-surface": "chat" },
    data: { name: "ChatGuest", surface: "chat" }
  });
  expect(join.ok()).toBeTruthy();
  expect(join.headers()["access-control-allow-origin"]).toBe(CHAT_ORIGIN);
  const guest = await join.json();
  expect(guest.code).toBe(room.code);
});

test("surface gateway permits the known chat origin and rejects unknown cross-origin clients", async ({ request }) => {
  const preflight = await request.fetch("/api/rooms/create", {
    method: "OPTIONS",
    headers: {
      origin: CHAT_ORIGIN,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-sync-surface"
    }
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe(CHAT_ORIGIN);

  const denied = await request.get("/api/surfaces/chat", { headers: { origin: "https://example.com" } });
  expect(denied.status()).toBe(403);
});

test("shared client SDK is importable by an independent frontend", async ({ request }) => {
  const response = await request.get("/sync-client.js", { headers: { origin: CHAT_ORIGIN } });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  expect(response.headers()["cross-origin-resource-policy"]).toBe("cross-origin");
  const source = await response.text();
  expect(source).toContain("createSyncClient");
  expect(source).toContain("websocketUrl");
});
