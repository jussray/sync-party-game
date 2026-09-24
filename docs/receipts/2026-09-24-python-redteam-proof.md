# SYNC Python red-team proof receipt — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Verified head: `a40b1e60a755b518bc52117213c5410f0bc097a1`
- GitHub Actions run: `36047670313` (`core-proof` run #7)
- Goal: keep Python in the same evidence-first workflow as an independent bug-finding lane around the authoritative JavaScript multiplayer runtime.

## REALITY
The repository now contains a Cloudflare Worker + Durable Object multiplayer implementation, browser client, pure game rules, two-context Playwright specification, theme/audio UI, reconnect identity, state fingerprints/receipts, and CI.

Python does **not** implement or authorize game state. `scripts/bugfinder.py` independently inspects the JavaScript authority boundaries and proof shape, then orchestrates the Node rule tests. This avoids creating a second game implementation that could drift from the runtime.

## Bugs found and fixed

### 1. REMATCH phase spoof
**Finding:** the WebSocket `REMATCH` handler previously called `startGame({ ...state, phase: "results" }, playerId)`. A host could therefore send `REMATCH` during an active round and bypass the state machine's phase guard.

**Fix:** `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02`
- require authoritative `state.phase === "results"`
- call `startGame(state, playerId)` without rewriting phase

### 2. Classic tie awarded everyone
**Finding:** Classic mode's contract says “Match the majority,” but a 1–1 split produced `top === 1`, causing both players to be treated as winners.

**Fix:** `cefcbed2b83f4d3d228ea2091d4194f69b715788`
- Classic winners now require a true majority: `top > total / 2`

**Regression test:** `a40b1e60a755b518bc52117213c5410f0bc097a1`
- verifies a 1–1 split awards no players and no points

## Python verifier
Added at `78ad95532a14db1cd24c930ee8f81c1b1c92bb50` and wired into CI at `8f903abdc8e73a9f9cb9fccf5bd19dd7cb7f3660`.

The bug finder checks, among other things:
- room authority remains a Durable Object
- WebSocket identity is bound to stored `resumeToken`
- submitted choices use the socket-attached player identity, not a client-supplied player ID
- REMATCH cannot spoof phase
- client action payloads are not spread into authoritative state
- clients do not set score/phase/host/state-hash fields
- continuity receipts carry previous/current state hashes
- public state strips resume tokens
- answer visibility stays hidden before reveal/results
- Playwright proof uses at least two independent browser contexts and exercises reconnect
- Node game tests remain green

## PROOF
GitHub Actions run `36047670313` completed with conclusion `success` against exact head `a40b1e60a755b518bc52117213c5410f0bc097a1`.

Successful job steps included:
- Setup Node
- Setup Python
- JavaScript + Python syntax checks
- Pure game tests
- Python bug finder

At this proof point the rule suite contains 10 tests, including the new no-majority regression.

## Still UNKNOWN / runtime gates
A green source/CI proof is not production proof. The following still require real runtime evidence:
- deployed public URL
- actual Worker/Durable Object WebSocket synchronization
- two-browser Playwright execution against a running Worker
- reconnect after a real socket/browser interruption
- responsive phone + laptop path
- pressure audio/visual behavior in a browser
- full game → final results → rematch path on production

## RISK
- `main` remains unprotected in current GitHub metadata.
- The committed Playwright spec exists but has not yet been executed in the evidence chain because the earlier environment could not install/run the browser/runtime dependencies.
- Host-loss/failover during a game has not yet been proven or designed as a recovery path.

## ROLLBACK
- REMATCH authority fix: revert `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02`
- Python verifier: revert `78ad95532a14db1cd24c930ee8f81c1b1c92bb50`, `3ac7bab27956fb04bb82138eaecbb0acaf50d3bc`, and `8f903abdc8e73a9f9cb9fccf5bd19dd7cb7f3660`
- Classic strict-majority rule: revert `cefcbed2b83f4d3d228ea2091d4194f69b715788` and regression test `a40b1e60a755b518bc52117213c5410f0bc097a1`

## NEXT GATE
Run `e2e/multiplayer.spec.js` against a real local or deployed Cloudflare Worker and preserve the run/trace/screenshots. Do not promote the production multiplayer gates until that real path is observed.
