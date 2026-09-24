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
| Main branch protection / ruleset | BLOCKED | — | GitHub branch metadata reports `protected:false` | Enable ruleset requiring appropriate checks/review |
| Room create / join | UNKNOWN | — | — | Implement + multiplayer proof |
| 2+ player synchronized state | UNKNOWN | — | — | Real concurrent clients |
| Timed choice lock | UNKNOWN | — | — | Deterministic timing test |
| Hidden choices before reveal | UNKNOWN | — | — | Multi-client visibility test |
| Synchronized reveal + score | UNKNOWN | — | — | Multi-client state equality proof |
| Recovery from disconnect / reconnect | UNKNOWN | — | — | Failure-path test |
| Replay/rematch same room | UNKNOWN | — | — | End-to-end run |
| Pressure audio / visual escalation | UNKNOWN | — | — | UI + accessibility proof |
| Light / dark mode | UNKNOWN | — | — | Visual/browser proof |
| Deterministic room/state fingerprint | UNKNOWN | — | — | Protocol test |
| Secret scan / publication review | UNKNOWN | — | — | CI / manual evidence |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | UNKNOWN | — | — | Deploy |
| Room-code join | UNKNOWN | — | — | Production multiplayer proof |
| No login required | UNKNOWN | — | — | Production browser proof |
| No app install required | UNKNOWN | — | — | Production browser proof |
| Phone + laptop usable | UNKNOWN | — | — | Responsive/device proof |
| Replayable multiplayer loop | UNKNOWN | — | — | Production E2E |
| Separate-context Playwright proof | UNKNOWN | — | — | Required before completion claim |

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
