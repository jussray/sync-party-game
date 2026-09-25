#!/usr/bin/env python3
"""Independent red-team verifier for Sync Party.

Python does not implement the game. It inspects the authoritative JavaScript,
checks authority/privacy invariants, verifies that the real browser proof covers
the complete replayable loop, mobile layout, pre-reveal privacy, and the
server-side timeout path, red-teams the exact-green production promotion and
Cloudflare-owned deployment proof chain, then runs the Node game tests independently.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile

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
    require(worker, r'url\.pathname === "/api/version"', "runtime does not expose an exact deployed-version endpoint")
    require(worker, r'env\.DEPLOY_SHA', "runtime version endpoint is not bound to the deployed git SHA")
    require(worker, r'env\.DEPLOY_BUILD', "runtime version endpoint is not bound to the Cloudflare build receipt")


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
    require(e2e, r'round:\s*5', "Playwright proof does not reach the final round")
    require(e2e, r'See final scores', "Playwright proof does not transition to final results")
    require(e2e, r'GAME OVER', "Playwright proof does not verify final results on both clients")
    require(e2e, r'FINAL ROOM SYNC', "Playwright proof does not verify the final room synchronization summary")
    require(e2e, r'Play again', "Playwright proof does not exercise same-room rematch")
    require(e2e, r'room=\$\{code\}', "Playwright proof does not preserve the room across replay")
    require(e2e, r'Durable Object alarm reveals a round', "Playwright proof does not exercise the server timeout alarm")
    require(e2e, r'timeout:\s*20000', "timeout proof does not allow the real round deadline to elapse")
    require(e2e, r'"0%"', "timeout proof does not assert the no-answer reveal result")


def verify_candidate_guard_source(guard: str, policy_text: str) -> None:
    require(guard, r'merge-base",\s*"--is-ancestor"', "candidate guard does not require candidate ancestry")
    require(guard, r'diff",\s*"--name-only"', "candidate guard does not inspect drift paths")
    require(guard, r'fnmatch\.fnmatchcase', "candidate guard does not apply explicit drift globs")
    require(guard, r'unknown-paths-invalidate-candidate', "candidate guard lost fail-closed unknown-path policy")
    require(guard, r'approve a new candidate', "candidate guard does not revoke authority on unsafe drift")

    try:
        policy = json.loads(policy_text)
    except json.JSONDecodeError as exc:
        fail(f"deployment authority policy is invalid JSON: {exc}")
    if policy.get("version") != 1:
        fail("deployment authority policy version drifted")
    if policy.get("policy") != "unknown-paths-invalidate-candidate":
        fail("deployment authority policy is no longer fail-closed")
    globs = policy.get("safe_drift_globs")
    if not isinstance(globs, list) or "docs/**" not in globs:
        fail("deployment authority policy does not explicitly allow documentation-only drift")
    forbidden_safe = ("src/**", "public/**", ".github/**", "scripts/**", "package*.json", "wrangler.toml")
    if any(item in globs for item in forbidden_safe):
        fail("deployment authority policy accidentally allowlists runtime/config paths")


def verify_candidate_guard_behavior() -> None:
    guard = ROOT / "scripts" / "deploy_candidate_guard.py"
    policy_source = ROOT / ".deployment-authority.json"
    with tempfile.TemporaryDirectory() as tmp:
        repo = pathlib.Path(tmp)

        def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
            result = subprocess.run(args, cwd=repo, text=True, capture_output=True, check=False)
            if check and result.returncode != 0:
                fail(f"candidate-lease self-test command failed: {' '.join(args)}\n{result.stdout}{result.stderr}")
            return result

        run("git", "init", "-q")
        run("git", "config", "user.email", "bugfinder@example.invalid")
        run("git", "config", "user.name", "SYNC Bugfinder")
        (repo / "src").mkdir()
        (repo / "docs").mkdir()
        (repo / "src" / "runtime.js").write_text("export const v = 1;\n", encoding="utf-8")
        (repo / "docs" / "receipt.md").write_text("baseline\n", encoding="utf-8")
        (repo / ".deployment-authority.json").write_text(policy_source.read_text(encoding="utf-8"), encoding="utf-8")
        run("git", "add", ".")
        run("git", "commit", "-qm", "candidate")
        candidate = run("git", "rev-parse", "HEAD").stdout.strip()

        (repo / "docs" / "receipt.md").write_text("baseline\nreceipt update\n", encoding="utf-8")
        run("git", "add", "docs/receipt.md")
        run("git", "commit", "-qm", "docs only")
        docs_head = run("git", "rev-parse", "HEAD").stdout.strip()
        safe = run(sys.executable, str(guard), candidate, docs_head, check=False)
        if safe.returncode != 0:
            fail("candidate lease rejects documentation-only drift:\n" + safe.stdout + safe.stderr)

        (repo / "src" / "runtime.js").write_text("export const v = 2;\n", encoding="utf-8")
        run("git", "add", "src/runtime.js")
        run("git", "commit", "-qm", "runtime change")
        runtime_head = run("git", "rev-parse", "HEAD").stdout.strip()
        unsafe = run(sys.executable, str(guard), candidate, runtime_head, check=False)
        if unsafe.returncode == 0:
            fail("candidate lease accepted runtime drift")


def verify_deploy_workflow(deploy: str) -> None:
    require(deploy, r'(?m)^\s*workflow_run\s*:', "production promotion is not chained to core-proof")
    require(deploy, r'workflows:\s*\["core-proof"\]', "production promotion is not bound to core-proof")
    require(deploy, r'types:\s*\[completed\]', "production promotion is not gated on proof completion")
    require(deploy, r'branches:\s*\[main\]', "production promotion is not restricted to main proof runs")
    require(deploy, r'(?ms)^\s*push:\s*\n\s+branches:\s*\[production\]', "public proof is not triggered by production-branch promotion")
    require(deploy, r"github\.event\.workflow_run\.conclusion == 'success'", "promotion does not require successful core-proof")
    require(deploy, r"github\.event\.workflow_run\.head_branch == 'main'", "promotion does not re-check the proof branch")
    require(deploy, r"github\.event\.workflow_run\.event == 'push'", "promotion can be triggered by an unexpected source event")
    require(deploy, r'TARGET_SHA:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}', "promotion is not bound to the exact green proof SHA")
    require(deploy, r'CURRENT_MAIN_SHA=.*refs/remotes/origin/main', "promotion does not re-read current main")
    require(deploy, r'test \"\$CURRENT_MAIN_SHA\" = \"\$TARGET_SHA\"', "promotion can advance a stale proof SHA")
    require(deploy, r'git merge-base --is-ancestor refs/remotes/origin/production \"\$TARGET_SHA\"', "production promotion is not fast-forward guarded")
    require(deploy, r'git push origin \"\$TARGET_SHA:refs/heads/production\"', "exact green SHA is not promoted to the production branch")
    require(deploy, r'contents:\s*write', "promotion job lacks the narrow repository write authority it needs")
    require(deploy, r'cancel-in-progress:\s*false', "production concurrency can cancel an in-flight promotion or proof")
    forbid(deploy, r'CLOUDFLARE_API_TOKEN', "GitHub workflow regained Cloudflare secret custody")
    forbid(deploy, r'CLOUDFLARE_ACCOUNT_ID', "GitHub workflow regained Cloudflare account-secret coupling")
    forbid(deploy, r'cloudflare/wrangler-action', "GitHub workflow can mutate Cloudflare directly instead of provider-held Workers Builds")
    require(deploy, r'https://sync-party-game\.mcgill-raylene\.workers\.dev', "production proof is not pinned to the canonical public Worker URL")
    require(deploy, r'/api/version', "public proof does not interrogate exact deployed runtime identity")
    require(deploy, r'EXPECTED_SHA:\s*\$\{\{\s*github\.sha\s*\}\}', "public proof is not bound to the production branch SHA")
    require(deploy, r'Exact deployed SHA verified', "public proof does not fail closed on runtime SHA mismatch")
    require(deploy, r'npm run test:e2e', "public production does not run the full Playwright suite")
    require(deploy, r'production-proof\.txt', "public production proof does not leave a durable receipt")
    require(deploy, r'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', "production proof artifacts are not pinned to the approved upload action")
    require(deploy, r'Human button press: not required', "production promotion contract regressed to founder-operated clicking")


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
    deploy = read(".github/workflows/deploy.yml")
    guard = read("scripts/deploy_candidate_guard.py")
    policy = read(".deployment-authority.json")
    verify_worker(worker)
    verify_game(game)
    verify_e2e(e2e)
    verify_candidate_guard_source(guard, policy)
    verify_candidate_guard_behavior()
    verify_deploy_workflow(deploy)
    run_node_tests()
    print("BUGFINDER PASS: game authority/privacy/continuity, mobile+timeout multiplayer proof, exact-green production promotion, Cloudflare-owned deploy proof, and Node tests are green")


if __name__ == "__main__":
    main()
