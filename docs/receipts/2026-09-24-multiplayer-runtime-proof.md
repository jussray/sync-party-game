# Multiplayer runtime proof receipt — 2026-09-24

- Timestamp: 2026-09-24T19:45Z–20:00Z
- Exact commit: `3a4bd7f9706f53387c534d5a3944eaabba8802e3` (merge of feature `2a8dfea` with main `8473f9c`)
- Branch: `claude/sync-pressure-party-multiplayer-rpszoh`
- Environment: Linux cloud container, Node 22.22.2, wrangler 4.135.0 (`wrangler dev`, local mode: real workerd Worker + SQLite Durable Object, no mocks), @playwright/test 1.63.0 on preinstalled Chromium (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`)
- Scope: LOCAL runtime only. **Not** production. No public URL exists yet.

## Findings that changed code

| Finding | How found | Fix |
|---|---|---|
| Original e2e spec could never pass: theme assertion assumed dark default; `getByLabel("Nickname")` matched 2 inputs | First real Playwright run | Spec rewritten (parallel agent fixed the same on main `577ef7a`/`de140f8`; merged) |
| Host disconnect stalls room (only host may advance) | `scripts/attack.mjs` against real DO | `transferHostIfGone` on disconnect |
| No LOCK → tension → REVEAL beat (spec requirement) | Requirements review | `locked` phase, 1.5 s, answers private, DO alarm reveals; `revealRound` rejects any other phase (no double scoring) |
| Disconnect could leave remaining all-answered players waiting for the timer | Code review | Re-check on disconnect |
| Receipts not observable → continuity unprovable | Attack harness | `GET /api/rooms/:code/receipts`; receipts now carry round + phase |
| `null` / non-object intent reached handlers | Attack harness | Rejected as `Bad message` |

Concurrency note (INFERRED, not a fix): 8 simultaneous submissions per round never lost or overwrote an answer across 6 attacked games; the DO uses only storage awaits + `crypto.subtle` inside a mutation, so no serialization layer was added.

## Commands and observed results

| Command | Expected | Observed |
|---|---|---|
| `npm run verify` | node tests + Python bug finder green | 13/13 pass; `BUGFINDER PASS` |
| `PW_TRACE=on PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` | 4 tests (flow + a11y × desktop, Pixel 7) | **4 passed (47.1 s)** |
| `ATTACK_SEED={7,11,23} ATTACK_GAMES=2 node scripts/attack.mjs` | 8 players converge; no lost/leaked/forged/double-advanced state | **ATTACK PASS ×3**, 6 games, receipts 83–84 per game, contiguous hash chain |
| Mutation: expose answers in `locked` | spec must fail | Failed at "no answer values reach another client before reveal" (then reverted) |

Proof path covered by `e2e/multiplayer.spec.js` (two `browser.newContext` contexts): landing → theme toggle + persistence → create → code → guest join → presence 2/2 both sides → start → identical round/mode/prompt ×5 modes (Classic, Twin, Odd One Out, Reverse, Perfect Sync) → host submit → guest WebSocket frames contain no answer values → forged overwrite + `SET_SCORE` on a fresh socket rejected (`Choice already locked`, `Unknown action`) → LOCKED beat → identical result rows, SYNC %, state hash → guest reload keeps identity + hash → final leaderboard equal, final room SYNC 70% both → rematch same room, playable to 100% → receipts chain ends at the client's hash. Accessibility test: sound off by default, toggle `aria-pressed`, keyboard-only create, reduced-motion honored, share link pre-fills code, no horizontal scroll.

Attack harness covers: 9th join rejected, forged token and forged player rejected, non-host start, score/phase mutation intents, malformed JSON / `null`, duplicate START, late join rejected, random refresh each round, simultaneous + duplicate + overwrite submissions, timer expiry via DO alarm, host drop + transfer, duplicate NEXT_ROUND, rematch.

Artifacts: screenshots `test-results/*/0[1-7]-*.png` and traces (local, gitignored); CI uploads them as `playwright-evidence` on every run.

## Not proven here

- **Production deploy / public URL: BLOCKED.** No Cloudflare credentials in the container, and the Cloudflare connector has no deploy tool. `.github/workflows/deploy.yml` (`deploy-and-prove`) deploys and runs this same spec + attack against the workers.dev URL once `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`) repo secrets exist.
- Audible audio (headless browsers were muted); real physical phones; iOS Safari/WebKit.

## Rollback

`git revert -m 1 3a4bd7f` then `git revert 2a8dfea` on the branch (no history rewrite). No deployment exists, so there is nothing to roll back in Cloudflare.
