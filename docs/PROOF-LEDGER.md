# Competition Proof Ledger

Use only: `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`.

A `VERIFIED` row must contain evidence tied to an exact commit SHA or immutable artifact. Do not promote a row because implementation code merely exists.

## Provenance anchor

- Repository: `jussray/sync-party-game`
- Initial founder commit: `ee3e0264a3038695d43763709262f9a871262f02`
- Initial commit timestamp: 2026-09-24
- Default branch: `main`
- Founder authority: `@jussray`
- Verified game/runtime source SHA: `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c`
- Public production proof: core-proof run `36194582903`, deploy/proof run `36194666290`
- Public runtime: `https://sync-party-game.mcgill-raylene.workers.dev`
- Production proof receipt: `docs/receipts/2026-09-25-handshake-public-production-proof.md`

Documentation-only continuity commits after `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` are safe drift under the repository continuity model and do not redefine the game/runtime source subject. The moving `main` / `production` branch head must be read from GitHub and the deployed runtime identity from Cloudflare; this ledger intentionally does not freeze a self-referential “current head” value.

## Core gates

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Repository provenance anchored | VERIFIED | `ee3e0264a3038695d43763709262f9a871262f02` | Git history | Preserve lineage |
| Product-first competition routing | VERIFIED | `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` | `README.md` + `docs/COMPETITION-MATRIX.md` | Prevent adapter drift |
| Pure game transition/scoring rules | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Core-proof run `36194582903` passed the pure game suite before promotion | Keep rule tests independent of browser proof |
| Python independent bug-finder lane | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Core-proof run `36194582903` passed continuity and bug-finder checks | Keep Python non-authoritative and independent of game implementation |
| Production deploy authority workflow | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Deploy/proof run `36194666290` promoted the exact green SHA and required exact-SHA runtime identity before public Playwright | Preserve exact-SHA promotion and fail-closed drift rules |
| REMATCH phase authority | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production Playwright completed five rounds and same-room rematch in run `36194666290` | Re-prove after runtime mutations |
| Main branch protection / ruleset | BLOCKED | — | GitHub branch metadata reports `protected:false` | Enable ruleset requiring appropriate checks/review |
| Room create / join | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production Playwright in run `36194666290` | Re-prove after runtime mutations |
| 2+ player synchronized state | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Separate phone/laptop browser contexts traversed authoritative room state in public production proof | Re-prove after runtime mutations |
| Timed choice lock / timeout alarm | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production suite passed the Durable Object timeout/alarm path | Keep alarm path in production suite |
| Hidden choices before reveal | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production suite passed hidden-choice privacy before synchronized reveal | Preserve protocol-level privacy assertions |
| Synchronized reveal + score | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production suite passed reveal/scoring across independent contexts | Re-prove after scoring/runtime mutations |
| Recovery from disconnect / reconnect | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production suite passed refresh/drop reconnect continuity | Re-prove after identity/session changes |
| Replay/rematch same room | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production suite passed five rounds → results → same-room rematch | Re-prove after phase changes |
| Pressure audio / visual escalation | UNKNOWN | implementation present | Visual/runtime game flow is proven; audible output and final-five-second audio behavior are not explicitly captured as evidence | Browser/audio/accessibility proof if required |
| Light / dark mode | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Existing persistence proof remained green through exact-SHA core proof | Optional visual snapshots |
| Phone viewport horizontal fit | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Phone + laptop path passed public production Playwright; earlier suite includes explicit no-horizontal-overflow assertions | Physical-device polish remains optional |
| Deterministic room/state fingerprint | INFERRED | implementation + Node privacy/fingerprint tests | Public fingerprint redaction is unit-tested and Python guards raw-answer leakage; exact runtime receipt equality is not asserted end-to-end | Add protocol-level receipt assertion if needed |
| Secret scan / publication review | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Secret scan passed in core-proof run `36194582903` before production promotion | Re-run before every production mutation |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check official submission requirements before final submission |
| Own public URL | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` / Cloudflare build `fa870ed1-ffe4-4039-b7d8-50cc995c1354` | `/api/version` exact-SHA check + public production proof run `36194666290`; receipt `docs/receipts/2026-09-25-handshake-public-production-proof.md` | Re-prove after production mutation |
| Room-code join | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production Playwright create/join path | Re-prove after room API changes |
| No login required | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production browser flow completes without auth/login | Preserve no-login path |
| No app install required | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public browser-only production flow | Preserve browser-first path |
| Phone + laptop usable | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production proof passed separate phone + laptop contexts | Physical-device founder playtest remains useful polish |
| Replayable multiplayer loop | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Public production proof passed five rounds + results + same-room rematch | Re-prove after phase/scoring changes |
| Separate-context Playwright proof | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Core-proof run `36194582903` + public production proof run `36194666290` | Keep independent contexts |
| Production-targeted Playwright | VERIFIED | `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c` | Deploy/proof run `36194666290`: exact-SHA runtime identity PASS; 4 public production tests PASS in 30.6s; artifact preserved | Any new runtime/config/dependency mutation must earn a successor exact-SHA receipt |

## Amazon adapter gates — SECONDARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Amazon track isolated from core authority | VERIFIED | `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` | competition matrix | Keep adapter optional for Handshake |
| Fire TV runtime | UNKNOWN | — | — | Amazon runtime or simulator evidence |
| Alexa+ game-master path | UNKNOWN | — | — | Real integration evidence |
| AWS integration | UNKNOWN | — | — | Real request/state evidence |
| Amazon friction log maintained | VERIFIED | documentation baseline | `docs/FRICTION-LOG.md` | Add only genuine events |
| Amazon submission-rule reconciliation | UNKNOWN | — | — | Re-check official rules near submission |

## Runtime / deployment-readiness receipts

- Full-loop Playwright commit: `dfe36245cf3ef7d1659438830500aeb498ffd303`
- Earlier full-loop run: `36050346725` / run #15 — SUCCESS
- Strong mobile/privacy/timeout + deploy-aware successor: `a07dc550ea7d5882781a1e5ffce736d8ab87eace`
- Verified game/runtime source SHA: `ddafeae4b66c9c83b83d9ca1b4825836808b3d9c`
- Exact source core-proof run: `36194582903` — SUCCESS
- Public production deploy/proof run: `36194666290` — SUCCESS
- Cloudflare production build: `fa870ed1-ffe4-4039-b7d8-50cc995c1354`
- Public URL: `https://sync-party-game.mcgill-raylene.workers.dev`
- Public production Playwright: 4 tests passed in 30.6 seconds
- Production proof artifact: `sync-party-production-proof-36194666290-1`
- Production proof receipt: `docs/receipts/2026-09-25-handshake-public-production-proof.md`
- Documentation-only continuity commits are not enumerated as a moving “current head” in this ledger; GitHub branch state and Cloudflare runtime identity remain authoritative for that live value.
- Earlier failed proof artifacts remain part of the evidence genealogy and were not suppressed.

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


## Audio port candidate — 26 September 2026

Evidence subject: SHA-256 `27838a25f5d830fbcbad9eef1d6f5a4b5cb5fb9a426932bf39a49a3e33a0f5a3` of [source manifest](receipts/2026-09-26-audio-source-manifest.json). See [scoped receipt](receipts/2026-09-26-audio-port.md).

| Gate | State | Evidence / boundary |
|---|---|---|
| Audio lifecycle and game regression | VERIFIED | 20 local Node tests plus Python bugfinder; device seam is mocked |
| Candidate secret/continuity checks | VERIFIED | Staged implementation scan and continuity guard |
| Worker packaging | VERIFIED | Wrangler dry-run only; no deployment |
| Local browser execution | BLOCKED | Chromium download invalid/truncated |
| Candidate CI browser results | UNKNOWN | Read exact PR head CI; tests added, no assumed result |
| Audible hardware / public candidate runtime | UNKNOWN | New frontend requires fresh runtime/audio proof |
