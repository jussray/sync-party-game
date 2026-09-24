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
- The repo now contains a Cloudflare Worker + Durable Object room authority, WebSocket transport, browser UI, room create/join flow, reconnect identity, light/dark theme, pressure audio, state fingerprints/receipts, pure rule tests, and a two-context Playwright specification.
- Exact head `a40b1e60a755b518bc52117213c5410f0bc097a1` passed GitHub Actions `core-proof` run `36047670313`, including JavaScript/Python syntax checks, 10 Node game tests, and the independent Python bug finder.

## Drift found during parallel audit
Commit `559f471c603d7789b08cdeae9ea1047eaa454c82` changed the repository root identity into an Amazon Appdev / Fire TV-specific build. That conflicted with the already-approved Handshake-first product direction and risked making an adapter authoritative over the product.

## Authority fixes applied
- `b56fc779fcc54c127f41e77b1eda944566b62841` — restored product-first Sync Party authority in `README.md`; Handshake is immediate release gate and Amazon is a secondary adapter.
- `bd29f284a78d8fc9b6b72bd223b0f391768503a2` — made the pull-request proof template competition-independent while preserving track-specific evidence requirements.
- `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` — added `docs/COMPETITION-MATRIX.md` separating shared core, Handshake proof, and Amazon adapter boundaries.
- `a298a0b0f9856cdce306beb31c65f7f06d70c925` — split the proof ledger into core, Handshake-primary, and Amazon-secondary gates.

No Amazon work was deleted. It remains available as a bounded adapter track and must not block the Handshake web release.

## Implementation audit findings + repairs

### REMATCH phase spoof — FIXED
The WebSocket handler previously rewrote an active room to `phase: "results"` before calling `startGame`, allowing a host to bypass the authoritative phase guard by sending `REMATCH` mid-game.

- Fix: `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02`
- New rule: REMATCH requires the stored authoritative room phase to already equal `results`.

### Classic tie scoring — FIXED
Classic mode says “Match the majority,” but the initial rule awarded both players in a 1–1 split because both matched the top count.

- Fix: `cefcbed2b83f4d3d228ea2091d4194f69b715788`
- Regression: `a40b1e60a755b518bc52117213c5410f0bc097a1`
- New rule: Classic only awards when the leading choice has a true majority (`top > total / 2`).

### Python red-team lane — INSTALLED
- verifier added: `78ad95532a14db1cd24c930ee8f81c1b1c92bb50`
- package workflow exposed: `3ac7bab27956fb04bb82138eaecbb0acaf50d3bc`
- CI integration: `8f903abdc8e73a9f9cb9fccf5bd19dd7cb7f3660`
- green proof: Actions run `36047670313` at `a40b1e60a755b518bc52117213c5410f0bc097a1`
- successor receipt: `docs/receipts/2026-09-24-python-redteam-proof.md`

Python remains a verifier, not a second game authority. It checks the real JavaScript source for authority/privacy regressions, verifies the two-browser proof shape, and reruns the Node rules suite.

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

## Current architecture
- Cloudflare Worker entrypoint
- Durable Object per authoritative room
- WebSocket client synchronization
- resume-token reconnect identity
- pure game rules separated in `src/game.js`
- browser client in `public/`
- deterministic room/state fingerprint + bounded receipt history
- Node rule tests
- Python independent bug finder
- two-context Playwright spec
- competition/device integrations remain adapters around the core

## Proof gate
Do not claim Handshake completion until Playwright proves, with separate browser contexts against a running/deployed Worker:
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

## VERIFIED source/CI but not production proof
- authoritative room design exists
- room create/join routes exist
- WebSocket synchronization code exists
- reconnect identity code exists
- hidden-choice projection exists
- scoring/reveal state machine exists
- light/dark UI exists
- optional pressure audio exists
- separate-context Playwright spec exists
- Python bug finder is green in CI

## UNKNOWN / runtime gates
- deployed public URL
- real Worker/Durable Object WebSocket run observed in this evidence chain
- executed two-browser Playwright trace/screenshots
- real reconnect after network/browser interruption
- responsive phone + laptop proof
- live pressure audio/visual accessibility proof
- production full loop through final results and rematch
- host-loss/failover behavior

## BLOCKED
- Branch protection/ruleset: available GitHub metadata confirms `main` is unprotected; the current connector does not expose an administration mutation to enable it.

## Risk
- Source green is not equivalent to production green.
- Host loss can still become a stuck-room scenario unless recovery behavior is deliberately designed and proven.
- Competition-specific requirements can cause product-authority drift if not isolated.
- Audio must remain user-controllable and never carry required game information.

## Rollback
Every repair above is isolated in its own commit and can be reverted independently. The Python lane can be removed without changing runtime authority; Amazon adapter work remains preserved.

## Next proof gate
Run the committed Playwright spec against a real local or deployed Cloudflare Worker, preserve trace/screenshots/logs, then promote only the observed production gates in `docs/PROOF-LEDGER.md`.

## Stop condition
The Handshake build phase is complete only when the production multiplayer path passes the Playwright proof gate and the public URL satisfies the verified Handshake mission contract.
