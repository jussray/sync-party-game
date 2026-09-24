# SYNC council decision

## North Star
A new player can receive a link, enter a name, understand the game without instructions, make a meaningful multiplayer decision within 30 seconds, and trust that every connected device agrees on what happened.

## Locked requirements
- Standalone repository and public URL.
- No login or install.
- Room code join flow.
- Authoritative room state. Clients submit intent, never winners/scores/phases.
- 2–8 players.
- Reconnect identity stored locally.
- Dark and light themes.
- Opt-in party audio, with escalating final-five-second cues; always mutable.
- State-transition receipts with deterministic state hashes.
- Playwright multi-context proof before completion.
- Pressure Party mutations: Classic Sync, Twin, Odd One Out, Reverse, Perfect Sync.
- Room-wide SYNC percentage alongside individual scoring.

## Scope discipline
Game first, reusable core second. Do not prematurely extract an SDK until the working game proves the abstraction seams.
