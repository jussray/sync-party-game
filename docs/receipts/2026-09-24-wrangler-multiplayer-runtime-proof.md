# SYNC Wrangler multiplayer runtime proof — 2026-09-24

## Authority
- Repository: `jussray/sync-party-game`
- Branch: `main`
- Full-loop implementation proof SHA: `dfe36245cf3ef7d1659438830500aeb498ffd303`
- Stricter Python proof successor SHA: `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`
- GitHub Actions full-loop run: `36050346725` / run #15
- GitHub Actions Python-successor run: `36050519734` / run #17
- Runtime: Wrangler `4.135.0` local Cloudflare Worker + Durable Object on GitHub-hosted Ubuntu runner
- Browser: Playwright Chromium via `@playwright/test` `1.63.0`

## VERIFIED
Run #17 completed successfully with every proof step green:
- JavaScript syntax checks
- Python 3.12 syntax check
- 10/10 Node game-rule tests
- independent Python bug finder
- pinned runtime dependency install
- Playwright Chromium install
- real Wrangler Worker + Durable Object startup through Playwright `webServer`
- two independent browser contexts
- room creation through the public UI
- room-code join through the public UI
- both players present and connected
- host-only game start
- synchronized Round 1 / Classic state
- private client identities preserved locally across guest reload
- guest reconnect restored the authoritative reveal state in the same room
- synchronized reveal result visible on both browsers
- rounds 2–5 traversed across Twin, Odd One Out, Reverse, and Perfect Sync modes
- final GAME OVER state reached on both browsers
- final room sync summary visible on both browsers
- host Play again / REMATCH returned both browsers to synchronized Round 1 in the same room

## Failure genealogy preserved
The proof harness was allowed to fail and expose assumptions before promotion:
1. Run `36049395972` failed because the test hardcoded an initial dark theme. The product toggle behaved correctly. Failure artifact ID: `10829578795`.
2. Run `36049520537` failed because an ambiguous Playwright label matched both nickname inputs. Failure artifact ID: `10830031093`.
3. Run `36049659251` reached create/join/start/reveal/reconnect but incorrectly expected the guest nickname on the reveal screen, which intentionally does not render the player list. Failure artifact ID: `10829199404`.
4. The reconnect assertion was corrected to verify room URL, authoritative reveal state, synchronized result, and unchanged stored player identity.
5. Run `36050107591` then passed the one-round reconnect heartbeat.
6. Run `36050346725` passed the expanded five-round final-results/rematch proof.
7. Python was tightened to require the full replay proof shape, and run `36050519734` passed the entire chain again.

No failed signal was suppressed or relabeled as success.

## NOT YET VERIFIED
- public Cloudflare production URL
- production WebSocket/Durable Object behavior over the public internet
- phone-sized/mobile-browser usability
- countdown timeout/alarm behavior in Playwright
- hidden-choice non-disclosure with an explicit browser assertion
- audible pressure/SFX output
- branch protection/ruleset
- secret/publication scan

## Rollback
- Runtime proof CI expansion: revert `50c313607a25e4ee133224377bee9bc5a8ee5419`.
- Full-loop Playwright proof: revert `dfe36245cf3ef7d1659438830500aeb498ffd303` and its selector/reconnect predecessors if necessary.
- Python full-loop requirement: revert `b8efce1f7a48aeaa93d7bffd0dc9f9fa56099dd1`.

These are proof-harness changes and can be reversed without deleting the multiplayer product implementation.

## Next proof gate
Deploy the exact green successor to a public Cloudflare URL, then run a production-targeted Playwright test against that URL without starting a local Wrangler server. Preserve the exact deployed SHA, production URL, run ID, traces/screenshots on failure, and successor linkage.
