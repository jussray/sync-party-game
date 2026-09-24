#!/usr/bin/env python3
"""Independent red-team verifier for Sync Party.

Python does not implement the game. It inspects the authoritative JavaScript,
checks authority/privacy invariants, verifies that the real browser proof covers
the complete replayable loop, mobile layout, pre-reveal privacy, and the
server-side timeout path, then runs the Node game tests independently.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"BUGFINDER FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def read(path: str) -> str:
    target = ROOT / path
    if not target.exists():
        fail(f"missing required file: {path}")
    return target.read_text(encoding="utf-8")


def require(source: str, pattern: str, message: str) -> None:
    if not re.search(pattern, source, re.MULTILINE | re.DOTALL):
        fail(message)


def forbid(source: str, pattern: str, message: str) -> None:
    if re.search(pattern, source, re.MULTILINE | re.DOTALL):
        fail(message)


def verify_worker(worker: str) -> None:
    require(worker, r'class GameRoom extends DurableObject', "room authority is not a Durable Object")
    require(worker, r'player\.resumeToken\s*!==\s*token', "resume token is not checked before websocket authority")
    require(worker, r'submitChoice\(state,\s*playerId,\s*action\.choiceIndex\)', "choice authority is not bound to websocket player identity")
    require(worker, r'if \(state\.phase !== "results"\) throw new Error\("Cannot rematch now"\)', "REMATCH is missing an authoritative results-phase gate")
    forbid(worker, r'startGame\(\{\s*\.\.\.state,\s*phase:\s*["\']results["\']\s*\}', "REMATCH can spoof the room phase")
    forbid(worker, r'\.\.\.action\s*[,}]', "client action object is spread into authoritative state")
    forbid(worker, r'action\.(?:scores|score|phase|hostId|stateHash)\b', "client controls an authoritative state field")
    require(worker, r'hash\(publicFingerprint\(next\)\)', "public state hash can expose hidden choice values")
    forbid(worker, r'answers:\s*next\.answers', "public state hash includes raw hidden answers")
    require(worker, r'previousStateHash', "continuity receipt is missing previous state hash")
    require(worker, r'stateHash', "continuity receipt is missing state hash")
    require(worker, r'async alarm\(\)', "Durable Object timeout alarm handler is missing")


def verify_game(game: str) -> None:
    require(game, r'if \(state\.hostId !== actorId\) throw new Error\("Only the host can start"\)', "start authority guard missing")
    require(game, r'if \(state\.hostId !== actorId\) throw new Error\("Only the host can advance"\)', "advance authority guard missing")
    require(game, r'Choice already locked', "duplicate choice protection missing")
    require(game, r'resumeToken,\s*\.\.\.safe', "public state no longer strips resume tokens")
    require(game, r'export function publicFingerprint', "public fingerprint privacy boundary is missing")
    require(game, r'answers:\s*publicAnswers\(state\)', "public fingerprint no longer uses redacted answers")
    require(game, r'state\.phase === "reveal" \|\| state\.phase === "results"', "answers may be exposed before reveal")
    require(game, r'top\s*>\s*total\s*/\s*2', "Classic mode no longer requires a true majority")


def verify_e2e(e2e: str) -> None:
    contexts = len(re.findall(r'browser\.newContext\s*\(', e2e))
    if contexts < 2:
        fail("Playwright proof does not use at least two independent browser contexts")
    require(e2e, r'width:\s*1280', "Playwright proof does not exercise a laptop-sized host viewport")
    require(e2e, r'width:\s*390', "Playwright proof does not exercise a phone-sized guest viewport")
    require(e2e, r'expectFitsViewport\(guest\)', "Playwright proof does not assert mobile horizontal fit")
    require(e2e, r'guest\.reload\(\)', "Playwright proof does not exercise reconnect")
    require(e2e, r'Create a game', "Playwright proof does not create a room through UI")
    require(e2e, r'Join a game', "Playwright proof does not join a room through UI")
    require(e2e, r'\.choice\.selected', "Playwright proof does not assert that another player's locked choice stays hidden")
    require(e2e, r'toBeEnabled\(\)', "Playwright proof does not confirm the other player can still choose privately")
    require(e2e, r'100%', "Playwright proof does not assert synchronized reveal result")
    require(e2e, r'round:\s*5|round\s*<\s*5', "Playwright proof does not reach the final round")
    require(e2e, r'See final scores', "Playwright proof does not transition to final results")
    require(e2e, r'GAME OVER', "Playwright proof does not verify final results on both clients")
    require(e2e, r'FINAL ROOM SYNC', "Playwright proof does not verify the final room synchronization summary")
    require(e2e, r'Play again', "Playwright proof does not exercise same-room rematch")
    require(e2e, r'room=\$\{code\}', "Playwright proof does not preserve the room across replay")
    require(e2e, r'Durable Object alarm reveals a round', "Playwright proof does not exercise the server timeout alarm")
    require(e2e, r'timeout:\s*20000', "timeout proof does not allow the real round deadline to elapse")
    require(e2e, r'"0%"', "timeout proof does not assert the no-answer reveal result")


def run_node_tests() -> None:
    tests = sorted(str(path.relative_to(ROOT)) for path in (ROOT / "test").glob("*.test.mjs"))
    if not tests:
        fail("no Node game tests found")
    process = subprocess.run(["node", "--test", *tests], cwd=ROOT, text=True, capture_output=True)
    if process.returncode != 0:
        fail("Node game tests failed under Python orchestration:\n" + process.stdout + process.stderr)


def main() -> None:
    worker = read("src/worker.js")
    game = read("src/game.js")
    e2e = read("e2e/multiplayer.spec.js")
    verify_worker(worker)
    verify_game(game)
    verify_e2e(e2e)
    run_node_tests()
    print("BUGFINDER PASS: authority, privacy, continuity, mobile, timeout, full multiplayer proof shape, and Node tests are green")


if __name__ == "__main__":
    main()
