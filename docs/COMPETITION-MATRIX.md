# Sync Party Competition Matrix

Sync Party is the product. Competition-specific integrations are adapters and proof tracks, not product identity.

| Track | Priority | Required runtime | Must not block core | Proof authority |
|---|---|---|---|---|
| Handshake — Create a Multiplayer Game with OpenAI | PRIMARY / immediate | Public web URL on phone + laptop | Yes | Real public multiplayer path + multi-context Playwright |
| Amazon Appdev 2026 | SECONDARY adapter | Fire TV / Amazon-specific runtime where required | Yes | Amazon runtime/simulator + track-specific evidence |

## Shared core

Both tracks may reuse:
- room-code lifecycle
- player vs connection identity
- authoritative room state machine
- hidden choice → lock → reveal → score
- reconnect/recovery
- replay/rematch
- theme and audio settings
- deterministic state fingerprints / continuity receipts

## Handshake release gate

A Handshake release candidate is not complete until separate browser contexts prove create → join → synchronized round → private choices → reveal → matching score → reconnect → replay, and the same path works at the public production URL with no login or install.

## Amazon boundary

Amazon-specific APIs, Fire TV layouts, Alexa/AWS integrations, judging language, friction reporting, and device proof stay behind the Amazon adapter. They may enhance Sync Party, but they may not force the Handshake web client to require Amazon services or hardware.

## Drift rule

If a competition-specific document starts redefining the root README, core state protocol, or release gate for every track, treat that as authority drift and reconcile it before implementation continues.
