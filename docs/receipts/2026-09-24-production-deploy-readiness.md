# SYNC Production Deploy Readiness Receipt — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Product: SYNC Party
- Primary mission: Handshake multiplayer game

## VERIFIED source/runtime baseline
- Exact verified head: `a07dc550ea7d5882781a1e5ffce736d8ab87eace`
- GitHub Actions workflow: `core-proof`
- Run: `36067001337` / run #44
- Result: SUCCESS
- Secret scan: PASS
- Node game tests: PASS
- Python bug finder: PASS
- Locked dependency install: PASS
- Chromium install: PASS
- Real Wrangler + Durable Object multiplayer Playwright: PASS

## Verified multiplayer behavior inherited by run #44
- independent laptop host and phone-sized guest contexts
- room create/join through the UI
- authoritative synchronized room state
- hidden choices before reveal
- synchronized reveal/scoring
- refresh/reconnect continuity
- five-round completion
- GAME OVER / final room sync
- same-room rematch
- real Durable Object timeout/alarm reveal
- no horizontal overflow in the phone viewport
- no login or app installation in the browser flow

## Production deployment lane
Created `.github/workflows/deploy.yml` at commit `981e393a3049ec6bc6b3ba89fec09b37f6a7b5df`.

The production lane is deliberately manual and fail-closed:
1. `workflow_dispatch` only
2. requires `expected_head_sha`
3. requires a founder approval reference
4. checks the approved SHA is exactly current `main`
5. validates Cloudflare deployment credential shape without printing values
6. reruns secret scan, Node tests, and Python bug finder before mutation
7. deploys with pinned Cloudflare Wrangler Action v4 commit and Wrangler `4.135.0`
8. consumes Wrangler's emitted `deployment-url`
9. runs the full Playwright suite against that public HTTPS URL
10. leaves a `production-proof.txt` receipt and retained proof artifacts

## Python red-team extension
At `a07dc550ea7d5882781a1e5ffce736d8ab87eace`, `scripts/bugfinder.py` also verifies the deployment workflow itself. It fails if production becomes push-triggered, loses exact-head authority, loses Cloudflare account/token authority, unpins Wrangler, disconnects Playwright from the emitted deployment URL, or stops preserving production proof evidence.

## UNKNOWN / BLOCKED
- No actual production deploy workflow run has been executed or observed in this receipt.
- No public Cloudflare deployment URL has been observed.
- Production-targeted Playwright is therefore not yet VERIFIED.
- The current ChatGPT GitHub connector can edit/read workflows but does not expose workflow-dispatch execution.
- A direct Cloudflare deployment connector was not returned by the current plugin-directory search.
- `main` branch protection remains disabled according to GitHub branch metadata.

## Stop condition
Do not call the Handshake deployment complete until an exact-current-main manual production dispatch succeeds and its public Cloudflare URL passes the full production Playwright job.

## Rollback
- Revert `981e393a3049ec6bc6b3ba89fec09b37f6a7b5df` to remove the deploy workflow.
- Revert `a07dc550ea7d5882781a1e5ffce736d8ab87eace` to remove deploy-workflow checks from Python while preserving earlier game/runtime verification.
- A failed deploy/proof run must not be relabeled as success; preserve the run and artifacts as failure evidence.
