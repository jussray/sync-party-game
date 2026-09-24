# Verified Promotion Contract

## Purpose

`main` is the release/source-of-truth branch. `proof` is the verification branch.
This contract prevents our own workflow from advancing `main` with an unproven commit while GitHub branch protection remains unavailable to the current connector.

## Required flow

1. Start work from the current `main` head on `proof`.
2. Make the smallest scoped change on `proof`.
3. Let `core-proof` run against the exact `proof` SHA.
4. Require every gate to pass: ancestry guard, syntax, secret scan, Node tests, Python bug finder, dependency install, Chromium install, and two-browser Wrangler/Playwright runtime proof.
5. Re-read both branch heads immediately before promotion.
6. Promote only when:
   - the tested `proof` SHA is still the `proof` head,
   - `main` has not advanced outside that candidate lineage,
   - the successful workflow run is bound to that exact SHA,
   - the update to `main` is a fast-forward.
7. Never force-push `main` or `proof` as part of promotion.
8. If `main` advances concurrently and is no longer an ancestor of `proof`, stop. Rebuild the candidate from the new `main` head and rerun proof.

## Authority and status

This is a process guard, not a substitute for a GitHub ruleset.
Until GitHub reports `main` as protected with required checks enabled, repository-enforced branch protection remains `BLOCKED`.

## No-PR lane

This workflow intentionally does not require creating a new pull request. The proof branch is the candidate lane; an exact green SHA is the promotion unit.

## Proof rule

A green run on another SHA does not authorize promotion. A green run that predates later candidate changes does not authorize promotion. Only the exact tested candidate SHA may advance `main`.
