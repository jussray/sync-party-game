# Handshake Multiplayer Mission Audit — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Mission: Handshake — Create a Multiplayer Game with OpenAI
- Product: `SYNC`

## Current reality
- Repository exists and is public.
- `main` exists.
- At audit time, GitHub reported repository size `0`; implementation had not yet landed.
- Handshake currently requires a live, reusable multiplayer game at its own public URL, joined by room code, with no login or install, replayable from phone or laptop.

## Product decision
Build SYNC as the flagship game on top of a reusable multiplayer core rather than a disposable challenge-only app.

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
- party music/SFX with escalating countdown pressure audio

## Planned architecture
- standalone multiplayer core
- game protocol/state machine
- SYNC game rules/content packs
- authoritative server transitions
- deterministic room/state fingerprints and continuity receipts
- event-driven room history suitable for debugging/replay
- browser client treats server state as authoritative

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

## Parallel portfolio audit
No existing reusable WebSocket/Durable Object multiplayer room engine was found by code search across `Sekret-Bip`, `founder-control-room`, `StoryEngine`, or `chief-ai-machine`. The new repo therefore owns the multiplayer primitive and can expose adapters to portfolio products later.

## Risk
- Fake multiplayer/local-only state is a mission failure.
- Client-authoritative score/phase transitions create drift/cheating risk.
- Adding AI before the core loop is fun can obscure the real product test.
- Audio must remain user-controllable and never block gameplay.

## Stop condition
The build phase is complete only when the production multiplayer path passes the Playwright proof gate and the public URL satisfies the Handshake mission contract.
