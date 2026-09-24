#!/usr/bin/env python3
"""Independent red-team verifier for Sync Party.

Python does not implement the game. It inspects the authoritative JavaScript,
checks authority/privacy invariants, verifies that the real two-browser proof
exists, and then runs the Node game tests as an independent orchestration lane.
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
    require(worker, r'previousStateHash', "continuity receipt is missing previous state hash")
    require(worker, r'stateHash', "continuity receipt is missing state hash")


def verify_game(game: str) -> None:
    require(game, r'if \(state\.hostId !== actorId\) throw new Error\("Only the host can start"\)', "start authority guard missing")
    require(game, r'if \(state\.hostId !== actorId\) throw new Error\("Only the host can advance"\)', "advance authority guard missing")
    require(game, r'Choice already locked', "duplicate choice protection missing")
    require(game, r'resumeToken,\s*\.\.\.safe', "public state no longer strips resume tokens")
    require(game, r'state\.phase === "reveal" \|\| state\.phase === "results"', "answers may be exposed before reveal")


def verify_e2e(e2e: str) -> None:
    contexts = len(re.findall(r'browser\.newContext\(', e2e))
    if contexts < 2:
        fail("Playwright proof does not use two independent browser contexts")
    require(e2e, r'guest\.reload\(\)', "Playwright proof does not exercise reconnect")
    require(e2e, r'Create a game', "Playwright proof does not create a room through UI")
    require(e2e, r'Join a game', "Playwright proof does not join a room through UI")
    require(e2e, r'100%', "Playwright proof does not assert synchronized reveal result")


def run_node_tests() -> None:
    process = subprocess.run(
        ["node", "--test", "test/*.test.mjs"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        shell=False,
    )
    # Node does not expand globs without a shell, so retry with discovered files.
    if process.returncode != 0:
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
    print("BUGFINDER PASS: authority, privacy, continuity, multiplayer proof shape, and Node tests are green")


if __name__ == "__main__":
    main()
