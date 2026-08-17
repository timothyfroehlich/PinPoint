#!/usr/bin/env python3
"""Check that every cited CORE-* rule ID exists in the canonical catalog.

PinPoint states its rules in several places, each in a different voice and for
a different reader:

  docs/NON_NEGOTIABLES.md    canonical catalog -- the authoritative statement
  AGENTS.md / CLAUDE.md      always-loaded process context, authoring voice
  .claude/rules/*.md         the rules themselves, path-scoped (Claude Code)
  REVIEW.md                  review-agent entry map + rubric

Generating those from one source would mean synthesising two registers from one
text, so they are hand-written. This gate catches the drift that actually bites
-- a rule renamed or deleted in the catalog while citations linger, and catalog
rules that no mechanism references at all -- without pretending to diff prose.

Four checks:

  ERROR  A cited CORE-* ID that does not exist in the catalog. Always a bug:
         either a typo or a rule that was renamed/removed without updating its
         citations. This is the check that runs in `pnpm run check`.
  ERROR  A fragile "rule N" / "commandment N" / "AGENTS.md §N" citation
         (PP-22e4, PP-z9m1). Rule numbers stopped resolving when PP-22e4.4
         moved the rules to .claude/rules/. Section numbers are the same
         hazard on a slower clock: they shift whenever AGENTS.md gains or
         loses a section, and nothing tells the citation -- PP-z9m1 found
         three sites citing "§2.2.5", which is not a section at all. Both
         forms are banned because neither has anything to resolve against: a
         rule number has no catalog of numbers, and a section number resolves
         to whatever now sits at that position, which is how a citation goes
         wrong without going missing. Cite the CORE-* ID for a rule, or the
         heading title for a section: AGENTS.md "Which tests to run".
  ERROR  An AGENTS.md "Title" citation matching no heading. This is what makes
         the previous check an improvement rather than a swap: a title, unlike
         a number, can be resolved, so a renamed heading fails the build
         instead of silently pointing somewhere else.
  AUDIT  (--orphans) A catalog rule cited nowhere. Opt-in, never fails the
         build: 17 of 67 catalog rules are "orphans" by this definition as of
         2026-08-07 (it was 42 of 62 before the .claude/rules/ tier, which
         cites more of the catalog than the old AGENTS.md list did), because
         the catalog is deliberately broader than the set promoted into an
         always-loaded or path-scoped file. Printing that list on every run
         would train everyone to ignore the gate, so it is a coverage audit
         you run deliberately, not a default warning.

Exit codes: 0 clean, 1 unknown IDs found, 2 catalog missing, 3 descending
range cited, 4 fragile rule-number/section-number citation found, 5 heading
title cited that resolves to no AGENTS.md heading.
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
# ordered list -- which .claude/rules/README.md contains. The blank line
# between heading and list is what separates them: a wrapped sentence has none.
# So this matches only when the number is on the *immediately* following line,
# and never when the keyword line is itself a heading.
WRAPPED_RULE_CITATION = re.compile(
    r"\b(?:AGENTS\.md`?[ \t]+)?(?:[Rr]ule|[Cc]ommandment)[ \t]*$"
)
WRAPPED_CITATION_NUMBER = re.compile(r"^[ \t]*#?\d+\b")

# Any "AGENTS.md §N" section citation. This started as §2.1 alone -- that
# section stopped listing the rules in PP-22e4.4, so citing it sent the reader
# somewhere the rule is not -- but the whole numbering is the same hazard, just
# slower: section numbers shift whenever AGENTS.md gains or loses a section, and
# nothing tells the citation. PP-z9m1 found ~40 such citations across 25 files,
# three of them pointing at "§2.2.5", which is not a section at all (it is item
# 5 of a numbered list under §2.2) and never was.
#
# The durable form is the heading title: `AGENTS.md "Which tests to run"`.
# Titles are edited far less often than numbers are renumbered, and a stale one
# is greppable, and -- unlike a number -- it can be resolved against the real
# headings, which is what find_unresolved_section_titles() below does.
#
# Tolerates the same optional backtick as NUMBERED_RULE_CITATION, and matches
# the spelled-out "section N" as well as "§N": PP-z9m1's first sweep converted
# every § form and left `AGENTS.md section 3` sitting in this very file,
# because the gate only knew one spelling of the thing it was banning.
SECTION_CITATION = re.compile(
    r"AGENTS\.md`?[ \t]*(?:§[ \t]*|[Ss]ection[ \t]+)\d(?:\.?\d)*"
)

# The hard-wrapped section citation, for the same reason WRAPPED_RULE_CITATION
# exists: "AGENTS.md\n# §8" in a comment block wrapped at ~78 columns. The
# continuation line may open with comment punctuation (`#`, ` * `, `//`) before
# the §, so the leading run of non-word characters is tolerated. No heading
# exception is needed here -- unlike "rule", a line ending in "AGENTS.md" is
# never a heading followed by an ordered list.
WRAPPED_SECTION_CITATION = re.compile(r"\bAGENTS\.md`?[ \t]*$")
WRAPPED_SECTION_NUMBER = re.compile(r"^\W{0,4}(?:§[ \t]*|[Ss]ection[ \t]+)\d")

# A heading-title citation: AGENTS.md "Which tests to run" (optionally with the
# filename code-fenced). Unlike a number, this one is checkable -- see
# find_unresolved_section_titles().
SECTION_TITLE_CITATION = re.compile(r"AGENTS\.md`?[ \t]+\"([^\"\n]{2,80})\"")

# An AGENTS.md ATX heading. The leading "N. " on a top-level heading is part of
# the numbering, not the title, so it is stripped before matching: a citation
# says "Deployment", never "7. Deployment".
AGENTS_HEADING = re.compile(
    r"^#{2,6}[ \t]+(?:\d+(?:\.\d+)*\.?[ \t]+)?(.+?)[ \t]*$", re.MULTILINE
)

CATALOG = "docs/NON_NEGOTIABLES.md"

# Files and globs whose CORE-* citations must resolve. Missing paths are fine
# -- a glob that matches nothing is skipped, so this list can name a surface
# before it exists (it named .claude/rules/ for two weeks before PP-22e4.4
# created it) and can outlive one that is retired.
#
# .agents/skills/ is here because it is a first-class citation surface, not a
# doc archive: AGENTS.md "Agent Skills" instructs every agent to load the relevant
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
    ".claude/rules/*.md",
    ".claude/rules/**/*.md",
    ".agents/rules/*.md",
    ".agents/skills/**/*.md",
    ".claude/hooks/*.cjs",
)

# Files and globs scanned for fragile rule-number/section-number citations
# (PP-22e4, PP-z9m1), and for heading titles that must resolve (PP-z9m1).
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
# citations, per AGENTS.md "Documentation". Add a path here only when a real citation
# turns up in it.
LEGACY_CITATION_SOURCES: tuple[str, ...] = (
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "docs/NON_NEGOTIABLES.md",
    "docs/ENV_VARS.md",
    ".agents/rules/*.md",
    "scripts/**/*.sh",
    ".claude/rules/*.md",
    ".claude/rules/**/*.md",
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
    """Return every fragile rule-number/section-number citation as (line, text).

    1-indexed line numbers, so a failure message can point straight at the
    offending line instead of just the file.
    """
    hits: list[tuple[int, str]] = []
    for regex in (NUMBERED_RULE_CITATION, SECTION_CITATION):
        for match in regex.finditer(text):
            line_no = text.count("\n", 0, match.start()) + 1
            hits.append((line_no, match.group(0)))

    lines = text.splitlines()
    for index, line in enumerate(lines[:-1]):
        if not line.lstrip().startswith("#"):  # A heading is not a wrapped sentence.
            match = WRAPPED_RULE_CITATION.search(line)
            if match and WRAPPED_CITATION_NUMBER.match(lines[index + 1]):
                wrapped = f"{match.group(0)} {lines[index + 1].strip()}"
                hits.append((index + 1, wrapped))

        match = WRAPPED_SECTION_CITATION.search(line)
        if match and WRAPPED_SECTION_NUMBER.match(lines[index + 1]):
            wrapped = f"{match.group(0)} {lines[index + 1].strip()}"
            hits.append((index + 1, wrapped))

    hits.sort()
    return hits


def collect_section_titles(root: Path) -> set[str]:
    """Every ATX heading title in AGENTS.md, minus any "N. " numeric prefix."""
    text = (root / "AGENTS.md").read_text(encoding="utf-8")
    return {match.group(1) for match in AGENTS_HEADING.finditer(text)}


def find_unresolved_section_titles(
    text: str, titles: set[str]
) -> list[tuple[int, str]]:
    """Return every AGENTS.md "Title" citation that matches no real heading.

    A cited title resolves if it equals a heading or is a prefix of one. The
    prefix rule exists for headings that carry a parenthetical gloss --
    `### Lint engines (authoritative ESLint + local oxlint mirror)` is cited as
    "Lint engines", and requiring the gloss verbatim would make every citation
    churn whenever the gloss is reworded. A prefix still pins the part of the
    heading that identifies it.
    """
    hits: list[tuple[int, str]] = []
    for match in SECTION_TITLE_CITATION.finditer(text):
        cited = match.group(1)
        if any(title == cited or title.startswith(cited) for title in titles):
            continue
        line_no = text.count("\n", 0, match.start()) + 1
        hits.append((line_no, cited))
    return hits


def collect_unresolved_section_titles(root: Path) -> dict[str, list[tuple[int, str]]]:
    """Map relative file path -> [(line, cited title), ...] for titles that
    resolve to no AGENTS.md heading.

    The counterpart to the ban on section numbers: replacing "§7" with
    "Deployment" is only an improvement if something notices when the heading
    is renamed. Scoped to the same allowlist as the ban itself.
    """
    if not (root / "AGENTS.md").is_file():
        return {}
    titles = collect_section_titles(root)
    found: dict[str, list[tuple[int, str]]] = {}
    for pattern in LEGACY_CITATION_SOURCES:
        for path in _glob_paths(root, pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if rel in found or rel in LEGACY_CITATION_SELF_EXCLUDE:
                continue  # Overlapping globs, or this module's own docstrings.
            hits = find_unresolved_section_titles(
                path.read_text(encoding="utf-8"), titles
            )
            if hits:
                found[rel] = hits
    return found


def collect_legacy_citations(root: Path) -> dict[str, list[tuple[int, str]]]:
    """Map relative file path -> [(line, matched text), ...] for fragile
    rule-number/section-number citations.

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

    # ERROR: a fragile "rule N" / "commandment N" / "AGENTS.md §N" citation
    # (PP-22e4, PP-z9m1). Rule numbers stopped resolving when PP-22e4.4 moved
    # the rules to .claude/rules/; section numbers shift silently whenever
    # AGENTS.md gains or loses a section. Neither is machine-checkable against
    # a catalog the way a CORE-* ID is: ban the pattern outright.
    legacy = collect_legacy_citations(root)
    if legacy:
        print(
            "check:rule-ids: fragile AGENTS.md rule-number/section-number "
            "citation(s) found\n",
            file=sys.stderr,
        )
        for rel in sorted(legacy):
            for line_no, matched_text in legacy[rel]:
                print(f"  {rel}:{line_no}: {matched_text!r}", file=sys.stderr)
        print(
            "\nNeither form resolves on its own. A rule number points at "
            "nothing since PP-22e4.4 moved the rules to .claude/rules/ -- "
            f"cite the CORE-* ID instead, from {CATALOG}, which is the only "
            "catalog there is. A section number goes stale the next time "
            "AGENTS.md is restructured, and nothing tells the citation -- "
            'cite the heading title instead: AGENTS.md "Which tests to run".',
            file=sys.stderr,
        )
        return 4

    # ERROR: a heading-title citation that resolves to no AGENTS.md heading.
    # Banning section numbers only helps if the replacement is checkable, and
    # this is the check: a renamed or deleted heading fails here instead of
    # quietly sending readers nowhere, which is exactly the failure mode the
    # numbers had.
    unresolved = collect_unresolved_section_titles(root)
    if unresolved:
        print(
            "check:rule-ids: AGENTS.md heading-title citation(s) that resolve "
            "to no heading\n",
            file=sys.stderr,
        )
        for rel in sorted(unresolved):
            for line_no, title in unresolved[rel]:
                print(f"  {rel}:{line_no}: {title!r}", file=sys.stderr)
        print(
            "\nEither the heading was renamed (update the citations) or the "
            "citation was always wrong. A cited title must equal an AGENTS.md "
            "heading or be a prefix of one -- the prefix rule is what lets "
            '"Lint engines" cite a heading that carries a parenthetical gloss.',
            file=sys.stderr,
        )
        return 5

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
