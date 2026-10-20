# Analytics Truth Attack

Status: **ADOPTED** for SYNC Analytics Truth V2.

This workflow exists to stop attractive analytics from outrunning their evidence. It is a reusable attack lane, not a one-time audit.

## Control loop

`DECLARE → ATTACK → CLASSIFY → SEPARATE → FREEZE → VERIFY → PROVE → PROMOTE`

1. **DECLARE** the semantic claim for every metric before implementation. A count named `games_started` must mean games, not players who were present when a game started.
2. **ATTACK** the claim from the collection point backward. Ask who can emit it, whether a client can forge it, whether automated proof traffic can trigger it, whether retries duplicate it, and whether a rollup changes its meaning.
3. **CLASSIFY** evidence without overstating identity. Current classes are `browser_signal`, `automation_likely`, `unverified_client`, and `server_authoritative`. None of the client classes means “human.”
4. **SEPARATE** weak and strong evidence. Public landing/play signals never share semantic authority with room commits. Server-authoritative product counters exclude automation-likely traffic, while automation remains visible in its own lane.
5. **FREEZE** incompatible history. Analytics Truth V1 is read-only legacy evidence. V2 writes into namespaced Durable Object ledgers and never silently merges V1 counts into V2.
6. **VERIFY** invariants with unit tests plus `npm run attack:analytics-truth`. The executable attack must fail if public events gain server-only powers, evidence labels drift, the legacy boundary disappears, or the dashboard starts calling anonymous identities humans.
7. **PROVE** runtime behavior with Playwright through Wrangler. The witness must exercise the same public API, room authority, dashboard contract, and automation classification used in production.
8. **PROMOTE** only an exact green SHA through the normal proof → main → production chain. The production witness must observe that exact SHA before public Playwright evidence can certify it.

## Measurement contract

### Traffic lane

- `landing_view` and `play_intent` are public client signals.
- Obvious crawlers, headless browsers, and proof automation are classified `automation_likely` from request characteristics. Raw User-Agent strings are not persisted.
- Browser-like traffic is `browser_signal`, not “human.” Unknown clients are `unverified_client`.
- Acquisition source/medium/content/referrer counts increment once for the first landing of an anonymous growth identity in the selected rollup, not once for every downstream event.

### Product lane

- `room_created` and `room_joined` are server-authoritative transitions.
- `game_started`, `game_finished`, and `rematch_started` are emitted once per game transition.
- `player_game_started`, `player_game_finished`, and `player_rematch_started` preserve player-level conversion evidence separately.
- Product counters shown to the founder require `server_authoritative` evidence and exclude `automation_likely` traffic. Operational proof remains observable in automation counters rather than contaminating product adoption.

### Rollups

- V2 always writes a global `all` rollup.
- V2 also writes the normalized campaign rollup.
- Blank campaign on the founder dashboard means the global V2 rollup.
- Legacy V1 is available only through the explicit `version=legacy` read path and is never merged into V2.

## Privacy boundary

The analytics contract may retain anonymous visitor/session continuity IDs, normalized campaign/source/medium/content tokens, referrer host only, evidence class, traffic class, event type, sequence, and fingerprints. It must not retain player names, emails, answers, private game content, raw referrer paths, or raw User-Agent strings.

## No self-certification

A code path that emits a metric cannot certify its own truth. The standing proof chain is:

- contract tests for semantics,
- attack script for cross-file invariants,
- Wrangler runtime tests for behavior,
- production exact-SHA Playwright for deployed state.

If any layer disagrees, the metric is **UNKNOWN or BLOCKED**, not verified.
