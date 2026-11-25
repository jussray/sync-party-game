import { test, expect } from "@playwright/test";

test("AI cue endpoint rejects forged room identity and never exposes hidden state", async ({ request }) => {
  const created = await request.post("/api/rooms/create", { data: { name: "Security Test" } });
  expect(created.status()).toBe(200);
  const room = await created.json();
  expect(room.code).toMatch(/^[A-Z0-9]{5}$/);
  expect(room.playerId).toBeTruthy();
  expect(room.resumeToken).toBeTruthy();

  const endpoint = `/api/rooms/${room.code}/ai-cue`;
  const forged = await request.post(endpoint, {
    data: { edition: "chat", playerId: room.playerId, resumeToken: "forged" }
  });
  expect(forged.status()).toBe(401);
  const forgedBody = JSON.stringify(await forged.json());
  expect(forgedBody).not.toContain(room.resumeToken);

  const invalidEdition = await request.post(endpoint, {
    data: { edition: "untrusted", playerId: room.playerId, resumeToken: room.resumeToken }
  });
  expect(invalidEdition.status()).toBe(400);

  // Even the real owner cannot ask AI about an unpublished round in the lobby.
  const early = await request.post(endpoint, {
    data: { edition: "cloudflare", playerId: room.playerId, resumeToken: room.resumeToken }
  });
  expect(early.status()).toBe(409);
  const earlyBody = JSON.stringify(await early.json());
  expect(earlyBody).not.toContain(room.resumeToken);
});
