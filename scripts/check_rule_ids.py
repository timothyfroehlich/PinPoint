#!/usr/bin/env python3
"""Check that every cited CORE-* rule ID exists in the canonical catalog.

PinPoint states its rules in several places, each in a different voice and for
a different reader:

  docs/NON_NEGOTIABLES.md    canonical catalog -- the authoritative statement
  CLAUDE.md                  always-loaded index, authoring voice
  .claude/rules/*.md         path-scoped, authoring voice (Claude)
  .github/instructions/*.md  path-scoped, review voice (Copilot)
  CODE_REVIEW.md             review-agent entry map

Generating those from one source would mean synthesising two registers from one
text, so they are hand-written. This gate catches the drift that actually bites
-- a rule renamed or deleted in the catalog while citations linger, and catalog
rules that no mechanism references at all -- without pretending to diff prose.

Two checks:

  ERROR  A cited CORE-* ID that does not exist in the catalog. Always a bug:
         either a typo or a rule that was renamed/removed without updating its
         citations. This is the check that runs in `pnpm run check`.
  AUDIT  (--orphans) A catalog rule cited nowhere. Opt-in, never fails the
         build: as of 2026-07-24, 42 of ~62 catalog rules are "orphans" by this
         definition, because the catalog is deliberately broader than the set
         promoted into an always-loaded index or a path-scoped file. Printing
         42 lines on every run would train everyone to ignore the gate, so it
         is a coverage audit you run deliberately, not a default warning.

Exit codes: 0 clean, 1 unknown IDs found, 2 catalog missing, 3 descending range
cited.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# CORE-<CATEGORY>-<NNN>. Category is uppercase letters/digits (TS, A11Y, PBM).
RULE_ID = re.compile(r"\bCORE-[A-Z][A-Z0-9]*-\d{3}\b")

# Range shorthand, e.g. CORE-RESP-001..004 or CORE-FORM-001..006 (AGENTS.md
# §2.1 uses this to cite a contiguous block without spelling out every ID).
# Without expansion, RULE_ID alone only ever catches the range's start ID --
# the end ID and every interior ID are never extracted, so a rename or
# deletion of e.g. CORE-RESP-003 would go undetected. extract_ids() expands
# by sorted endpoints, so a backwards range (CORE-RESP-004..001) still gets
# every interior ID extracted and validated instead of silently expanding to
# nothing -- main() separately flags descending order itself as citation
# drift to be fixed at the source, rather than quietly tolerating it.
RANGE_ID = re.compile(r"\bCORE-([A-Z][A-Z0-9]*)-(\d{3})\.\.(\d{3})\b")

CATALOG = "docs/NON_NEGOTIABLES.md"

# Files and globs whose CORE-* citations must resolve. Missing paths are fine:
# .claude/rules/ and CODE_REVIEW.md do not exist until the context-system
# rebuild lands (PP-22e4), and this gate ships before it.
CITING_SOURCES: tuple[str, ...] = (
    "CLAUDE.md",
    "AGENTS.md",
    "CODE_REVIEW.md",
    ".claude/rules/*.md",
    ".claude/rules/**/*.md",
    ".github/copilot-instructions.md",
    ".github/instructions/*.md",
    ".claude/hooks/*.cjs",
)


def find_repo_root(start: Path) -> Path:
    """Walk up until a directory containing the catalog is found."""
    for candidate in (start, *start.parents):
        if (candidate / CATALOG).is_file():
            return candidate
    return start


def extract_ids(text: str) -> set[str]:
    ids = set(RULE_ID.findall(text))
    for category, start, end in RANGE_ID.findall(text):
        width = len(start)
        lo, hi = sorted((int(start), int(end)))
        for n in range(lo, hi + 1):
            ids.add(f"CORE-{category}-{n:0{width}d}")
    return ids


def find_descending_ranges(text: str) -> list[str]:
    """Return the literal text of any backwards range, e.g. CORE-RESP-004..001.

    A range citation should always count up. Backwards order is drift at the
    citation site regardless of whether extract_ids() can expand it correctly
    -- reported by main() as its own failure so it gets fixed at the source
    instead of silently tolerated.
    """
    return [
        match.group(0)
        for match in RANGE_ID.finditer(text)
        if int(match.group(2)) > int(match.group(3))
    ]


def collect_catalog_ids(root: Path) -> set[str]:
    return extract_ids((root / CATALOG).read_text(encoding="utf-8"))


def _glob_paths(root: Path, pattern: str) -> list[Path]:
    if any(ch in pattern for ch in "*?["):
        return sorted(root.glob(pattern))
    candidate = root / pattern
    return [candidate] if candidate.is_file() else []


def collect_citations(root: Path) -> dict[str, set[str]]:
    """Map relative file path -> set of CORE-* IDs cited in it."""
    citations: dict[str, set[str]] = {}
    for pattern in CITING_SOURCES:
        for path in _glob_paths(root, pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel in citations:
                continue  # Overlapping globs (rules/*.md and rules/**/*.md).
            found = extract_ids(path.read_text(encoding="utf-8"))
            if found:
                citations[rel] = found
    return citations


def collect_descending_ranges(root: Path) -> dict[str, list[str]]:
    """Map relative file path -> descending (backwards) ranges cited in it.

    Scans the catalog itself plus every CITING_SOURCES file.
    """
    descending: dict[str, list[str]] = {}

    catalog_path = root / CATALOG
    if catalog_path.is_file():
        found = find_descending_ranges(catalog_path.read_text(encoding="utf-8"))
        if found:
            descending[CATALOG] = found

    for pattern in CITING_SOURCES:
        for path in _glob_paths(root, pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel in descending:
                continue  # Overlapping globs (rules/*.md and rules/**/*.md).
            found = find_descending_ranges(path.read_text(encoding="utf-8"))
            if found:
                descending[rel] = found

    return descending


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repo root (default: discovered from this file's location).",
    )
    parser.add_argument(
        "--orphans",
        action="store_true",
        help="Also audit catalog rules that nothing cites (never fails).",
    )
    args = parser.parse_args(argv)

    root = args.root or find_repo_root(Path(__file__).resolve().parent)

    if not (root / CATALOG).is_file():
        print(f"check:rule-ids: catalog not found at {CATALOG}", file=sys.stderr)
        return 2

    # ERROR: a descending (backwards) range, e.g. CORE-RESP-004..001. This is
    # drift at the citation site itself -- a range must count up, so a
    # backwards one gets fixed at the source, not silently repaired by
    # expanding it in the safe direction.
    descending = collect_descending_ranges(root)
    if descending:
        print("check:rule-ids: descending CORE-* range(s) cited\n", file=sys.stderr)
        for rel in sorted(descending):
            for range_text in descending[rel]:
                print(f"  {rel}: {range_text}", file=sys.stderr)
        print(
            "\nA range must count up, low..high (e.g. CORE-RESP-001..004). Fix "
            "the citation to ascending order.",
            file=sys.stderr,
        )
        return 3

    catalog_ids = collect_catalog_ids(root)
    citations = collect_citations(root)

    # ERROR: cited but not in the catalog.
    unknown: dict[str, set[str]] = {}
    for rel, ids in citations.items():
        missing = ids - catalog_ids
        if missing:
            unknown[rel] = missing

    if unknown:
        print("check:rule-ids: unknown CORE-* IDs cited\n", file=sys.stderr)
        for rel in sorted(unknown):
            for rule_id in sorted(unknown[rel]):
                print(f"  {rel}: {rule_id}", file=sys.stderr)
        print(
            f"\nThese are not in {CATALOG}. Either the ID is a typo, or the rule "
            "was renamed/removed without updating its citations.",
            file=sys.stderr,
        )
        return 1

    # AUDIT (opt-in): in the catalog but cited nowhere.
    if args.orphans:
        cited: set[str] = set().union(*citations.values()) if citations else set()
        orphans = sorted(catalog_ids - cited)
        if orphans:
            print(
                f"check:rule-ids: {len(orphans)} of {len(catalog_ids)} catalog "
                "rule(s) cited by no hook, rule file, instruction file, or "
                "CLAUDE.md:",
                file=sys.stderr,
            )
            print("  " + ", ".join(orphans), file=sys.stderr)
            print(
                "  (audit only -- the catalog is deliberately broader than the "
                "set promoted into an always-loaded or path-scoped file)",
                file=sys.stderr,
            )
        else:
            print("check:rule-ids: every catalog rule is cited.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
