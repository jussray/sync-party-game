# Sync Party

Sync Party is a reusable real-time multiplayer party-game system. The product identity is competition-independent: players join quickly, make private choices under time pressure, reveal together, score from one authoritative room state, and replay without rebuilding the room.

## North Star

Ship the most reliable, memorable multiplayer room loop we can prove end to end: create → join → choose → reveal → score → replay.

## Immediate mission: Handshake

The first release gate is the Handshake **Create a Multiplayer Game with OpenAI** mission.

Required public path:
- its own public URL
- room-code joining
- no login
- no app install
- phone and laptop support
- reusable/replayable multiplayer rooms
- synchronized player screens

Handshake-specific proof is tracked in `docs/audits/2026-09-24-handshake-multiplayer-audit.md` and `docs/PROOF-LEDGER.md`.

## Secondary competition adapter: Amazon Appdev 2026

Fire TV, Alexa+, AWS, 10-foot UI, and Amazon-specific judging/evidence are a separate adapter track. They must not redefine or block the core web multiplayer engine or Handshake release path.

Amazon-specific guardrails remain in `docs/HACKATHON-CONTRACT.md` and `docs/FRICTION-LOG.md`.

## Core product contract

- 2–8 players
- room-code join
- separate player identity from connection identity
- authoritative shared state
- reconnect after refresh/drop
- hidden choices before reveal
- synchronized reveal and scoring
- replay/rematch without recreating the room
- light/dark mode
- party music/SFX with escalating countdown pressure and mute/accessibility controls

## Proof policy

A feature is not done because code exists. It is done only when the real user path is verified and the evidence is recorded in `docs/PROOF-LEDGER.md`.

Use four states only: `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`.

For UI/runtime work, preserve browser evidence. For Amazon-device claims, preserve Amazon runtime or simulator evidence separately. Never fabricate green status, hide failing signals, or substitute mocks for the real submission path.

## Repository authority

- Authoritative repository: `jussray/sync-party-game`
- Default branch: `main`
- Owner / final product authority: `@jussray`
- Evidence record: `docs/PROOF-LEDGER.md`
- Competition routing: `docs/COMPETITION-MATRIX.md`

## Rights

Public repository visibility is not a license grant. See `COPYRIGHT.md`. Separately identified components may receive an explicit open-source license later when that serves the product strategy.
