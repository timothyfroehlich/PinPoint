#!/usr/bin/env python3
"""Gate: ensure all E2E spec files are placed in e2e/full/ or e2e/smoke/.

Playwright suite configs in PinPoint only collect tests from:
- e2e/full/ (playwright.config.full.ts via testMatch: "**/full/**/*.spec.ts")
- e2e/smoke/ (playwright.config.smoke.ts via testDir: "./e2e/smoke")

Specs placed outside these two directories (e.g. e2e/profiles/profile-edit.spec.ts
in PP-stut or directly under e2e/), or test files named with non-*.spec.ts patterns
(e.g. *.test.ts, *.spec.tsx) that Playwright configs do not collect, will not be
picked up by any suite in CI and silently rot.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Matches Playwright's default test file patterns: **/*.@(spec|test).?(c|m)[jt]s?(x)
TEST_FILE_PATTERN = re.compile(r"\.(spec|test)\.[cm]?[jt]sx?$")

ALLOWED_SUITE_DIRS = frozenset({"full", "smoke"})


def find_repo_root(start: Path) -> Path:
    """Walk up until a directory containing package.json is found."""
    for candidate in (start, *start.parents):
        if (candidate / "package.json").is_file():
            return candidate
    return start


def find_spec_violations(root: Path) -> list[tuple[Path, str]]:
    """Find all test/spec files under e2e/ that violate suite location or naming rules."""
    e2e_dir = root / "e2e"
    if not e2e_dir.is_dir():
        return []

    violations: list[tuple[Path, str]] = []
    for path in sorted(e2e_dir.rglob("*")):
        if not path.is_file():
            continue
        if not TEST_FILE_PATTERN.search(path.name):
            continue

        rel = path.relative_to(e2e_dir)
        # Must be under e2e/full/ or e2e/smoke/
        if len(rel.parts) < 2 or rel.parts[0] not in ALLOWED_SUITE_DIRS:
            violations.append(
                (path, "outside allowed suite directories (e2e/full/ or e2e/smoke/)")
            )
        # Must use *.spec.ts extension to be collected by playwright.config.full.ts
        elif not path.name.endswith(".spec.ts"):
            violations.append(
                (
                    path,
                    "must end with .spec.ts to be collected by Playwright suite configs",
                )
            )

    return violations


def find_misplaced_specs(root: Path) -> list[Path]:
    """Find all *.spec.ts files under e2e/ that are not inside e2e/full/ or e2e/smoke/."""
    return [path for path, _ in find_spec_violations(root)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify all E2E specs reside in e2e/full/ or e2e/smoke/ as *.spec.ts."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root (defaults to auto-detection from script location)",
    )
    args = parser.parse_args(argv)

    root = (
        args.root.resolve()
        if args.root
        else find_repo_root(Path(__file__).resolve().parent)
    )

    violations = find_spec_violations(root)
    if not violations:
        return 0

    print(
        f"ERROR: Found {len(violations)} invalid or misplaced E2E spec file(s):",
        file=sys.stderr,
    )
    for path, reason in violations:
        rel_path = path.relative_to(root)
        print(f"  - {rel_path}: {reason}", file=sys.stderr)

    print(
        "\nAll Playwright test files (*.spec.ts, *.test.ts, *.spec.tsx, etc.) under e2e/ must:\n"
        "  1. Reside under e2e/full/ or e2e/smoke/\n"
        "  2. Use the .spec.ts extension so they are collected by playwright.config.full.ts "
        "and playwright.config.smoke.ts.\n"
        "See PP-2g7m / PP-stut.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
