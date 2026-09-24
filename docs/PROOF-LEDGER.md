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
| Pure game transition/scoring rules | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Node suite green in Actions run `36067001337`; earlier privacy/fingerprint tests expanded suite to 12/12 | Keep rule tests independent of browser proof |
| Python independent bug-finder lane | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Python 3.12 bug-finder green in run `36067001337`; verifies game authority/privacy, browser proof shape, and deploy authority | Keep Python non-authoritative and independent of game implementation |
| Production deploy authority workflow | VERIFIED | workflow `981e393a3049ec6bc6b3ba89fec09b37f6a7b5df`; Python guard `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Manual exact-head workflow exists; Python rejects push deploy, authority loss, unpinned Wrangler, or production-proof drift; run `36067001337` green | Actual production dispatch still required |
| REMATCH phase authority | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Phase-spoof fix `06dc6f10...`; Python guard; successful same-room rematch inherited and re-run in `36067001337` | Re-prove at public URL |
| Main branch protection / ruleset | BLOCKED | — | GitHub branch metadata reports `protected:false` | Enable ruleset requiring appropriate checks/review |
| Room create / join | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Two-browser Wrangler UI flow passed again in run `36067001337` | Re-prove at public URL |
| 2+ player synchronized state | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Independent laptop/phone contexts traverse authoritative room state in run `36067001337` | Re-prove at public URL |
| Timed choice lock / timeout alarm | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Real 15-second Durable Object alarm/no-answer reveal is part of the green Playwright suite in run `36067001337`; duplicate lock also unit-tested | Production proof |
| Hidden choices before reveal | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Node privacy/fingerprint tests + explicit two-client pre-reveal browser non-disclosure assertion; run `36067001337` green | Re-prove production |
| Synchronized reveal + score | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Both browsers observe authoritative synchronized reveal/scoring across the full suite in run `36067001337` | Production proof |
| Recovery from disconnect / reconnect | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Guest reload restores room/identity/authoritative state in the green full browser suite | Re-prove over public internet |
| Replay/rematch same room | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Five rounds → GAME OVER → Play again → synchronized Round 1 in same room; run `36067001337` | Production proof |
| Pressure audio / visual escalation | UNKNOWN | implementation present | Source/UI exists; audible output and final-five-second runtime not explicitly proven | Browser/audio/accessibility proof |
| Light / dark mode | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Environment-independent toggle + reload persistence retained in green browser suite | Optional visual snapshots |
| Phone viewport horizontal fit | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | 390×844 guest context + explicit no-horizontal-overflow assertions pass in run `36067001337` | Physical-device polish remains optional |
| Deterministic room/state fingerprint | INFERRED | implementation + Node privacy/fingerprint tests | Public fingerprint redaction is unit-tested and Python guards raw-answer leakage; exact runtime receipt equality is not asserted end-to-end | Add protocol-level receipt assertion if needed |
| Secret scan / publication review | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | `scripts/secret_scan.py` passed before runtime proof in Actions run `36067001337` | Re-run before every production mutation |

## Handshake gates — PRIMARY

| Gate | State | Exact SHA / version | Evidence | Risk / next proof |
|---|---|---|---|---|
| Mission contract verified | VERIFIED | 2026-09-24 source check | Handshake mission page + `docs/audits/2026-09-24-handshake-multiplayer-audit.md` | Re-check before submission |
| Own public URL | BLOCKED | deploy lane ready at `981e393a3049ec6bc6b3ba89fec09b37f6a7b5df` | No actual Cloudflare production dispatch / emitted deployment URL observed yet | Run manual exact-current-main Deploy workflow and require production Playwright PASS |
| Room-code join | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` local Wrangler runtime | Real browser create/join in run `36067001337` | Production proof still required |
| No login required | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` local Wrangler runtime | Full browser flow completes without auth/login | Production proof |
| No app install required | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` local Wrangler runtime | Browser-only served web app | Production proof |
| Phone + laptop usable | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` local Wrangler runtime | 1280-wide host + 390×844 guest complete multiplayer flow with no horizontal overflow in run `36067001337` | Production internet proof |
| Replayable multiplayer loop | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` local Wrangler runtime | Full five-round + same-room rematch proof in run `36067001337` | Production E2E |
| Separate-context Playwright proof | VERIFIED | `a07dc550ea7d5882781a1e5ffce736d8ab87eace` | Independent contexts + real Wrangler/Durable Object passed in run `36067001337` | Production-targeted Playwright next |
| Production-targeted Playwright | BLOCKED | workflow prepared | `.github/workflows/deploy.yml` consumes Wrangler `deployment-url` as `PLAYWRIGHT_BASE_URL` and preserves receipt/artifacts; no deploy run observed yet | Manual production dispatch |

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
- Full-loop run: `36050346725` / run #15 — SUCCESS
- Python full-proof successor: `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`
- Strong mobile/privacy/timeout + deploy-aware successor: `a07dc550ea7d5882781a1e5ffce736d8ab87eace`
- Current proof run: `36067001337` / run #44 — SUCCESS
- Runtime receipt: `docs/receipts/2026-09-24-wrangler-multiplayer-runtime-proof.md`
- Production-readiness receipt: `docs/receipts/2026-09-24-production-deploy-readiness.md`
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
