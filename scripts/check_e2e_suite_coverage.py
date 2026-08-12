#!/usr/bin/env python3
"""Fail when an e2e spec file is matched by no Playwright suite config.

PinPoint runs its E2E specs through exactly two suite configs --
playwright.config.full.ts and playwright.config.smoke.ts -- and nothing else
enumerates them. A spec that lands outside both directories still exists,
still type-checks, and still lints, so every signal a developer sees stays
green while the file runs nowhere. PP-stut found e2e/profiles/profile-edit.
spec.ts had been dead that way for roughly five weeks.

This gate closes that gap statically: enumerate every e2e/**/*.spec.ts on
disk, ask each suite config whether it would collect it, and fail on any spec
no config claims.

Why glob matching rather than `playwright test --list`
------------------------------------------------------
Playwright can enumerate its own resolved files, which would remove any need
to reimplement testMatch semantics. It is the wrong tool here for two reasons:
it boots the config's globalSetup (which for this repo resets the local
Supabase database), and it costs a Node process plus a TypeScript transform of
the whole e2e tree per config. This gate runs inside `pnpm run check`, whose
entire value is finishing in about nine seconds without touching a database.
So the matching is done here, against the two properties that decide
collection: testDir and testMatch.

Why the configs are parsed rather than hardcoded
------------------------------------------------
Hardcoding "e2e/full and e2e/smoke are covered" would encode a snapshot of the
configs and go quietly stale the moment one of them changed -- the same class
of rot the gate exists to catch. Instead the two configs' top-level testDir
and testMatch are read out of their source. The parse is deliberately strict:
anything it does not recognise is a hard failure telling you to update this
gate, never a silent assumption of coverage.

Known limitation, stated rather than papered over: only the top-level testDir
and testMatch are read. Playwright also lets an individual entry in `projects`
narrow testMatch further (playwright.config.smoke.ts does exactly this for
firefox and Mobile Safari when running locally). Since coverage is the union
over projects, a per-project narrowing only matters if EVERY project in a
config narrows away from a spec -- at which point this gate would call the
spec covered when it is not. No config does that today, and the failure mode
of the alternative (modelling per-project matchers) is a much larger parser
with more ways to be wrong.

Exit codes: 0 clean, 1 uncovered spec(s), 2 a suite config is missing,
3 a suite config's shape is not recognised.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# The suite configs whose union must cover every spec. `playwright.config.ts`
# is deliberately absent: it is the shared base the two suites spread, and no
# workflow is supposed to invoke it directly over the whole tree (doing so
# runs every spec in one process against one database and cross-contaminates
# seed state -- AGENTS.md section 5).
SUITE_CONFIGS: tuple[str, ...] = (
    "playwright.config.full.ts",
    "playwright.config.smoke.ts",
)

# Spec files on disk. Only *.spec.ts -- support and helper modules under
# e2e/support/, e2e/global-setup.ts and e2e/auth.setup.ts are not specs and
# are not collected by testMatch either, so sweeping them in would invent
# failures. Playwright's default testMatch would also collect *.test.ts, but
# every E2E spec in this repo is *.spec.ts and *.test.ts is the Vitest naming
# convention -- enumerating it here would eventually flag a unit test for an
# e2e helper as a dead spec.
SPEC_ROOT = "e2e"
SPEC_SUFFIX = ".spec.ts"

# Marker used to locate the repo root when --root is not given.
ROOT_MARKER = "playwright.config.ts"

# `export default defineConfig({` -- the only shape either suite config uses.
DEFINE_CONFIG = re.compile(r"export\s+default\s+defineConfig\s*\(\s*\{")

STRING_LITERAL = re.compile(r"""^(?P<q>["'])(?P<value>(?:[^"'\\]|\\.)*)(?P=q)$""")


class ConfigShapeError(Exception):
    """A suite config is not in a shape this gate knows how to read."""


def find_repo_root(start: Path) -> Path:
    """Walk up until a directory containing the base Playwright config."""
    for candidate in (start, *start.parents):
        if (candidate / ROOT_MARKER).is_file():
            return candidate
    return start


def _skip_string(source: str, index: int) -> int:
    """Return the index just past the string literal starting at `index`."""
    quote = source[index]
    index += 1
    while index < len(source):
        char = source[index]
        if char == "\\":
            index += 2
            continue
        if char == quote:
            return index + 1
        index += 1
    raise ConfigShapeError("unterminated string literal")


def strip_comments(source: str) -> str:
    """Replace every line and block comment with a space, leaving strings alone.

    Doing this in one pass up front is what keeps the two scanners below
    honest: a commented-out `testDir: "./decoy",` otherwise ends up glued onto
    the front of the next real key, and a `{` or `,` inside a block comment
    otherwise moves the depth counter.
    """
    out: list[str] = []
    index = 0
    while index < len(source):
        char = source[index]
        if char in "\"'`":
            end = _skip_string(source, index)
            out.append(source[index:end])
            index = end
            continue
        if source.startswith("//", index):
            end = source.find("\n", index)
            index = len(source) if end == -1 else end
            out.append(" ")
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end == -1:
                raise ConfigShapeError("unterminated block comment")
            index = end + 2
            out.append(" ")
            continue
        out.append(char)
        index += 1
    return "".join(out)


def _object_body(source: str, open_brace: int) -> str:
    """Return the text between `{` at `open_brace` and its matching `}`.

    Expects comment-free input (see strip_comments). Strings and template
    literals are skipped so braces inside them never move the depth counter.
    """
    depth = 0
    index = open_brace
    while index < len(source):
        char = source[index]
        if char in "\"'`":
            index = _skip_string(source, index)
            continue
        if char in "{[(":
            depth += 1
        elif char in "}])":
            depth -= 1
            if depth == 0:
                return source[open_brace + 1 : index]
        index += 1
    raise ConfigShapeError("unbalanced braces in defineConfig object")


def _split_top_level(body: str, separator: str) -> list[str]:
    """Split `body` on `separator` characters that sit at nesting depth zero.

    Expects comment-free input (see strip_comments).
    """
    parts: list[str] = []
    depth = 0
    start = 0
    index = 0
    while index < len(body):
        char = body[index]
        if char in "\"'`":
            index = _skip_string(body, index)
            continue
        if char in "{[(":
            depth += 1
        elif char in "}])":
            depth -= 1
        elif char == separator and depth == 0:
            parts.append(body[start:index])
            start = index + 1
        index += 1
    parts.append(body[start:])
    return parts


def top_level_entries(source: str) -> dict[str, str]:
    """Map top-level key -> raw value text for `export default defineConfig({...})`.

    Spread elements (`...baseConfig`) are skipped: this gate only reads keys
    the config states for itself, and a value inherited from the base config
    is reported as absent rather than guessed at.
    """
    source = strip_comments(source)

    match = DEFINE_CONFIG.search(source)
    if match is None:
        raise ConfigShapeError("no `export default defineConfig({ ... })` found")

    body = _object_body(source, match.end() - 1)

    entries: dict[str, str] = {}
    for raw in _split_top_level(body, ","):
        entry = raw.strip()
        if not entry or entry.startswith("..."):
            continue
        halves = _split_top_level(entry, ":")
        if len(halves) < 2:
            continue  # Shorthand property or a trailing fragment; no value to read.
        key = halves[0].strip().strip("\"'")
        entries[key] = ":".join(halves[1:]).strip()
    return entries


def parse_string_literal(value: str) -> str | None:
    """Return the contents of a single-quoted/double-quoted literal, else None."""
    match = STRING_LITERAL.match(value.strip())
    return match.group("value") if match else None


def parse_string_array(value: str) -> list[str] | None:
    """Return the contents of an array of string literals, else None."""
    text = value.strip()
    if not (text.startswith("[") and text.endswith("]")):
        return None
    items: list[str] = []
    for raw in _split_top_level(text[1:-1], ","):
        item = raw.strip()
        if not item:
            continue
        parsed = parse_string_literal(item)
        if parsed is None:
            return None
        items.append(parsed)
    return items


class SuiteConfig:
    """The two properties of a Playwright config that decide file collection."""

    def __init__(self, name: str, test_dir: str, test_match: list[str] | None):
        self.name = name
        self.test_dir = test_dir
        self.test_match = test_match

    def describe(self) -> str:
        patterns = ", ".join(self.test_match) if self.test_match else "(default)"
        return f"{self.name}: testDir={self.test_dir} testMatch={patterns}"

    def collects(self, spec: str) -> bool:
        """Would this config collect the repo-relative spec path `spec`?"""
        if self.test_dir and not spec.startswith(f"{self.test_dir}/"):
            return False
        if self.test_match is None:
            return True
        return any(glob_to_regex(pattern).match(spec) for pattern in self.test_match)


def read_suite_config(root: Path, name: str) -> SuiteConfig:
    """Read `name`'s top-level testDir/testMatch, raising on any shape surprise."""
    source = (root / name).read_text(encoding="utf-8")
    entries = top_level_entries(source)

    raw_dir = entries.get("testDir")
    if raw_dir is None:
        raise ConfigShapeError(
            f"{name}: no top-level `testDir`. This gate reads coverage from a "
            "config's own testDir, not one inherited via a spread."
        )
    test_dir = parse_string_literal(raw_dir)
    if test_dir is None:
        raise ConfigShapeError(
            f"{name}: `testDir` is {raw_dir!r}, not a plain string literal."
        )

    raw_match = entries.get("testMatch")
    test_match: list[str] | None
    if raw_match is None:
        test_match = None
    else:
        single = parse_string_literal(raw_match)
        if single is not None:
            test_match = [single]
        else:
            array = parse_string_array(raw_match)
            if array is None:
                raise ConfigShapeError(
                    f"{name}: `testMatch` is {raw_match!r}, which is neither a "
                    "string literal nor an array of them. Teach this gate the "
                    "new shape rather than letting it assume coverage."
                )
            test_match = array

    return SuiteConfig(name, normalize_dir(test_dir), test_match)


def normalize_dir(test_dir: str) -> str:
    """Turn a config's testDir into a repo-relative posix path with no './'.

    The repo root itself ("." or "./") normalizes to "", which SuiteConfig
    reads as "no directory restriction" rather than as a prefix nothing can
    start with.
    """
    cleaned = test_dir.strip().lstrip("/")
    if cleaned.startswith("./"):
        cleaned = cleaned[2:]
    cleaned = cleaned.rstrip("/")
    return "" if cleaned == "." else cleaned


def glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Compile a Playwright testMatch glob into a regex over posix paths.

    Supports the subset the configs use: `**/` (zero or more path segments),
    `*` (any run of characters within one segment) and `?` (one character
    within one segment). Playwright prepends `**/` to any pattern that does
    not already start with `**/` or `/`, so paths are matched repo-relative.
    """
    if not pattern.startswith("**/") and not pattern.startswith("/"):
        pattern = f"**/{pattern}"
    pattern = pattern.lstrip("/")

    parts: list[str] = []
    index = 0
    while index < len(pattern):
        if pattern.startswith("**/", index):
            parts.append("(?:[^/]+/)*")
            index += 3
        elif pattern.startswith("**", index):
            parts.append(".*")
            index += 2
        elif pattern[index] == "*":
            parts.append("[^/]*")
            index += 1
        elif pattern[index] == "?":
            parts.append("[^/]")
            index += 1
        else:
            parts.append(re.escape(pattern[index]))
            index += 1
    return re.compile("".join(parts) + r"\Z")


def collect_specs(root: Path) -> list[str]:
    """Every repo-relative e2e spec path on disk, sorted."""
    spec_root = root / SPEC_ROOT
    if not spec_root.is_dir():
        return []
    return sorted(
        path.relative_to(root).as_posix()
        for path in spec_root.rglob(f"*{SPEC_SUFFIX}")
        if path.is_file()
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repo root (default: discovered from this file's location).",
    )
    args = parser.parse_args(argv)

    root = args.root or find_repo_root(Path(__file__).resolve().parent)

    missing = [name for name in SUITE_CONFIGS if not (root / name).is_file()]
    if missing:
        print(
            "check:e2e-suites: suite config(s) not found: " + ", ".join(missing),
            file=sys.stderr,
        )
        return 2

    # An absent spec root would make the gate pass vacuously, which is the one
    # outcome it must never produce silently.
    if not (root / SPEC_ROOT).is_dir():
        print(
            f"check:e2e-suites: spec root {SPEC_ROOT}/ not found under {root}",
            file=sys.stderr,
        )
        return 2

    try:
        configs = [read_suite_config(root, name) for name in SUITE_CONFIGS]
    except ConfigShapeError as error:
        print(f"check:e2e-suites: {error}", file=sys.stderr)
        return 3

    uncovered = [
        spec
        for spec in collect_specs(root)
        if not any(config.collects(spec) for config in configs)
    ]

    if uncovered:
        print(
            "check:e2e-suites: e2e spec(s) matched by no suite config -- "
            "nothing runs them\n",
            file=sys.stderr,
        )
        for spec in uncovered:
            print(f"  {spec}", file=sys.stderr)
        print("\nSuite configs considered:", file=sys.stderr)
        for config in configs:
            print(f"  {config.describe()}", file=sys.stderr)
        print(
            "\nMove the spec under a directory a suite already collects, or "
            "widen a suite config to collect it. A spec that no suite collects "
            "type-checks and lints green while running nowhere (PP-stut).",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
