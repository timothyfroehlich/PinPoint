#!/usr/bin/env python3
"""Gate: ensure all E2E spec files are placed in e2e/full/ or e2e/smoke/.

Playwright suite configs in PinPoint only collect tests from:
- e2e/full/ (playwright.config.full.ts via testMatch: "**/full/**/*.spec.ts")
- e2e/smoke/ (playwright.config.smoke.ts via testDir: "./e2e/smoke")

Specs placed outside these two directories (e.g. e2e/profiles/profile-edit.spec.ts
in PP-stut or directly under e2e/) will not be picked up by any suite in CI and
silently rot.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ALLOWED_SUITE_DIRS = frozenset({"full", "smoke"})


def find_repo_root(start: Path) -> Path:
    """Walk up until a directory containing package.json is found."""
    for candidate in (start, *start.parents):
        if (candidate / "package.json").is_file():
            return candidate
    return start


def find_misplaced_specs(root: Path) -> list[Path]:
    """Find all *.spec.ts files under e2e/ that are not inside e2e/full/ or e2e/smoke/."""
    e2e_dir = root / "e2e"
    if not e2e_dir.is_dir():
        return []

    misplaced: list[Path] = []
    for path in sorted(e2e_dir.rglob("*.spec.ts")):
        if not path.is_file():
            continue
        rel = path.relative_to(e2e_dir)
        # rel.parts[0] is the top-level entry directly under e2e/.
        # Allowed: e2e/full/** or e2e/smoke/**
        # Misplaced: e2e/foo.spec.ts (len == 1), e2e/profiles/foo.spec.ts (parts[0] == 'profiles')
        if len(rel.parts) < 2 or rel.parts[0] not in ALLOWED_SUITE_DIRS:
            misplaced.append(path)

    return misplaced


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify all E2E specs reside in e2e/full/ or e2e/smoke/."
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

    misplaced = find_misplaced_specs(root)
    if not misplaced:
        return 0

    print(
        f"ERROR: Found {len(misplaced)} E2E spec file(s) outside allowed "
        "suite directories (e2e/full/ or e2e/smoke/):",
        file=sys.stderr,
    )
    for path in misplaced:
        rel_path = path.relative_to(root)
        print(f"  - {rel_path}", file=sys.stderr)

    print(
        "\nAll E2E spec files (*.spec.ts) under e2e/ must reside under e2e/full/ "
        "or e2e/smoke/ so they are collected by Playwright suite configs "
        "(playwright.config.full.ts or playwright.config.smoke.ts).\n"
        "See PP-2g7m / PP-stut.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
