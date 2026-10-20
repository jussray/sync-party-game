# Multiplayer Authority + Dependency Hardening Receipt

Date: 2026-09-24
Repository: `jussray/sync-party-game`
Promotion lane: `proof` -> exact green SHA -> fast-forward `main`
Baseline main before this attack: `bfc447eb929839828b59e44c74d523b6b17152c7`
Implementation candidate: `7c1a09429e47098fd733faf2603fd6bdd2c944d0`

## Goal

Harden reconnect/session authority and make npm dependency installation reproducible without weakening the existing multiplayer proof chain.

## Changes

- Every accepted player WebSocket receives a unique connection id.
- Durable Object storage records the currently authoritative connection id per player.
- A reconnect replaces and closes an older socket for the same player with code `4001` / `Session replaced`.
- Messages from stale sessions are rejected before game actions are evaluated.
- Closing an old socket cannot mark a newer replacement session disconnected.
- WebSocket messages above 2048 bytes are closed with code `1009` before JSON parsing.
- Added browser-level authority/reconnect and oversized-message tests.
- Added `package-lock.json` generated under Node `22.23.2`, reviewed by SHA-256 `803b9eeab23f5adcbf8473e52430d4c30180452295fa537fea1d4d8d5e35da8e` before commit.
- Removed the temporary lockfile bootstrap workflow after use.
- CI now installs dependencies with `npm ci --ignore-scripts --no-audit --no-fund` rather than unconstrained `npm install`.

## Evidence

- Authority/reconnect implementation began at `0531a8caa622bc29172be20aaaac9bd9a175b3d3`.
- The first new browser proof failed and its Playwright evidence was preserved rather than hidden.
- A second failure at `53609bd27a0c383dba52b006a6b969f3e270a644` exposed a test-helper bug: `hasMessage` failed to pass its socket key into `page.evaluate`. The trace showed the server had actually returned `PONG` frames.
- Test-helper fix: `3fd92d165b1698c353044b88cdf70c0e70be4f7b`.
- Full proof run `36057972802`: SUCCESS with ancestry, syntax, secret scan, 12 Node tests, Python bug finder, and Wrangler/Playwright E2E.
- Lockfile generation run `36058123159`: SUCCESS; artifact `package-lock-bootstrap` was generated without lifecycle scripts and bound to the reviewed SHA-256 before commit.
- Lockfile commit: `bec5f421b571c7bcc92abde1bc97b05e423703ce`.
- Immutable-install candidate: `7c1a09429e47098fd733faf2603fd6bdd2c944d0`.
- Full proof run `36058390703`: SUCCESS; locked dependency install and complete Wrangler/Playwright E2E both passed.

## Status

- Reconnect stale-session revocation: VERIFIED on local Wrangler runtime in GitHub Actions.
- Server-side host authority under direct WebSocket actions: VERIFIED.
- Oversized WebSocket message rejection: VERIFIED.
- Existing multiplayer create/join/mobile/reconnect/rematch/timeout flows after hardening: VERIFIED by the full E2E suite.
- Reproducible npm dependency graph: VERIFIED for the committed lockfile and `npm ci` CI path.
- Production/public-internet abuse resistance: UNKNOWN until production-targeted proof exists.
- GitHub admin branch/ruleset enforcement: BLOCKED; `main` protection remains an external repository-admin gate.

## Rollback

Fast-forward changes are linear. Revert the hardening commits in reverse order if a production regression is proven. Do not force-push `main`. The known-green pre-hardening baseline is `bfc447eb929839828b59e44c74d523b6b17152c7`.

## Next proof gate

Before claiming production-grade multiplayer resilience, prove the exact deployed SHA over a public URL with two independent clients, reconnect replacement, direct non-host authority rejection, message-size rejection, and state continuity receipts.
