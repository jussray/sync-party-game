#!/usr/bin/env python3
"""Attack the unified active-work rollover + deployment-candidate lease model."""
from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEPLOY_GUARD = ROOT / "scripts" / "deploy_candidate_guard.py"
POLICY = ROOT / ".deployment-authority.json"
MODEL = ROOT / "docs" / "CONTINUITY_MODEL.md"


def fail(message: str) -> None:
    print(f"CONTINUITY MODEL FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(cwd: pathlib.Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    if check and result.returncode != 0:
        fail(f"command failed: {' '.join(args)}\n{result.stdout}{result.stderr}")
    return result


def require_model_contract() -> None:
    if not MODEL.exists():
        fail("missing docs/CONTINUITY_MODEL.md")
    text = MODEL.read_text(encoding="utf-8")
    required = [
        "Active work continuity: roll forward",
        "Deployment proof continuity: candidate lease",
        "predecessor proof expires",
        "safe non-deploying drift: lease survives",
        "runtime/config/authority/unknown drift: lease revoked",
        "Rolling work forward preserves **work continuity**",
        "Candidate leases preserve **deployment-proof continuity**",
    ]
    for needle in required:
        if needle not in text:
            fail(f"continuity contract lost required rule: {needle}")


def guard(repo: pathlib.Path, candidate: str, current: str) -> subprocess.CompletedProcess[str]:
    return run(repo, sys.executable, str(DEPLOY_GUARD), candidate, current, check=False)


def attack_git_model() -> None:
    if not DEPLOY_GUARD.exists() or not POLICY.exists():
        fail("deployment candidate guard/policy missing")

    with tempfile.TemporaryDirectory() as tmp:
        repo = pathlib.Path(tmp)
        run(repo, "git", "init", "-q", "-b", "main")
        run(repo, "git", "config", "user.email", "continuity@example.invalid")
        run(repo, "git", "config", "user.name", "Continuity Guard")

        (repo / "src").mkdir()
        (repo / "receipts").mkdir()
        (repo / "docs").mkdir()
        (repo / "src" / "runtime.js").write_text("export const runtime = 1;\n", encoding="utf-8")
        (repo / "receipts" / "proof.md").write_text("baseline\n", encoding="utf-8")
        (repo / "docs" / "CONTINUITY_MODEL.md").write_text("authority v1\n", encoding="utf-8")
        (repo / ".deployment-authority.json").write_text(POLICY.read_text(encoding="utf-8"), encoding="utf-8")
        run(repo, "git", "add", ".")
        run(repo, "git", "commit", "-qm", "baseline candidate")
        candidate = run(repo, "git", "rev-parse", "HEAD").stdout.strip()

        run(repo, "git", "checkout", "-qb", "feature")
        (repo / "src" / "feature.js").write_text("export const feature = true;\n", encoding="utf-8")
        run(repo, "git", "add", "src/feature.js")
        run(repo, "git", "commit", "-qm", "active feature")
        predecessor_head = run(repo, "git", "rev-parse", "HEAD").stdout.strip()

        # Exact Unicode evidence path is safe drift.
        run(repo, "git", "checkout", "-q", "main")
        (repo / "receipts" / "café.md").write_text("safe receipt drift\n", encoding="utf-8")
        run(repo, "git", "add", "receipts/café.md")
        run(repo, "git", "commit", "-qm", "safe evidence drift")
        evidence_main = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        if guard(repo, candidate, evidence_main).returncode != 0:
            fail("safe evidence drift incorrectly revoked deployment candidate")

        # Active work must still roll forward to the moved base.
        run(repo, "git", "checkout", "-q", "feature")
        run(repo, "git", "merge", "--no-edit", "main")
        successor_head = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        if successor_head == predecessor_head:
            fail("active work did not mint a successor head after base movement")
        if run(repo, "git", "merge-base", "--is-ancestor", evidence_main, successor_head, check=False).returncode != 0:
            fail("rolled-forward successor does not contain the new trusted main base")

        # Governance docs are not evidence-only drift.
        run(repo, "git", "checkout", "-q", "main")
        (repo / "docs" / "CONTINUITY_MODEL.md").write_text("authority v2\n", encoding="utf-8")
        run(repo, "git", "add", "docs/CONTINUITY_MODEL.md")
        run(repo, "git", "commit", "-qm", "authority drift")
        authority_main = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        if guard(repo, candidate, authority_main).returncode == 0:
            fail("governance drift incorrectly preserved deployment candidate")

        # Runtime drift followed by revert must still revoke the older lease.
        run(repo, "git", "reset", "--hard", evidence_main)
        (repo / "src" / "runtime.js").write_text("export const runtime = 2;\n", encoding="utf-8")
        run(repo, "git", "add", "src/runtime.js")
        run(repo, "git", "commit", "-qm", "runtime drift")
        runtime_commit = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        run(repo, "git", "revert", "--no-edit", runtime_commit)
        (repo / "receipts" / "proof.md").write_text("baseline\nafter revert\n", encoding="utf-8")
        run(repo, "git", "add", "receipts/proof.md")
        run(repo, "git", "commit", "-qm", "receipt after revert")
        reverted_main = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        if guard(repo, candidate, reverted_main).returncode == 0:
            fail("reverted runtime drift incorrectly restored candidate authority")

        # Leading whitespace is part of the path and must not normalize into the allowlist.
        run(repo, "git", "reset", "--hard", evidence_main)
        forged = repo / " receipts"
        forged.mkdir()
        (forged / "forged.md").write_text("unsafe\n", encoding="utf-8")
        run(repo, "git", "add", " receipts/forged.md")
        run(repo, "git", "commit", "-qm", "forged path drift")
        forged_main = run(repo, "git", "rev-parse", "HEAD").stdout.strip()
        if guard(repo, candidate, forged_main).returncode == 0:
            fail("leading-space unknown path was normalized into the safe allowlist")


def main() -> None:
    require_model_contract()
    attack_git_model()
    print("CONTINUITY MODEL PASS: work rolls forward; exact evidence drift leases; governance/reverted-runtime/forged drift revokes")


if __name__ == "__main__":
    main()
