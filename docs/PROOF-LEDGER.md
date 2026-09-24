# Competition Proof Ledger

Use only: `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`.

A `VERIFIED` row must contain evidence tied to an exact commit SHA or immutable artifact. Do not promote a row because implementation code merely exists.

## Provenance anchor

- Repository: `jussray/sync-party-game`
- Initial founder commit: `ee3e0264a3038695d43763709262f9a871262f02`
- Initial commit timestamp: 2026-09-24
- Default branch: `main`
- Founder authority: `@jussray`

## Core gates

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Repository provenance anchored | VERIFIED | `ee3e0264a3038695d43763709262f9a871262f02` | Git history | Preserve lineage |
| Product-first competition routing | VERIFIED | `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` | `README.md` + `docs/COMPETITION-MATRIX.md` | Prevent adapter drift |
| Pure game transition/scoring rules | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | 10/10 Node tests in Actions run `36050519734`; Python successor green | Keep rule tests independent of browser proof |
| Python independent bug-finder lane | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Python 3.12 bug-finder green in run `36050519734`; full replay shape required | Keep Python non-authoritative and independent of game implementation |
| REMATCH phase authority | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Phase-spoof fix `06dc6f10...`; Python guard; successful same-room rematch in run `36050519734` | Re-prove on production deployment |
| Main branch protection / ruleset | BLOCKED | — | GitHub branch metadata reports `protected:false` | Enable ruleset requiring appropriate checks/review |
| Room create / join | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Two-browser Wrangler UI flow in run `36050519734`; plus Playwright desktop+phone 4/4; `docs/receipts/2026-09-24-multiplayer-runtime-proof.md` | Re-prove at public URL |
| 2+ player synchronized state | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Independent host/guest contexts traverse the same five rounds in run `36050519734`; plus Both contexts show identical seq+stateHash every round; 8-player attack converged, 3 seeds x 2 games | Re-prove at public URL |
| Timed choice lock | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `@THIS@` | Attack harness: withheld player -> DO alarm LOCKED at deadline -> REVEAL with 7/8 answers | Production proof pending |
| Hidden choices before reveal | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `@THIS@` | Playwright inspects every guest WebSocket STATE frame in CHOOSING/LOCKED; mutation test (leak in LOCKED) made the spec fail | Production proof pending |
| Synchronized reveal + score | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Both browsers observe synchronized reveal/100% state across full-loop Playwright in run `36050519734`; plus Same result rows, SYNC %, leaderboard and state hash on both contexts, all 5 modes; final room SYNC 70% on both | Add score-value equality assertion and production proof |
| Recovery from disconnect / reconnect | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Guest reload restores same room URL, identity, and authoritative reveal state in run `36050519734`; plus Guest reload in round 3 resumes same identity + same hash; attack harness refreshes a random player each round; host drop transfers host | Re-prove over public internet |
| Replay/rematch same room | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Five rounds → GAME OVER → Play again → both clients synchronized at Round 1 in same room; run `36050519734`; plus Rematch in same code, scores reset, round playable to 100% reveal | Re-prove production |
| Pressure audio / visual escalation | INFERRED | `@THIS@` | Visual countdown + LOCKED beat screenshot-verified; sound toggle aria-pressed verified; audible output NOT verified (headless) | Human listen test on a phone |
| Light / dark mode | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Environment-independent toggle + reload persistence passed in run `36050519734`; plus Toggle flips + persists across reload (Playwright) | Add visual snapshots/mobile proof |
| Deterministic room/state fingerprint | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `@THIS@` | `/api/rooms/:code/receipts` chain: contiguous seq, previousStateHash links, last hash == client hash (Playwright + attack) | Receipts capped at last 128 |
| Secret scan / publication review | UNKNOWN | — | — | Add CI/manual evidence |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | BLOCKED | — | No `sync-party-game` Worker in Cloudflare account (listed 2026-09-24); no Cloudflare credentials in agent container; `deploy-and-prove` workflow needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets | Founder adds secrets, merge to main |
| Room-code join | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Real browser create/join in run `36050519734` | Production multiplayer proof still required |
| No login required | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Full browser flow completes without auth/login in run `36050519734` | Production proof |
| No app install required | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Browser-only flow via served web app in run `36050519734` | Production proof |
| Phone + laptop usable | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `@THIS@` | Full flow on Pixel 7 emulation + 1280x800; no horizontal scroll asserted; screenshots | Real device check after deploy |
| Replayable multiplayer loop | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Full five-round + rematch proof in run `36050519734` | Production E2E |
| Separate-context Playwright proof | VERIFIED (local runtime) | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`; re-proved at `@THIS@` | Two independent browser contexts + real Wrangler/Durable Object passed in run `36050519734`; receipt `docs/receipts/2026-09-24-wrangler-multiplayer-runtime-proof.md`; plus 4/4 passed (desktop+phone), 2 independent contexts; `docs/receipts/2026-09-24-multiplayer-runtime-proof.md` | Production-targeted Playwright next |

## Amazon adapter gates — SECONDARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Amazon track isolated from core authority | VERIFIED | `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` | competition matrix | Keep adapter optional for Handshake |
| Fire TV runtime | UNKNOWN | — | — | Amazon runtime or simulator evidence |
| Alexa+ game-master path | UNKNOWN | — | — | Real integration evidence |
| AWS integration | UNKNOWN | — | — | Real request/state evidence |
| Amazon friction log maintained | VERIFIED | documentation baseline | `docs/FRICTION-LOG.md` | Add only genuine events |
| Amazon submission-rule reconciliation | UNKNOWN | — | — | Re-check official rules near submission |

## Runtime proof receipt

- Full-loop Playwright commit: `dfe36245cf3ef7d1659438830500aeb498ffd303`
- Full-loop run: `36050346725` / run #15 — SUCCESS
- Python full-proof successor: `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`
- Successor run: `36050519734` / run #17 — SUCCESS
- Receipt: `docs/receipts/2026-09-24-wrangler-multiplayer-runtime-proof.md`
- Earlier failed proof artifacts are preserved in the receipt and were not suppressed.

## Evidence receipt format

For each meaningful proof, record:

- timestamp
- exact commit SHA
- environment/device/simulator
- command or user path exercised
- expected outcome
- observed outcome
- artifact/log/screenshot/trace reference
- VERIFIED / INFERRED / UNKNOWN / BLOCKED
- rollback or retry path
