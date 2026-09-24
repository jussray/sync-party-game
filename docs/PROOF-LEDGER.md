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
| Pure game transition/scoring rules | VERIFIED | `a40b1e60a755b518bc52117213c5410f0bc097a1` | 10/10 Node tests; GitHub Actions run `36047670313`; Python red-team receipt | Runtime/network behavior still requires browser proof |
| Python independent bug-finder lane | VERIFIED | `a40b1e60a755b518bc52117213c5410f0bc097a1` | CI step `Python bug finder` succeeded in run `36047670313`; `docs/receipts/2026-09-24-python-redteam-proof.md` | Keep Python non-authoritative and independent of game implementation |
| REMATCH phase authority | VERIFIED | `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02` | Source fix + Python authority check inherited by green CI | Production rematch still needs E2E proof |
| Main branch protection / ruleset | BLOCKED | — | GitHub branch metadata reports `protected:false` | Enable ruleset requiring appropriate checks/review |
| Room create / join | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Playwright desktop+phone 4/4; `docs/receipts/2026-09-24-multiplayer-runtime-proof.md` | Production proof pending deploy |
| 2+ player synchronized state | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Both contexts show identical seq+stateHash every round; 8-player attack converged, 3 seeds x 2 games | Production proof pending deploy |
| Timed choice lock | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Attack harness: withheld player -> DO alarm LOCKED at deadline -> REVEAL with 7/8 answers | Production proof pending |
| Hidden choices before reveal | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Playwright inspects every guest WebSocket STATE frame in CHOOSING/LOCKED; mutation test (leak in LOCKED) made the spec fail | Production proof pending |
| Synchronized reveal + score | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Same result rows, SYNC %, leaderboard and state hash on both contexts, all 5 modes; final room SYNC 70% on both | Production proof pending |
| Recovery from disconnect / reconnect | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Guest reload in round 3 resumes same identity + same hash; attack harness refreshes a random player each round; host drop transfers host | Production proof pending |
| Replay/rematch same room | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Rematch in same code, scores reset, round playable to 100% reveal | Production proof pending |
| Pressure audio / visual escalation | INFERRED | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Visual countdown + LOCKED beat screenshot-verified; sound toggle aria-pressed verified; audible output NOT verified (headless) | Human listen test on a phone |
| Light / dark mode | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Toggle flips + persists across reload (Playwright) | — |
| Deterministic room/state fingerprint | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | `/api/rooms/:code/receipts` chain: contiguous seq, previousStateHash links, last hash == client hash (Playwright + attack) | Receipts capped at last 128 |
| Secret scan / publication review | UNKNOWN | — | — | CI / manual evidence |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | BLOCKED | — | No `sync-party-game` Worker in Cloudflare account (listed 2026-09-24); no Cloudflare credentials in agent container; `deploy-and-prove` workflow needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets | Founder adds secrets, merge to main |
| Room-code join | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | — | Production multiplayer proof |
| No login required | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` designed without auth | — | Production browser proof |
| No app install required | UNKNOWN | web implementation exists | — | Production browser proof |
| Phone + laptop usable | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | Full flow on Pixel 7 emulation + 1280x800; no horizontal scroll asserted; screenshots | Real device check after deploy |
| Replayable multiplayer loop | UNKNOWN | implementation + REMATCH authority fix exist | — | Production E2E |
| Separate-context Playwright proof | VERIFIED (LOCAL wrangler dev (real Worker + DO)) | `3a4bd7f9706f53387c534d5a3944eaabba8802e3` | 4/4 passed (desktop+phone), 2 independent contexts; `docs/receipts/2026-09-24-multiplayer-runtime-proof.md` | CI + production run pending |

## Amazon adapter gates — SECONDARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Amazon track isolated from core authority | VERIFIED | `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` | competition matrix | Keep adapter optional for Handshake |
| Fire TV runtime | UNKNOWN | — | — | Amazon runtime or simulator evidence |
| Alexa+ game-master path | UNKNOWN | — | — | Real integration evidence |
| AWS integration | UNKNOWN | — | — | Real request/state evidence |
| Amazon friction log maintained | VERIFIED | documentation baseline | `docs/FRICTION-LOG.md` | Add only genuine events |
| Amazon submission-rule reconciliation | UNKNOWN | — | — | Re-check official rules near submission |

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
