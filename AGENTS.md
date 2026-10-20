# SYNC Agent Contract

Before substantive work in this repository, load and follow:

1. `AGENTS_FOUNDER_INTELLIGENCE.md`
2. `docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`

Repository-local product, privacy, runtime, release, and verification rules may strengthen those contracts but may not weaken them.

## Source of truth

For SYNC implementation truth, authority is ordered as follows:

1. exact deployed runtime evidence and real-path browser proof
2. the authoritative `jussray/sync-party-game` source at an exact SHA
3. current continuity/control-room receipts and fingerprints
4. older documentation or chat context
5. inference

Do not build forward from a known bad, stale, failing, or unverified state. Repair or revert it first, prove the repaired path, then continue.

## Product boundary

SYNC has independent presentation surfaces, but one authoritative multiplayer game contract. The Durable Object game state remains gameplay authority. The SYNC Control Room is observational and must not become a gameplay dependency. Founder Control Room may consume privacy-safe evidence, but that relay grants no implicit gameplay mutation authority.

## Verification

Browser/runtime changes require Playwright evidence. Production claims require the repository's exact-green-SHA promotion and public runtime identity proof.
