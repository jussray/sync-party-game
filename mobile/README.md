# Sync Party Mobile

This directory is an additive native iOS/Android client for the existing Sync Party multiplayer authority.

## Product job

- create and join the same Durable Object rooms as the web game;
- connect through the existing authenticated WebSocket protocol;
- render the authoritative room phase, prompt, scores, sequence, and state hash;
- submit the same `START_GAME`, `SUBMIT_CHOICE`, `NEXT_ROUND`, and `REMATCH` actions;
- add device haptics for key game transitions;
- use the native share sheet for room-code invites.

## Web mission boundary

The current Handshake mission requires a no-install web path. This native client does not replace or redefine that requirement. The browser game remains the canonical no-install entry for that mission.

## Deployment truth

`.deployment-authority.json` intentionally treats unknown paths as invalidating an existing web deployment candidate. Adding `mobile/` therefore does not inherit any prior web deployment proof. Web deployment must be re-proven separately after this branch if it becomes a release candidate.

## Store truth states

- SOURCE IMPLEMENTED: native source and store identifiers exist.
- CI VERIFIED: exact-head mobile contract, TypeScript, and both Expo platform exports pass.
- NATIVE BUILD VERIFIED: requires reviewable/signed native build evidence.
- DEVICE VERIFIED: requires real-device acceptance evidence.
- STORE SUBMITTED / STORE APPROVED: require provider receipts.

No Apple/Google account identifiers, signing credentials, API secrets, or EAS project ID are committed here.
