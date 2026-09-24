# Sync Party

**Amazon Appdev 2026 hackathon build.**

Sync Party is a multiplayer party-game system designed around a shared Fire TV arena, private phone interactions, timed social pressure, adaptive game events, and Amazon-native capabilities where they materially improve the experience.

## North Star

Ship the most complete, memorable, technically undeniable multiplayer Fire TV experience we can prove end to end.

## Competition contract

- Primary target: Fire TV.
- Shared screen: Fire TV is the room arena.
- Private interaction: players join from phones and make private choices.
- Pressure loop: countdown, escalating sound, clear visual urgency, reveal, score, replay.
- Amazon integrations must be real, useful, and visible in evidence. No decorative SDK use.
- Judging lens: Technical Implementation 25%, Design 25%, Potential Impact 25%, Idea Quality 25%.
- Deadline baseline: October 23, 2026 at 3:00 PM EDT. Re-verify against the official Devpost rules before submission.

## Proof policy

A feature is not done because code exists. It is done only when the real user path is verified and the evidence is recorded in `docs/PROOF-LEDGER.md`.

Use four states only: `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`.

For UI/runtime work, preserve browser/device evidence. For Amazon-device claims, preserve Amazon runtime or simulator evidence. Never fabricate green status, hide failing signals, or substitute mocks for the submission path.

## Repository authority

- Authoritative repository: `jussray/sync-party-game`
- Default branch: `main`
- Owner / final product authority: `@jussray`
- Competition guardrails: `docs/HACKATHON-CONTRACT.md`
- Evidence record: `docs/PROOF-LEDGER.md`
- Amazon friction record: `docs/FRICTION-LOG.md`

## Rights

Public repository visibility is not a license grant. See `COPYRIGHT.md`. Separately identified components may receive an explicit open-source license later when that serves the competition or product strategy.
