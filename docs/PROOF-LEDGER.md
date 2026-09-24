# Competition Proof Ledger

Use only: `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`.

A `VERIFIED` row must contain evidence tied to an exact commit SHA or immutable artifact. Do not promote a row because implementation code merely exists.

## Provenance anchor

- Repository: `jussray/sync-party-game`
- Initial founder commit: `ee3e0264a3038695d43763709262f9a871262f02`
- Initial commit timestamp: 2026-09-24
- Default branch: `main`
- Founder authority: `@jussray`

## Gates

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Repository provenance anchored | VERIFIED | `ee3e0264a3038695d43763709262f9a871262f02` | Git history | Add protection ruleset |
| Main branch protection / ruleset | BLOCKED | — | GitHub currently reports `main` unprotected | Enable ruleset requiring review + checks |
| Room create / join | UNKNOWN | — | — | Implement + multiplayer proof |
| 2+ player synchronized state | UNKNOWN | — | — | Real concurrent clients |
| Timed choice lock | UNKNOWN | — | — | Deterministic timing test |
| Pressure audio / visual escalation | UNKNOWN | — | — | UI + accessibility proof |
| Light / dark mode | UNKNOWN | — | — | Visual regression / device proof |
| Fire TV runtime | UNKNOWN | — | — | Amazon runtime or simulator evidence |
| Alexa+ game-master path | UNKNOWN | — | — | Real integration evidence |
| AWS integration | UNKNOWN | — | — | Real request/state evidence |
| Full round → reveal → score → replay | UNKNOWN | — | — | End-to-end run |
| Recovery from disconnect / reconnect | UNKNOWN | — | — | Failure-path test |
| Secret scan / publication review | UNKNOWN | — | — | CI / manual evidence |
| Amazon friction log maintained | VERIFIED | documentation baseline | `docs/FRICTION-LOG.md` | Add only genuine events |
| Demo under 3 minutes | UNKNOWN | — | — | Final cut + timer |
| Submission-rule reconciliation | UNKNOWN | — | — | Re-check official rules near submission |

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
