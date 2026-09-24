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
| Room create / join | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Code exists only | Real concurrent clients |
| 2+ player synchronized state | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | — | Real concurrent clients |
| Timed choice lock | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Pure duplicate-lock rule verified, timer runtime unproved | Deterministic timing/browser test |
| Hidden choices before reveal | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Python/source checks verify intended projection shape, not live clients | Multi-client visibility test |
| Synchronized reveal + score | UNKNOWN | `a40b1e60a755b518bc52117213c5410f0bc097a1` rules verified | Pure scoring rules + strict-majority regression green, network synchronization unproved | Multi-client state equality proof |
| Recovery from disconnect / reconnect | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Playwright spec contains reload path but has not been executed in proof chain | Failure-path browser test |
| Replay/rematch same room | UNKNOWN | authority fix `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02` | Phase-spoof bug fixed; production loop unproved | End-to-end run |
| Pressure audio / visual escalation | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | — | UI + accessibility proof |
| Light / dark mode | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Playwright spec asserts theme toggle but runtime unexecuted | Visual/browser proof |
| Deterministic room/state fingerprint | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | Python/source audit confirms previous/current state-hash receipt fields | Runtime/protocol test |
| Secret scan / publication review | UNKNOWN | — | — | CI / manual evidence |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | UNKNOWN | — | — | Deploy |
| Room-code join | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` implemented | — | Production multiplayer proof |
| No login required | UNKNOWN | `5ad72763808da6c9e7f826738216ccf1195e4f76` designed without auth | — | Production browser proof |
| No app install required | UNKNOWN | web implementation exists | — | Production browser proof |
| Phone + laptop usable | UNKNOWN | responsive CSS implemented | — | Responsive/device proof |
| Replayable multiplayer loop | UNKNOWN | implementation + REMATCH authority fix exist | — | Production E2E |
| Separate-context Playwright proof | BLOCKED | spec committed at `5ad72763808da6c9e7f826738216ccf1195e4f76` | Earlier environment could not install/run browser + Worker dependencies; no successful Playwright run receipt yet | Run where Playwright + Worker runtime are available |

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
