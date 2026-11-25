# SYNC game AI — integration and release gate

The three editions remain distinct. Live Site SYNC and Chat SYNC use **one** Cloudflare `GameRoom` authority; LOVABLE SYNC uses its own Supabase sessions. AI is optional presentation content, never a room-state or scoring authority.

## Live Site + Chat runtime

The `sync-party-game` Worker serves `POST /api/rooms/{CODE}/ai-cue` for existing players. Body: `{ "playerId": "...", "resumeToken": "...", "edition": "cloudflare" | "chat" }`. The Durable Object validates the player against the stored room, reserves one per-phase provider invocation, caches the response, and enforces 24 total AI calls per room. A separate global `AI_BUDGET` Durable Object reserves provider calls across **all rooms**, resetting at UTC midnight; the default cap is 12/day, and `SYNC_AI_DAILY_BUDGET` can be set to an integer 1–50. A missing budget binding blocks paid calls. The UI requests commentary only for reveal and final results. Hidden choices, identities, tokens and scores are not sent to the provider. Provider failure hides the optional commentary and must not affect the game.

Set server-only Worker configuration:
- `SYNC_AI_GAME_ENABLED=true` (default: off).
- `SYNC_AI_GAME_PROVIDER=openai` or `anthropic` (default: openai).
- Secret `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set in Cloudflare Workers, **not** Git.
- Select a provider-confirmed `SYNC_OPENAI_MODEL` or `SYNC_ANTHROPIC_MODEL`; do not assume the existing fallback is available.

**Do not activate paid AI yet.** The global Worker call budget limits provider-request count, not exact dollars. Provider-side billing limits, abuse/WAF controls and a verified rollback must still be configured before setting `SYNC_AI_GAME_ENABLED=true`. Operator-only `/api/control-room/providers*` endpoints remain separate.

## Required release evidence

1. `npm test` and `npm run verify` pass on the exact feature head; no skipped checks.
2. `npm run test:e2e` verifies create, join, choose, reveal, score, replay and both editions on phone and desktop.
3. HTTP 401 on bad room identity; 409 outside supported phases; 503 when disabled; 202 while a cue is in flight; cache hit returns the same evidenceRef without another paid request.
4. Test a real provider call with configured server secret and log only a nonsecret response receipt; no client network request may include the provider key.
5. Verify room-score and private-answer snapshots are identical with AI enabled and disabled.
6. Publish Worker **before** the separate Chat-Sync static mirror. Verify real cross-origin responses from the allowed Chat host. Record tested SHA, deploy hash, UTC timestamp and rollback.

No deployment or provider activation is implied by a source commit.
