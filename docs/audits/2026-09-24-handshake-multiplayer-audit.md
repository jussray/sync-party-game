# Handshake Multiplayer Mission Audit — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Mission: Handshake — Create a Multiplayer Game with OpenAI
- Product: `Sync Party` / flagship game `SYNC`

## Current Handshake contract — VERIFIED
Handshake's current public mission page says:
- use ChatGPT Work to think through, design, build, test, and ship the multiplayer game;
- publish a live, reusable multiplayer game at its own public URL;
- groups join with a room code;
- no login;
- no app install;
- replayable from phone or laptop;
- current challenge deadline: October 31, 2026.

The public mission does **not** state that an OpenAI model must be a runtime dependency inside the game. OpenAI/ChatGPT Work is the build workflow requirement. Therefore SYNC will not add an AI runtime dependency solely for challenge branding. Any later AI feature must earn its place against player value, latency, privacy, cost, and reliability.

## Product / architecture decision — VERIFIED
SYNC remains a standalone multiplayer product and reusable multiplayer primitive. Handshake web is the immediate release gate. Amazon / Fire TV remains a bounded secondary adapter and cannot redefine the core product.

Current core:
- Cloudflare Worker entrypoint
- Durable Object per authoritative room
- WebSocket synchronization
- separate player identity and connection identity
- resume-token reconnect
- pure game rules in `src/game.js`
- browser client in `public/`
- deterministic public-state fingerprint / bounded receipts
- locked npm dependency graph
- Node rule/privacy tests
- Python independent bug finder
- real multi-context Playwright suite

## Historical drift found and repaired
Commit `559f471c603d7789b08cdeae9ea1047eaa454c82` temporarily shifted root authority toward the Amazon Appdev / Fire TV track. The correction preserved Amazon work while restoring product-first authority:
- `b56fc779fcc54c127f41e77b1eda944566b62841` — product-first README authority
- `bd29f284a78d8fc9b6b72bd223b0f391768503a2` — competition-neutral proof template
- `776a2683b9e6560e24cd5d0bfb3ff0352a97c02e` — competition matrix
- `a298a0b0f9856cdce306beb31c65f7f06d70c925` — proof-ledger separation

No Amazon work was deleted.

## Verified implementation repairs

### REMATCH authority bypass — FIXED
A host could previously force an active game toward rematch by spoofing a `results` phase before validation.
- Fix: `06dc6f10d3911cf6469a7dabea8c6aa2d7858b02`
- Current invariant: authoritative stored state must already be `results` before REMATCH is accepted.

### Classic tie scoring — FIXED
Classic says “match the majority,” but the initial implementation awarded a 1–1 tie.
- Fix: `cefcbed2b83f4d3d228ea2091d4194f69b715788`
- Current invariant: Classic awards only when `top > total / 2`.

### Python bug-finder lane — VERIFIED
Python is a verifier, never a second game authority. It independently checks:
- Durable Object room authority
- resume-token authority binding
- client-authority leakage
- hidden-choice / public-fingerprint privacy
- REMATCH phase safety
- mobile/laptop Playwright proof shape
- reconnect
- full five-round completion and same-room replay
- Durable Object timeout-alarm proof
- production deploy workflow authority
- Node test suite under Python orchestration

Deploy-aware Python head: `a07dc550ea7d5882781a1e5ffce736d8ab87eace`.

## Runtime proof — VERIFIED locally through real Wrangler
Exact proof head: `a07dc550ea7d5882781a1e5ffce736d8ab87eace`
GitHub Actions: `core-proof` run `36067001337` / run #44 — SUCCESS.

That run passed:
- syntax checks
- secret scan
- Node rules/privacy tests
- Python bug finder
- locked dependency install
- Chromium install
- real Wrangler Worker + Durable Object startup
- full Playwright multiplayer suite

Observed browser/runtime coverage includes:
1. laptop-sized host creates a room;
2. phone-sized guest joins with room code;
3. both share authoritative room state;
4. choices remain private before reveal;
5. both progress through the game consistently;
6. guest refresh/reconnect restores authoritative state and identity;
7. all five rounds finish;
8. GAME OVER / final room sync appears;
9. Play again returns both clients to Round 1 in the same room;
10. phone viewport is explicitly checked for horizontal overflow;
11. a separate no-answer round waits for the real Durable Object alarm and reaches the expected reveal state.

Production-readiness receipt: `docs/receipts/2026-09-24-production-deploy-readiness.md`.

## Production deployment lane — VERIFIED AS CONFIGURATION, NOT AS DEPLOYMENT
`.github/workflows/deploy.yml` was added at `981e393a3049ec6bc6b3ba89fec09b37f6a7b5df` and is guarded by Python at `a07dc550ea7d5882781a1e5ffce736d8ab87eace`.

It is deliberately fail-closed:
1. manual `workflow_dispatch` only;
2. exact current-main SHA required;
3. founder approval reference required;
4. current `main` is read back and must equal the approved SHA;
5. Cloudflare token/account credential shape is validated without printing secrets;
6. secret scan + Node + Python rerun before mutation;
7. pinned Wrangler Action + pinned Wrangler version deploy the Worker/Durable Object;
8. Wrangler's emitted HTTPS `deployment-url` becomes the production Playwright target;
9. the full multiplayer suite reruns against the public deployment;
10. a production proof receipt and artifacts are preserved.

## Handshake proof status
### VERIFIED before production
- repository/product authority
- room-code create/join
- no-login browser flow
- no-install browser flow
- laptop + phone viewport flow
- authoritative multiplayer synchronization
- pre-reveal privacy
- timeout/alarm behavior
- reconnect
- five-round completion
- same-room rematch
- light/dark theme behavior
- secret scan
- local real-Worker Playwright
- deployment workflow authority structure

### BLOCKED / not yet earned
- actual public Cloudflare URL
- actual production deployment receipt
- production-targeted Playwright PASS
- branch protection/ruleset (`main` still reports `protected:false`)
- live audio/accessibility proof remains optional polish, not a Handshake core requirement

The current ChatGPT GitHub connector can edit/read the deployment workflow but does not expose workflow-dispatch execution. A direct Cloudflare deployment connector was also not returned by the current plugin search. These tooling limits do not justify changing the hosting architecture or falsely marking production as complete.

## Risk
- Deployment-ready is not deployed.
- A public page that loads is insufficient; production WebSocket/Durable Object multiplayer must pass the same Playwright path.
- Competition-specific adapters must remain outside core authority.
- Audio must remain user-controllable and never carry required game information.
- Branch protection is still absent and should be corrected when GitHub administration authority is available.

## Rollback
All focused repairs and deployment additions are isolated commits. The production workflow can be reverted without changing the already-proven local multiplayer core. Failed production runs must remain visible as evidence and must not be relabeled green.

## Next proof gate
Manually dispatch `Deploy` using the exact current green `main` SHA and an auditable founder approval reference. Promote the public URL only if Wrangler emits the HTTPS deployment URL and the production Playwright job passes.

## Stop condition
Handshake build completion requires both:
1. the public URL exists; and
2. the full multiplayer Playwright suite passes against that public production URL.
