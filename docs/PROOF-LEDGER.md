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
| Room create / join | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Two-browser Wrangler UI flow in run `36050519734` | Re-prove at public URL |
| 2+ player synchronized state | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Independent host/guest contexts traverse the same five rounds in run `36050519734` | Re-prove at public URL |
| Timed choice lock | UNKNOWN | implementation present | Duplicate choice lock is unit-tested; browser timeout/alarm path not explicitly exercised | Add deterministic timeout/alarm E2E |
| Hidden choices before reveal | UNKNOWN | implementation present | Python/source checks verify projection shape; no explicit browser non-disclosure assertion yet | Add multi-client pre-reveal visibility assertion |
| Synchronized reveal + score | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Both browsers observe synchronized reveal/100% state across full-loop Playwright in run `36050519734` | Add score-value equality assertion and production proof |
| Recovery from disconnect / reconnect | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Guest reload restores same room URL, identity, and authoritative reveal state in run `36050519734` | Re-prove over public internet |
| Replay/rematch same room | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Five rounds → GAME OVER → Play again → both clients synchronized at Round 1 in same room; run `36050519734` | Re-prove production |
| Pressure audio / visual escalation | UNKNOWN | implementation present | Source/UI exists; audible output and final-five-second runtime not explicitly proven | Browser/audio/accessibility proof |
| Light / dark mode | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Environment-independent toggle + reload persistence passed in run `36050519734` | Add visual snapshots/mobile proof |
| Deterministic room/state fingerprint | UNKNOWN | implementation present | Python/source audit confirms previous/current state-hash receipt fields | Runtime/protocol receipt assertion |
| Secret scan / publication review | UNKNOWN | — | — | Add CI/manual evidence |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | UNKNOWN | — | No production deployment receipt yet | Deploy exact green successor |
| Room-code join | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Real browser create/join in run `36050519734` | Production multiplayer proof still required |
| No login required | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Full browser flow completes without auth/login in run `36050519734` | Production proof |
| No app install required | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Browser-only flow via served web app in run `36050519734` | Production proof |
| Phone + laptop usable | UNKNOWN | responsive CSS exists | Desktop Chromium contexts only | Add mobile viewport + production device/browser proof |
| Replayable multiplayer loop | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` local Wrangler runtime | Full five-round + rematch proof in run `36050519734` | Production E2E |
| Separate-context Playwright proof | VERIFIED | `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1` | Two independent browser contexts + real Wrangler/Durable Object passed in run `36050519734`; receipt `docs/receipts/2026-09-24-wrangler-multiplayer-runtime-proof.md` | Production-targeted Playwright next |

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
