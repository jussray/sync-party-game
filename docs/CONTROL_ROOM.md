# SYNC Control Room

The Sync Control Room is the product-local operator surface for `jussray/sync-party-game`.

## Authority

- Source authority: `main`
- Production authority: `production`
- Promotion rule: exact green SHA only
- Runtime: Cloudflare Workers + Durable Objects
- Real-path proof: Playwright against the exact public production SHA
- Portfolio parent: Founder Control Room

The control room is standalone. The game can continue to serve players if the control ledger or Founder Control Room is unavailable.

## Runtime surfaces

- `/control-room` — standalone operator UI
- `/api/control-room/snapshot` — public-safe aggregate snapshot for the local UI and FCR pull relay
- `/api/control-room/export` — protected detailed export when `CONTROL_ROOM_READ_KEY` is configured
- `/api/version` — exact deployment SHA/build identity

## Privacy boundary

The public control feed never records or exposes:

- room codes
- player names
- resume tokens
- answer choices
- websocket connection IDs

Rooms are represented by deterministic one-way fingerprints. Lifecycle receipts contain event type, phase, aggregate connection counts, state hash, game sequence, timestamps, and bounded continuity evidence.

## Continuity

Each accepted control event advances the control sequence and produces:

- event fingerprint
- control fingerprint
- `sync-control-v1.<fingerprint>.<seq>` continuity cookie

The current fingerprint and cookie are visible in the control-room UI and can be consumed by the portfolio control plane.

## Failure rule

Control-room telemetry is observational, never gameplay authority. Recording failures are caught at the game commit boundary and must not block room creation, reconnect, round progression, timeout alarms, results, or rematches.
