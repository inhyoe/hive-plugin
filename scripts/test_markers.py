#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate Hive marker format consistency across key markdown files."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TARGET_FILES = [
    "skills/hive-consensus/SKILL.md",
    "skills/hive-spawn-templates/templates/claude-agent.md",
    "skills/hive-spawn-templates/templates/codex-agent.md",
    "skills/hive-spawn-templates/templates/gemini-agent.md",
    "skills/hive/SKILL.md",
]

# Single source of truth from hive-consensus §4.
# Canonical forms:
#   [TASK PROPOSAL — {team_id} — {round_id}]
#   [FOLLOW-UP — {team_id} — {round_id} — parent:{parent_round_id}]
#   [HIVE IMPLEMENTATION — {team_id} — {wave_id}]
#   [AGREE — {team_id}]
#   [COUNTER — {team_id}]
#   [CLARIFY — {team_id}]

# Placeholder forms accepted in template mode:
# - {{TEAM_ID}} style
# - {team_id} style
# - {팀 ID} style (consensus explanatory examples)
PLACEHOLDER = r"(?:\{\{[A-Z0-9_]+\}\}|\{[^{}]+\})"
ROUND_PLACEHOLDER = r"(?:R\{\{[A-Z0-9_]+\}\}|R\{[^{}]+\}|\{\{[A-Z0-9_]+\}\}|\{[^{}]+\})"
WAVE_PLACEHOLDER = r"(?:W\{\{[A-Z0-9_]+\}\}|W\{[^{}]+\}|\{\{[A-Z0-9_]+\}\}|\{[^{}]+\})"

MARKER_PATTERNS = {
    "TASK PROPOSAL": {
        "template": re.compile(
            rf"^\[TASK PROPOSAL — {PLACEHOLDER} — {ROUND_PLACEHOLDER}\]\s*$"
        ),
        "instance": re.compile(r"^\[TASK PROPOSAL — T\d+ — R\d+\]\s*$"),
    },
    "FOLLOW-UP": {
        "template": re.compile(
            rf"^\[FOLLOW-UP — {PLACEHOLDER} — {ROUND_PLACEHOLDER} — parent:{ROUND_PLACEHOLDER}\]\s*$"
        ),
        "instance": re.compile(
            r"^\[FOLLOW-UP — T\d+ — R\d+ — parent:R\d+\]\s*$"
        ),
    },
    "HIVE IMPLEMENTATION": {
        "template": re.compile(
            rf"^\[HIVE IMPLEMENTATION — {PLACEHOLDER} — {WAVE_PLACEHOLDER}\]\s*$"
        ),
        "instance": re.compile(r"^\[HIVE IMPLEMENTATION — T\d+ — W\d+\]\s*$"),
    },
    "AGREE": {
        "template": re.compile(rf"^\[AGREE — {PLACEHOLDER}\]\s*$"),
        "instance": re.compile(r"^\[AGREE — T\d+\]\s*$"),
    },
    "COUNTER": {
        "template": re.compile(rf"^\[COUNTER — {PLACEHOLDER}\]\s*$"),
        "instance": re.compile(r"^\[COUNTER — T\d+\]\s*$"),
    },
    "CLARIFY": {
        "template": re.compile(rf"^\[CLARIFY — {PLACEHOLDER}\]\s*$"),
        "instance": re.compile(r"^\[CLARIFY — T\d+\]\s*$"),
    },
}

MARKER_START_RE = re.compile(
    r"^\[(TASK PROPOSAL|FOLLOW-UP|HIVE IMPLEMENTATION|AGREE|COUNTER|CLARIFY)(?:\s+—|\])"
)


class Counter:
    def __init__(self) -> None:
        self.total = 0
        self.passed = 0
        self.failed = 0


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Validate marker format consistency.")
    parser.add_argument(
        "--repo-root",
        default=str(default_root),
        help="Repository root path (default: parent of scripts directory).",
    )
    return parser.parse_args()


def marker_name_from_line(line: str) -> str | None:
    match = MARKER_START_RE.match(line.strip())
    if match:
        return match.group(1)
    return None


def validate_marker_line(marker_name: str, line: str) -> bool:
    stripped = line.strip()
    marker = MARKER_PATTERNS[marker_name]
    return bool(marker["template"].match(stripped) or marker["instance"].match(stripped))


def scan_file(repo_root: Path, rel_path: str, counter: Counter) -> None:
    path = repo_root / rel_path
    if not path.exists():
        counter.total += 1
        counter.failed += 1
        print(f"[FAIL] {rel_path} — file not found")
        return

    with path.open("r", encoding="utf-8") as f:
        for lineno, raw_line in enumerate(f, start=1):
            stripped = raw_line.strip()

            # Markdown-aware filtering:
            # - only bracket-leading lines are considered marker candidates
            # - generic bracket text embedded in prose is excluded
            if not stripped.startswith("["):
                continue

            marker_name = marker_name_from_line(raw_line)
            if marker_name is None:
                continue

            counter.total += 1
            if validate_marker_line(marker_name, raw_line):
                counter.passed += 1
                print(f"[PASS] {rel_path}:{lineno} — {marker_name} marker")
            else:
                counter.failed += 1
                print(f"[FAIL] {rel_path}:{lineno} — invalid {marker_name} marker")
                print(f"       line: {stripped}")


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()

    counter = Counter()

    for rel_path in TARGET_FILES:
        scan_file(repo_root, rel_path, counter)

    print("")
    print(
        f"Summary: total {counter.total}, "
        f"passed {counter.passed}, failed {counter.failed}"
    )

    return 1 if counter.failed else 0


if __name__ == "__main__":
    sys.exit(main())
