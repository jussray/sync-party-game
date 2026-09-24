# Handshake Multiplayer Mission Audit — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Mission: Handshake — Create a Multiplayer Game with OpenAI
- Product: `Sync Party` / flagship game `SYNC`

## VERIFIED
- Repository exists and is public.
- `main` exists.
- Handshake's current mission page states the build must be a live, reusable multiplayer game at its own public URL, joined with a room code, with no login or app install, replayable from phone or laptop.
- The mission currently requires ChatGPT Work and lists an October 31 challenge deadline.
- GitHub reports `main` as `protected:false`; branch protection remains a real unresolved governance gate.
- No reusable WebSocket/Durable Object multiplayer room engine was found by targeted code search across `Sekret-Bip`, `founder-control-room`, `StoryEngine`, or `chief-ai-machine`.

## Drift found during parallel audit
Commit `559f471c603d7789b08cdeae9ea1047eaa454c82` changed the repository root identity into an Amazon Appdev / Fire TV-specific build. That conflicted with the already-approved Handshake-first product direction and risked making an adapter authoritative over the product.

## Fixes applied
- `b56fc779fcc54c127f41e77b1eda944566b62841` — restored product-first Sync Party authority in `README.md`; Handshake is immediate release gate and Amazon is a secondary adapter.
- `bd29f284a78d8fc9b6b72bd223b0f391768503a2` — made the pull-request proof template competition-independent while preserving track-specific evidence requirements.
- `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` — added `docs/COMPETITION-MATRIX.md` separating shared core, Handshake proof, and Amazon adapter boundaries.
- `a298a0b0f9856cdce306beb31c65f7f06d70c925` — split the proof ledger into core, Handshake-primary, and Amazon-secondary gates.

No Amazon work was deleted. It remains available as a bounded adapter track and must not block the Handshake web release.

## Required game contract
- 2–8 players
- room-code join
- no login
- authoritative shared room state
- separate player identity from connection identity
- reconnect after refresh/drop
- hidden choices before reveal
- synchronized reveal and score
- replay/rematch in the same room
- mobile + laptop responsive UI
- light/dark mode
- party music/SFX with escalating countdown pressure audio and user controls

## Planned architecture
- standalone multiplayer core
- game protocol/state machine
- SYNC game rules/content packs
- authoritative server transitions
- deterministic room/state fingerprints and continuity receipts
- event-driven room history suitable for debugging/replay
- browser client treats server state as authoritative
- competition/device integrations remain adapters around the core

## Proof gate
Do not claim completion until Playwright proves, with separate browser contexts:
1. host creates a room
2. another player joins by code
3. both see synchronized membership
4. host starts
5. both receive the same round
6. choices remain private until reveal
7. reveal occurs consistently
8. scores agree
9. a player refreshes/reconnects successfully
10. the game finishes and rematch works
11. the same flow passes against the public production URL

## UNKNOWN / not yet implemented
- application/runtime code
- authoritative room engine
- room create/join
- real-time synchronization
- reconnect
- score/reveal state machine
- light/dark UI runtime
- pressure audio runtime
- Playwright multiplayer proof
- production URL

## BLOCKED
- Branch protection/ruleset: available GitHub metadata confirms `main` is unprotected; the current connector does not expose an administration mutation to enable it.

## Risk
- Fake multiplayer/local-only state is a mission failure.
- Client-authoritative score/phase transitions create drift/cheating risk.
- Competition-specific requirements can cause product-authority drift if not isolated.
- Adding AI before the core loop is fun can obscure the real product test.
- Audio must remain user-controllable and never block gameplay.

## Rollback
Each audit correction is an independent commit and can be reverted without deleting the Amazon track or the original audit history.

## Next proof gate
Implement the smallest real heartbeat: two separate browser clients join one room, receive the same authoritative room state, complete one private-choice → reveal → score transition, and prove equality with Playwright.

## Stop condition
The Handshake build phase is complete only when the production multiplayer path passes the Playwright proof gate and the public URL satisfies the verified Handshake mission contract.
