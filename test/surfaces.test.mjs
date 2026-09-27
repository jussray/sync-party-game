import test from "node:test";
import assert from "node:assert/strict";
import { CHAT_SITE_ORIGIN, buildSurfaceManifest, getSurfaceProfile, isAllowedClientOrigin, surfaceFingerprint } from "../src/surfaces.js";

test("Cloudflare and chat surfaces share game authority but keep independent presentation", () => {
  const cloudflare = getSurfaceProfile("cloudflare");
  const chat = getSurfaceProfile("chat");
  assert.deepEqual(cloudflare.shared_game, chat.shared_game);
  assert.notEqual(cloudflare.presentation.id, chat.presentation.id);
  assert.equal(cloudflare.presentation.entrypoint, "/");
  assert.equal(chat.presentation.entrypoint, "/chat/index.html");
  assert.equal(chat.presentation.mirror_target, CHAT_SITE_ORIGIN);
  assert.equal(cloudflare.shared_game.same_room_cross_surface, true);
  assert.equal(cloudflare.shared_game.authoritative_rule_changes_require_room_contract, true);
});

test("chat-site origin is explicitly allowed while unrelated origins are denied", () => {
  const workerOrigin = "https://sync-party-game.mcgill-raylene.workers.dev";
  assert.equal(isAllowedClientOrigin(workerOrigin, workerOrigin), true);
  assert.equal(isAllowedClientOrigin(CHAT_SITE_ORIGIN, workerOrigin), true);
  assert.equal(isAllowedClientOrigin("https://example.com", workerOrigin), false);
  assert.equal(isAllowedClientOrigin(null, workerOrigin), true);
});

test("surface fingerprints are stable per profile and differ across skins", async () => {
  const cloudflare = getSurfaceProfile("cloudflare");
  const chat = getSurfaceProfile("chat");
  assert.equal(await surfaceFingerprint(cloudflare), await surfaceFingerprint(cloudflare));
  assert.notEqual(await surfaceFingerprint(cloudflare), await surfaceFingerprint(chat));
});

test("manifest binds a surface to the shared API without making presentation authoritative", async () => {
  const manifest = await buildSurfaceManifest("chat", "https://sync-party-game.mcgill-raylene.workers.dev");
  assert.equal(manifest.id, "chat");
  assert.equal(manifest.shared_game.authority, "cloudflare-durable-object");
  assert.equal(manifest.presentation.entrypoint, "/chat/index.html");
  assert.equal(manifest.presentation.mirror_target, CHAT_SITE_ORIGIN);
  assert.equal(manifest.endpoints.api_origin, "https://sync-party-game.mcgill-raylene.workers.dev");
  assert.equal(manifest.endpoints.ws_origin, "wss://sync-party-game.mcgill-raylene.workers.dev");
  assert.match(manifest.fingerprint, /^[a-f0-9]{24}$/);
});
