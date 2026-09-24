#!/usr/bin/env python3
"""Fail CI when high-confidence secrets or secret-bearing files are committed.

This scanner is intentionally dependency-free and only inspects tracked files.
It never prints matched secret material into CI logs.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

FORBIDDEN_NAMES = {
    ".env",
    "credentials.json",
}
FORBIDDEN_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"}
FORBIDDEN_PREFIXES = ("service-account",)

PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("aws-access-key-id", re.compile(r"(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])")),
    ("github-token", re.compile(r"(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{20,}")),
    ("github-fine-grained-token", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    ("openai-api-key", re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{20,}")),
    ("anthropic-api-key", re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}")),
    ("stripe-live-secret", re.compile(r"sk_live_[A-Za-z0-9]{16,}")),
    ("slack-token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{16,}")),
    ("google-api-key", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
)


def tracked_files() -> list[pathlib.Path]:
    process = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / item.decode("utf-8") for item in process.stdout.split(b"\0") if item]


def forbidden_filename(path: pathlib.Path) -> bool:
    relative = path.relative_to(ROOT)
    name = relative.name
    if name == ".env.example":
        return False
    if name in FORBIDDEN_NAMES or name.startswith(".env."):
        return True
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        return True
    lower = name.lower()
    return any(lower.startswith(prefix) and lower.endswith(".json") for prefix in FORBIDDEN_PREFIXES)


def main() -> None:
    findings: list[tuple[str, str]] = []
    files = tracked_files()

    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        if forbidden_filename(path):
            findings.append((relative, "forbidden-secret-file"))
            continue

        try:
            raw = path.read_bytes()
        except OSError:
            continue
        if b"\0" in raw:
            continue
        text = raw.decode("utf-8", errors="ignore")
        for rule, pattern in PATTERNS:
            if pattern.search(text):
                findings.append((relative, rule))

    if findings:
        print("SECRET SCAN FAIL: high-confidence secret material or a forbidden secret file is tracked.", file=sys.stderr)
        for filename, rule in sorted(set(findings)):
            print(f"- {filename}: {rule}", file=sys.stderr)
        print("Matched secret values are intentionally suppressed. Remove/revoke exposed credentials before continuing.", file=sys.stderr)
        raise SystemExit(1)

    print(f"SECRET SCAN PASS: {len(files)} tracked files checked; no high-confidence secret material found")


if __name__ == "__main__":
    main()
