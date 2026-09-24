# GitHub Protection Audit Receipt — 2026-09-24

## Authority

- Repository: `jussray/sync-party-game`
- Branch: `main`
- Founder authority: `@jussray`
- Audit goal: reduce source, CI, credential, multiplayer-integrity, and continuity risk without broad refactors.

## Inspected

- `main` branch protection metadata
- GitHub Actions workflow and recent runs
- Durable Object room authority and state receipts
- public/private answer projection and state fingerprinting
- Node rule tests
- Python bug-finder
- Playwright two-context multiplayer proof
- repository secret-handling controls

## VERIFIED

- CI security hardening is in history at `595e71e39bf04a352260d85fba8a01749945d159`: immutable action SHAs, fixed runner/toolchain versions, read-only token permissions, and checkout credentials not persisted.
- Hidden choice values are excluded from the public pre-reveal fingerprint via `publicFingerprint()`; regression coverage landed at `cb0e936e8c7355d4bf45fb5578233e40621032fc` and the Python guard at `2fc19e5acc3738aead21837a13d5f2b7d24ee2b5`.
- The Python proof-shape checker was repaired at `752f7f11b0b650f1bb1a6a4a967c85701f240eef` so configured Playwright contexts are recognized without weakening the requirement for two independent contexts.
- Mobile-width privacy and Durable Object timeout/alarm proof are enforced by the current E2E/Python lanes inherited through `ac29919ccfc1db7a8a15dd302e6670548e23aa51`.
- High-confidence committed-secret scanning landed at `ea26cd78a2fa91aa196ec1808c7bbd0fe9730c5a`. It rejects tracked secret-bearing filenames and common high-confidence credential formats without printing matched values.
- GitHub Actions run `36051557343` for `ea26cd78a2fa91aa196ec1808c7bbd0fe9730c5a` completed successfully: syntax, secret scan, Node tests, Python bug-finder, dependency install, Chromium install, and the real two-browser Wrangler/Playwright runtime proof all passed.

## BLOCKED

- `main` is still reported by GitHub as `protected:false`; required status-check enforcement is off. CODEOWNERS and CI exist, but they are not branch-enforcement controls by themselves.
- The connected GitHub mutation surface used in this audit does not expose ruleset/branch-protection creation, so no claim is made that `main` is locked.

## UNKNOWN / not yet promoted

- Public production URL proof
- Fire TV runtime/simulator proof
- Alexa+ integration proof
- AWS integration proof
- Reproducible npm transitive dependency lockfile (`package-lock.json` is not currently committed)

## Rollback

- Secret scan: revert `ea26cd78a2fa91aa196ec1808c7bbd0fe9730c5a`.
- CI pinning: revert `595e71e39bf04a352260d85fba8a01749945d159` only if an immutable action/toolchain pin is proven incompatible.
- Hidden-choice fingerprint repair: revert `cb0e936e8c7355d4bf45fb5578233e40621032fc` only with an equivalent privacy-preserving replacement; reverting without replacement reopens pre-reveal inference risk.

## Next gate

Enable a GitHub ruleset for `main` that requires the `core-proof` check, prevents force pushes/deletion, and requires the intended founder review policy. Then re-read branch metadata and record the ruleset/protection receipt before calling repository enforcement VERIFIED.
