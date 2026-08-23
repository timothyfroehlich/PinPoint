#!/usr/bin/env python3
"""Check that every cited CORE-* rule ID exists in the canonical catalog.

PinPoint states its rules in several places, each in a different voice and for
a different reader:

  docs/NON_NEGOTIABLES.md    canonical catalog -- the authoritative statement
  AGENTS.md / CLAUDE.md      always-loaded process context, authoring voice
  .agents/skills/**/*.md     task-specific procedure and context
  REVIEW.md                  review-agent entry map + rubric

Generating those from one source would mean synthesising two registers from one
text, so they are hand-written. This gate catches the drift that actually bites
-- a rule renamed or deleted in the catalog while citations linger, and catalog
rules that no mechanism references at all -- without pretending to diff prose.

Three checks:

  ERROR  A cited CORE-* ID that does not exist in the catalog. Always a bug:
         either a typo or a rule that was renamed/removed without updating its
         citations. This is the check that runs in `pnpm run check`.
  ERROR  A fragile "rule N" / "commandment N" / "AGENTS.md §2.1" citation.
         Rules must be cited by their canonical CORE-* ID. Citing by rule
         number or section reference is not machine-checkable against the
         catalog, so the gate bans the pattern outright and requires the
         CORE-* ID instead.
  AUDIT  (--orphans) A catalog rule cited nowhere. Opt-in, never fails the
         build: 17 of 67 catalog rules are "orphans" by this definition as of
         2026-08-07, because the catalog is deliberately broader than the set
         promoted into an always-loaded or task-scoped file. Printing that
         list on every run would train everyone to ignore the gate, so it is a
         coverage audit you run deliberately, not a default warning.

Exit codes: 0 clean, 1 unknown IDs found, 2 catalog missing, 3 descending
range cited, 4 fragile rule-number/§2.1 citation found.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# CORE-<CATEGORY>-<NNN>. Category is uppercase letters/digits (TS, A11Y, PBM).
RULE_ID = re.compile(r"\bCORE-[A-Z][A-Z0-9]*-\d{3}\b")

# Range shorthand, e.g. CORE-RESP-001..004 or CORE-FORM-001..006 (citing
# files use this to cite a contiguous block without spelling out every ID).
# Without expansion, RULE_ID alone only ever catches the range's start ID --
# the end ID and every interior ID are never extracted, so a rename or
# deletion of e.g. CORE-RESP-003 would go undetected. extract_ids() expands
# by sorted endpoints, so a backwards range (CORE-RESP-004..001) still gets
# every interior ID extracted and validated instead of silently expanding to
# nothing -- main() separately flags descending order itself as citation
# drift to be fixed at the source, rather than quietly tolerating it.
RANGE_ID = re.compile(r"\bCORE-([A-Z][A-Z0-9]*)-(\d{3})\.\.(\d{3})\b")

# A bare "rule N" / "commandment N" citation, with or without a leading
# "AGENTS.md" (an optional closing backtick is tolerated between "AGENTS.md"
# and the keyword, e.g. `` `AGENTS.md` rule 10 ``, since that shape shows up
# in prose that code-fences the filename). PP-22e4 found ~30 of these across
# the tree, several already wrong (citing the wrong number for the content
# they described -- e.g. "rule 12" for email privacy, which is actually rule
# 10 / CORE-SEC-007) because nothing ever validated them. A rule number is
# never machine-checkable the way a CORE-* ID is (there's no catalog of
# numbers to check against), so the only sound fix is banning the pattern and
# requiring the ID.
# Horizontal whitespace only, never \s: a citation lives on one line, and a
# newline-spanning \s* makes a markdown heading that ends in "rule" followed by
# an ordered list ("## Adding or changing a rule\n\n1. ...") match as "rule 1".
NUMBERED_RULE_CITATION = re.compile(
    r"\b(?:AGENTS\.md`?[ \t]+)?(?:[Rr]ule|[Cc]ommandment)[ \t]*#?\d+\b"
)

# The citation form the horizontal-whitespace-only rule above gives up: one
# hard-wrapped between the keyword and the number ("...as required by
# AGENTS.md rule\n12..."). The scanned surfaces are hand-wrapped at ~78
# columns, so this is a real shape rather than a theoretical one.
#
# It is a separate check because a plain `\s` in NUMBERED_RULE_CITATION cannot
# distinguish it from a markdown heading that ends in "rule" followed by an
# ordered list. The blank line between heading and list is what separates them:
# a wrapped sentence has none. So this matches only when the number is on the
# *immediately* following line, and never when the keyword line is itself a
# heading.
WRAPPED_RULE_CITATION = re.compile(
    r"\b(?:AGENTS\.md`?[ \t]+)?(?:[Rr]ule|[Cc]ommandment)[ \t]*$"
)
WRAPPED_CITATION_NUMBER = re.compile(r"^[ \t]*#?\d+\b")

# "AGENTS.md §2.1" citation ban. Rules must be cited by CORE-* ID, not section
# references. Tolerates the same optional backtick as NUMBERED_RULE_CITATION.
SECTION_21_CITATION = re.compile(r"AGENTS\.md`?[ \t]*§[ \t]*2\.1\b")

CATALOG = "docs/NON_NEGOTIABLES.md"

# Files and globs whose CORE-* citations must resolve. Missing paths are fine
# -- a glob that matches nothing is skipped, so this list can name a surface
# before it exists and can outlive one that is retired.
#
# .agents/skills/ is here because it is a first-class citation surface, not a
# doc archive: AGENTS.md section 3 instructs every agent to load the relevant
# skill for every task, so a skill citing a retired ID misinstructs agents at
# least as loudly as AGENTS.md would. PP-nw80 found exactly that -- the
# progressive-enhancement rule survived in pinpoint-design-bible after being
# deleted from the catalog, with `pnpm run check` green, because this list
# stopped at .agents/rules/. Note that a bare `rg CORE-ARCH-002 .` will not
# catch it either: ripgrep skips dotfile directories by default, so .agents/
# and .claude/ are invisible to the obvious hand-check. This gate is the
# backstop for that blind spot.
CITING_SOURCES: tuple[str, ...] = (
    "CLAUDE.md",
    "AGENTS.md",
    "REVIEW.md",
    ".agents/rules/*.md",
    ".agents/skills/**/*.md",
    ".claude/hooks/*.cjs",
)

# Files and globs scanned for fragile rule-number/§2.1 citations (PP-22e4).
# Deliberately an explicit allowlist, like CITING_SOURCES above, rather than
# "every tracked file": several docs subtrees run their own independent
# "Rule N" numbering with nothing to do with AGENTS.md (e.g.
# docs/runbooks/sentry-alert-best-effort.md's "Rule 1 -- Primary-path error"
# alerting tiers) and would false-positive under a blind scan. This list is
# the source + script trees PP-22e4 actually found citations in, plus
# AGENTS.md/CLAUDE.md themselves and the two docs PP-22e4 uses as durable
# citation targets (docs/NON_NEGOTIABLES.md, docs/ENV_VARS.md). Dated-record
# trees (docs/superpowers/, docs/plans/, the dated docs/testing/*-audit-*.md
# files) are excluded on purpose -- they are historical records, not live
# citations, per AGENTS.md §8. Add a path here only when a real citation
# turns up in it.
LEGACY_CITATION_SOURCES: tuple[str, ...] = (
    "AGENTS.md",
    "CLAUDE.md",
    "docs/NON_NEGOTIABLES.md",
    "docs/ENV_VARS.md",
    "src/**/*.ts",
    "src/**/*.tsx",
    "scripts/**/*.mjs",
    "scripts/**/*.ts",
    "scripts/**/*.py",
    "e2e/**/*.ts",
    "supabase/**/*.mjs",
    ".agents/skills/**/*.md",
    ".claude/hooks/*.cjs",
    ".husky/*",
)

# This module and its test necessarily spell out example citation forms
# ("AGENTS.md §2.1", "rule 10", ...) in prose while documenting the very
# pattern this check bans -- scanning them would make the gate fail against
# itself. Self-exclude rather than water down the docstrings.
LEGACY_CITATION_SELF_EXCLUDE = frozenset(
    {"scripts/check_rule_ids.py", "scripts/tests/test_check_rule_ids.py"}
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


def find_legacy_citations(text: str) -> list[tuple[int, str]]:
    """Return every fragile rule-number/§2.1 citation in text as (line, text).

    1-indexed line numbers, so a failure message can point straight at the
    offending line instead of just the file.
    """
    hits: list[tuple[int, str]] = []
    for regex in (NUMBERED_RULE_CITATION, SECTION_21_CITATION):
        for match in regex.finditer(text):
            line_no = text.count("\n", 0, match.start()) + 1
            hits.append((line_no, match.group(0)))

    lines = text.splitlines()
    for index, line in enumerate(lines[:-1]):
        if line.lstrip().startswith("#"):
            continue  # A heading, not a wrapped sentence.
        match = WRAPPED_RULE_CITATION.search(line)
        if match and WRAPPED_CITATION_NUMBER.match(lines[index + 1]):
            wrapped = f"{match.group(0)} {lines[index + 1].strip()}"
            hits.append((index + 1, wrapped))

    hits.sort()
    return hits


def collect_legacy_citations(root: Path) -> dict[str, list[tuple[int, str]]]:
    """Map relative file path -> [(line, matched text), ...] for fragile
    rule-number/§2.1 citations.

    Scoped to LEGACY_CITATION_SOURCES -- see the comment there for why this is
    an explicit allowlist rather than a scan of every tracked file.
    """
    found: dict[str, list[tuple[int, str]]] = {}
    for pattern in LEGACY_CITATION_SOURCES:
        for path in _glob_paths(root, pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel in found or rel in LEGACY_CITATION_SELF_EXCLUDE:
                continue  # Overlapping globs, or this module's own docstrings.
            hits = find_legacy_citations(path.read_text(encoding="utf-8"))
            if hits:
                found[rel] = hits
    return found


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

    # ERROR: a fragile "rule N" / "commandment N" / "AGENTS.md §2.1" citation.
    # Rules must be cited by CORE-* ID from the catalog; number or section
    # citations are not machine-checkable: ban the pattern outright.
    legacy = collect_legacy_citations(root)
    if legacy:
        print(
            "check:rule-ids: fragile AGENTS.md rule-number/§2.1 citation(s) found\n",
            file=sys.stderr,
        )
        for rel in sorted(legacy):
            for line_no, matched_text in legacy[rel]:
                print(f"  {rel}:{line_no}: {matched_text!r}", file=sys.stderr)
        print(
            f"\nRules must be cited by CORE-* ID from {CATALOG}. Fragile "
            'rule-number or "§2.1" citations are banned.',
            file=sys.stderr,
        )
        return 4

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
