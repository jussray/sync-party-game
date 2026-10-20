# Audio integration with current main

PR #10 predecessor `39453490ac08f1365694d607a80e4f14d77722cf` earned core-proof run `36280188989`, including Chromium and the two-browser runtime suite: VERIFIED. This supersedes the previous receipt's UNKNOWN CI row for that predecessor only.

Integration base: `ff850d1dac656ab13b252d04e4e84bcd2d1cb1f3`.
Conflicts resolved in app.js, index.html and multiplayer.spec.js: retain current main's presentation, setup flows and existing non-audio behavior; integrate the opt-in audio module, server-confirmed lock cue and phase-key deduplication. Both stylesheets remain loaded. Browser selectors follow current main's case-insensitive button labels. No Worker, gameplay, provider, governance or deployment changes from main.

VERIFIED locally: 33 Node tests, Python bugfinder, staged secret scan, syntax and diff whitespace checks. Exact integration-head browser proof remains UNKNOWN until its CI run completes. Predecessor source manifest remains historical and must not be read as this integration's identity.

Rollback: revert the eventual audio PR merge using a new reviewed change; preserve newer main work. Next gate: exact integration-head core-proof before merge, then main core-proof, public deployment identity and public Playwright. Device listening and mobile Safari audio remain UNKNOWN.
