# Amazon Appdev 2026 Competition Contract

Status: founder-approved baseline. Reconcile against the current official rules before final submission.

## Founder value

Build one competition-grade product, not a pile of features. Every material change must improve player delight, judging score, eligibility, reproducibility, or submission proof.

## Product thesis

A living-room party game where Fire TV is the shared arena, phones provide private player input, timed audiovisual pressure changes behavior, and Amazon-native capabilities make the experience stronger rather than merely qualifying it.

## Required complete loop

1. Create or enter a room.
2. Multiple players join reliably.
3. Host starts a round.
4. Players receive understandable private choices.
5. Timer begins and pressure escalates accessibly.
6. Choices lock deterministically.
7. Shared screen reveals the outcome.
8. Scores/state synchronize correctly.
9. Next round starts without rebuilding the room.
10. Winner / session resolution is clear and replayable.

Until that loop is verified, additional modes are secondary.

## Judging contract

Each substantive feature must name at least one scoring job:

- **Technical Implementation:** real Amazon/device integration, reliable multiplayer state, reproducible architecture.
- **Design:** fast join, legible 10-foot UI, understandable state, useful light/dark treatment, sound with mute/accessibility behavior, polished recovery states.
- **Potential Impact:** repeatable social use, family/friend replay value, plausible product path.
- **Idea Quality:** multimodal room interaction, private-vs-public tension, adaptive pressure, memorable reveal mechanics.

## Protection gates

- No credential or secret may enter git history.
- No fabricated usage, judge, performance, or integration claim.
- No mock/fallback may be presented as real-path proof.
- No direct claim of Amazon-device success without Amazon runtime/simulator evidence.
- No unrelated refactor during launch-critical repair.
- No destructive migration without an explicit rollback.
- Preserve third-party license notices and asset provenance.
- Record successful proof against an exact commit SHA.
- Preserve failed evidence too; failure history is useful for friction reporting and debugging.

## Open-source boundary

Do not license the entire game merely to qualify for an open-source opportunity. If an eligible reusable component is contributed, isolate it under a bounded path/package and give that component the appropriate explicit license plus provenance.

## Stop condition

A release candidate is ready for submission rehearsal only when the complete loop is VERIFIED, required Amazon technology is VERIFIED, the source is reproducible, the evidence ledger is current, the demo can be recorded truthfully, and no known eligibility blocker remains.
