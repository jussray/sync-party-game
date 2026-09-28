# SYNC multiplayer audio port — 26 September 2026

Base main: `468e3b8a51f3a2b2d43081d7358ab203a47f498c`.
Source: Site audio from `7190bf4a30def44e6d88031b7df701cee3c4da20`, adapted to authoritative multiplayer messages.
Immutable local verification subject: SHA-256 `27838a25f5d830fbcbad9eef1d6f5a4b5cb5fb9a426932bf39a49a3e33a0f5a3` of `2026-09-26-audio-source-manifest.json`; it lists the exact source/test/asset hashes exercised.

## Changes

Opt-in original music, separate master/music/effects volumes, sound audition controls, mute and lifecycle handling. Audio starts off every visit; only volume levels persist first-party. Choice-lock cue follows server acknowledgement. Phase cues deduplicate by room/round/deadline/phase, rather than connection sequence. Final-five cues use the server deadline, never emit tick zero, and keep visual pressure available while muted. No Worker, Durable Object, scoring, identity, CI or deployment configuration changes.

## Evidence

- VERIFIED: `npm run verify` exited 0: 20 Node tests (12 game, 8 audio lifecycle) and independent Python bugfinder. Audio tests use a mock device seam; they do not prove audible output.
- VERIFIED: `python scripts/secret_scan.py` exited 0 with implementation staged (61 tracked files); continuity model check exited 0.
- VERIFIED: JavaScript syntax checks and whitespace diff check.
- VERIFIED: Wrangler dry-run bundled the Worker and recognized ROOMS/GameRoom and frontend assets; no deployment was performed.
- BLOCKED: local Chromium installation returned truncated/invalid ZIP downloads. Local end-to-end execution is not claimed.
- UNKNOWN: new Playwright results until the exact PR head CI completes. Added tests cover real browser analyser signal/mute/retry/mobile mixer; multiplayer assertions cover server-acknowledged lock, countdown pressure, reveal and final cues.
- UNKNOWN: hardware listening quality, mobile Safari and this change in public production. Prior Site browser proof and historical production proof are separate subjects.

This port changes public frontend code, so documentation-only safe drift does not extend previous production evidence to this candidate.
