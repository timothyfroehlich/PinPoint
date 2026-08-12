#!/usr/bin/env python3
"""Fail when an e2e spec file is matched by no Playwright suite config.

PinPoint runs its E2E specs through exactly two suite configs --
playwright.config.full.ts and playwright.config.smoke.ts -- and nothing else
enumerates them. A spec that lands outside both directories still exists,
still type-checks, and still lints, so every signal a developer sees stays
green while the file runs nowhere. PP-stut found e2e/profiles/profile-edit.
spec.ts had been dead that way for roughly five weeks.

This gate closes that gap statically: enumerate every spec file under e2e/ on
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
So the matching is done here, against the three properties that decide
collection: testDir, testMatch and testIgnore.

Why the configs are parsed rather than hardcoded
------------------------------------------------
Hardcoding "e2e/full and e2e/smoke are covered" would encode a snapshot of the
configs and go quietly stale the moment one of them changed -- the same class
of rot the gate exists to catch. Instead the configs' top-level testDir,
testMatch and testIgnore are read out of their source.

The parse is deliberately strict, and strictness here means one specific
thing: **no shape may be read as wider coverage than it really has.** Every
unreadable shape is a hard failure telling you to update this gate. That rule
is what the following three decisions come from.

  Spreads are resolved, not skipped. Both suite configs are
  `{...baseConfig, ...}`, so ignoring the spread would mean the moment
  playwright.config.ts grows a testMatch, this gate keeps using a wider
  default and calls dead specs covered. A spread of a plain identifier
  imported by default from a relative module is followed and merged in source
  order (later keys win, exactly as JavaScript does it). Any other spread --
  a conditional, an inline object, a bare-package import -- raises.

  An absent testMatch means Playwright's documented default,
  `**/*.@(spec|test).?(c|m)[jt]s?(x)`, not "match everything".
  playwright.config.smoke.ts ships no testMatch of its own, so absence is a
  known shape with a known meaning and must be modelled rather than treated
  as either an error or a wildcard. This is why glob_to_regex understands
  extglob groups and bracket expressions: the default pattern uses both.

  testIgnore is subtracted, not dropped. Reading a key and then discarding it
  is the worst of the three failure modes, because it does not even reach the
  unknown-shape error path -- it silently widens coverage.

Known limitations, stated rather than papered over. Only the top-level
testDir/testMatch/testIgnore are read; Playwright also lets an individual
entry in `projects` override all three, in both directions:

  Narrowing (risk: false GREEN). A project may narrow testMatch --
  playwright.config.smoke.ts does exactly this for firefox and Mobile Safari
  when running locally. Coverage is the union over projects, so a narrowing
  only matters if EVERY project in a config narrows away from a spec, at
  which point this gate would call that spec covered when it is not.

  Widening (risk: false RED). A project may also override testDir to a
  directory outside the top-level one -- playwright.config.smoke.ts already
  has one (`auth-setup`, testDir "./e2e"), harmless today only because its
  testMatch is the single file auth.setup.ts. A future project with, say,
  testDir "./e2e/perf" and a spec-matching testMatch would run live specs
  that this gate reports as uncovered, failing CI on working tests.

Neither case exists today. Modelling per-project matchers would mean a much
larger parser with more ways to be wrong, so the tradeoff is deliberate: if
you hit the false RED, widen a top-level testDir or move the spec rather than
teaching this gate about projects.

Exit codes: 0 clean, 1 uncovered spec(s), 2 a suite config or the spec root is
missing, 3 a config's shape is not recognised.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# The suite configs whose union must cover every spec. `playwright.config.ts`
# is deliberately absent: it is the shared base the two suites spread (and is
# resolved through that spread, below), and no workflow is supposed to invoke
# it directly over the whole tree -- doing so runs every spec in one process
# against one database and cross-contaminates seed state (AGENTS.md section 5).
SUITE_CONFIGS: tuple[str, ...] = (
    "playwright.config.full.ts",
    "playwright.config.smoke.ts",
)

# Spec files on disk. Both suffixes Playwright's default testMatch collects.
# Support and helper modules (e2e/support/*.ts, e2e/global-setup.ts,
# e2e/auth.setup.ts) carry neither suffix and are not collected by testMatch
# either, so sweeping them in would invent failures.
#
# *.test.ts is included even though it is the Vitest naming convention,
# because under e2e/ that convention is inert: all three Vitest projects root
# their `include` at src/**, so Vitest never collects anything below e2e/. A
# file at e2e/support/foo.test.ts would therefore be run by nothing at all --
# exactly the rot this gate exists to catch -- rather than being a unit test
# this gate should keep its hands off.
SPEC_ROOT = "e2e"
SPEC_SUFFIXES: tuple[str, ...] = (".spec.ts", ".test.ts")

# Playwright's documented default testMatch, used when a config sets none.
# https://playwright.dev/docs/api/class-testconfig#test-config-test-match
DEFAULT_TEST_MATCH = "**/*.@(spec|test).?(c|m)[jt]s?(x)"

# Marker used to locate the repo root when --root is not given.
ROOT_MARKER = "playwright.config.ts"

# `export default defineConfig({` -- the only shape either suite config uses.
DEFINE_CONFIG = re.compile(r"export\s+default\s+defineConfig\s*\(\s*\{")

# `import baseConfig from "./playwright.config";` -- default imports only.
# Named and namespace imports are not resolvable into a config object, so a
# spread of one falls through to the unknown-shape error.
DEFAULT_IMPORT = re.compile(
    r"^\s*import\s+(?P<name>[A-Za-z_$][\w$]*)\s+from\s+"
    r"""(?P<q>["'])(?P<module>[^"']+)(?P=q)""",
    re.MULTILINE,
)

STRING_LITERAL = re.compile(r"""^(?P<q>["'])(?P<value>(?:[^"'\\]|\\.)*)(?P=q)$""")

# Extensions tried, in order, when resolving a relative import specifier.
MODULE_EXTENSIONS: tuple[str, ...] = ("", ".ts", ".mts", ".cts", ".js", ".mjs")

# How deep a chain of config spreads to follow before giving up.
MAX_SPREAD_DEPTH = 8


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


def top_level_items(source: str) -> list[tuple[str, str, str]]:
    """Return the defineConfig object's top-level members, in source order.

    Each item is ("spread", expression, "") or ("key", key, raw value). Order
    is preserved because it decides precedence: in JavaScript a key after a
    spread overrides it, and a spread after a key overrides that key.
    """
    source = strip_comments(source)

    match = DEFINE_CONFIG.search(source)
    if match is None:
        raise ConfigShapeError("no `export default defineConfig({ ... })` found")

    body = _object_body(source, match.end() - 1)

    items: list[tuple[str, str, str]] = []
    for raw in _split_top_level(body, ","):
        entry = raw.strip()
        if not entry:
            continue
        if entry.startswith("..."):
            items.append(("spread", entry[3:].strip(), ""))
            continue
        halves = _split_top_level(entry, ":")
        if len(halves) < 2:
            continue  # Shorthand property or a trailing fragment; no value to read.
        key = halves[0].strip().strip("\"'")
        items.append(("key", key, ":".join(halves[1:]).strip()))
    return items


def top_level_entries(source: str) -> dict[str, str]:
    """Map top-level key -> raw value text, ignoring spreads.

    This is the config's own statement of itself. resolve_config_entries()
    is what folds spreads in; callers that need effective values want that.
    """
    return {key: value for kind, key, value in top_level_items(source) if kind == "key"}


def parse_default_imports(source: str) -> dict[str, str]:
    """Map local binding name -> module specifier for each default import."""
    return {
        match.group("name"): match.group("module")
        for match in DEFAULT_IMPORT.finditer(strip_comments(source))
    }


def resolve_module_path(root: Path, importer: str, specifier: str) -> str:
    """Resolve a relative import specifier to a repo-relative file path."""
    if not specifier.startswith("."):
        raise ConfigShapeError(
            f"{importer}: spread of {specifier!r}, which is not a relative "
            "module this gate can read."
        )
    base = (root / importer).parent
    for extension in MODULE_EXTENSIONS:
        candidate = (base / (specifier + extension)).resolve()
        if candidate.is_file():
            return candidate.relative_to(root.resolve()).as_posix()
    raise ConfigShapeError(
        f"{importer}: spread of {specifier!r}, which resolves to no file on disk."
    )


def resolve_config_entries(
    root: Path, rel_path: str, depth: int = 0, seen: frozenset[str] = frozenset()
) -> dict[str, str]:
    """Read `rel_path`'s effective top-level keys, following config spreads.

    Later members win, matching JavaScript object-literal semantics, so a
    spread placed after a key overrides that key and vice versa.
    """
    if depth > MAX_SPREAD_DEPTH:
        raise ConfigShapeError(
            f"{rel_path}: config spreads nested more than {MAX_SPREAD_DEPTH} deep."
        )
    if rel_path in seen:
        raise ConfigShapeError(f"{rel_path}: circular config spread.")

    source = (root / rel_path).read_text(encoding="utf-8")
    imports = parse_default_imports(source)

    merged: dict[str, str] = {}
    for kind, name, value in top_level_items(source):
        if kind == "key":
            merged[name] = value
            continue
        specifier = imports.get(name)
        if specifier is None:
            raise ConfigShapeError(
                f"{rel_path}: spread of `...{name}`, which is not a plain "
                "default import of a config module. This gate resolves "
                "spreads rather than skipping them, because a skipped spread "
                "silently widens coverage."
            )
        target = resolve_module_path(root, rel_path, specifier)
        merged.update(
            resolve_config_entries(root, target, depth + 1, seen | {rel_path})
        )
    return merged


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


def parse_pattern_list(config_name: str, key: str, raw: str) -> list[str]:
    """Parse a testMatch/testIgnore value into a list of glob patterns."""
    single = parse_string_literal(raw)
    if single is not None:
        return [single]
    array = parse_string_array(raw)
    if array is None:
        raise ConfigShapeError(
            f"{config_name}: `{key}` is {raw!r}, which is neither a string "
            "literal nor an array of them (a RegExp, a constant reference or "
            "a conditional would all land here). Teach this gate the new "
            "shape rather than letting it assume coverage."
        )
    return array


class SuiteConfig:
    """The three properties of a Playwright config that decide file collection."""

    def __init__(
        self,
        name: str,
        test_dir: str,
        test_match: list[str],
        test_ignore: list[str],
        *,
        default_match: bool = False,
    ):
        self.name = name
        self.test_dir = test_dir
        self.test_match = test_match
        self.test_ignore = test_ignore
        self.default_match = default_match

    def describe(self) -> str:
        match = ", ".join(self.test_match)
        if self.default_match:
            match += "  (Playwright default; config sets none)"
        line = f"{self.name}: testDir={self.test_dir or '.'} testMatch={match}"
        if self.test_ignore:
            line += f" testIgnore={', '.join(self.test_ignore)}"
        return line

    def collects(self, spec: str) -> bool:
        """Would this config collect the repo-relative spec path `spec`?"""
        if self.test_dir and not spec.startswith(f"{self.test_dir}/"):
            return False
        if any(glob_to_regex(pattern).match(spec) for pattern in self.test_ignore):
            return False
        return any(glob_to_regex(pattern).match(spec) for pattern in self.test_match)


def read_suite_config(root: Path, name: str) -> SuiteConfig:
    """Read `name`'s effective testDir/testMatch/testIgnore, raising on surprises."""
    entries = resolve_config_entries(root, name)

    raw_dir = entries.get("testDir")
    if raw_dir is None:
        raise ConfigShapeError(
            f"{name}: no `testDir`, in this config or anything it spreads."
        )
    test_dir = parse_string_literal(raw_dir)
    if test_dir is None:
        raise ConfigShapeError(
            f"{name}: `testDir` is {raw_dir!r}, not a plain string literal."
        )

    raw_match = entries.get("testMatch")
    default_match = raw_match is None
    test_match = (
        [DEFAULT_TEST_MATCH]
        if default_match
        else parse_pattern_list(name, "testMatch", raw_match or "")
    )

    raw_ignore = entries.get("testIgnore")
    test_ignore = (
        [] if raw_ignore is None else parse_pattern_list(name, "testIgnore", raw_ignore)
    )

    return SuiteConfig(
        name,
        normalize_dir(test_dir),
        test_match,
        test_ignore,
        default_match=default_match,
    )


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
    """Compile a Playwright testMatch/testIgnore glob into a regex over posix paths.

    Supports what the configs and Playwright's own default pattern use:
    `**/` (zero or more path segments), `*` and `?` (within one segment),
    `[...]` bracket expressions, and the extglob groups `@(a|b)`, `?(a)`,
    `*(a)`, `+(a)`. Negated extglob `!(a)` raises rather than guessing.

    Playwright prepends `**/` to any pattern that does not already start with
    `**/` or `/`, so paths are matched repo-relative.
    """
    if not pattern.startswith("**/") and not pattern.startswith("/"):
        pattern = f"**/{pattern}"
    pattern = pattern.lstrip("/")

    closers = {"@": ")", "?": ")?", "*": ")*", "+": ")+"}
    parts: list[str] = []
    stack: list[str] = []
    index = 0
    length = len(pattern)
    while index < length:
        char = pattern[index]
        if pattern.startswith("**/", index):
            parts.append("(?:[^/]+/)*")
            index += 3
            continue
        if pattern.startswith("**", index):
            parts.append(".*")
            index += 2
            continue
        if char in "@?*+!" and index + 1 < length and pattern[index + 1] == "(":
            if char == "!":
                raise ConfigShapeError(
                    f"negated extglob `!(` in pattern {pattern!r} is not "
                    "supported; this gate will not guess at its coverage."
                )
            parts.append("(?:")
            stack.append(closers[char])
            index += 2
            continue
        if char == ")" and stack:
            parts.append(stack.pop())
            index += 1
            continue
        if char == "|" and stack:
            parts.append("|")
            index += 1
            continue
        if char == "[":
            end = index + 1
            if end < length and pattern[end] in "!^":
                end += 1
            if end < length and pattern[end] == "]":
                end += 1
            while end < length and pattern[end] != "]":
                end += 1
            if end >= length:
                raise ConfigShapeError(
                    f"unterminated bracket expression in pattern {pattern!r}"
                )
            body = pattern[index + 1 : end]
            if body.startswith("!"):
                body = "^" + body[1:]
            parts.append(f"[{body}]")
            index = end + 1
            continue
        if char == "*":
            parts.append("[^/]*")
            index += 1
            continue
        if char == "?":
            parts.append("[^/]")
            index += 1
            continue
        parts.append(re.escape(char))
        index += 1

    if stack:
        raise ConfigShapeError(f"unbalanced extglob group in pattern {pattern!r}")
    return re.compile("".join(parts) + r"\Z")


def collect_specs(root: Path) -> list[str]:
    """Every repo-relative e2e spec path on disk, sorted."""
    spec_root = root / SPEC_ROOT
    if not spec_root.is_dir():
        return []
    return sorted(
        path.relative_to(root).as_posix()
        for path in spec_root.rglob("*")
        if path.is_file() and path.name.endswith(SPEC_SUFFIXES)
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
        uncovered = [
            spec
            for spec in collect_specs(root)
            if not any(config.collects(spec) for config in configs)
        ]
    except ConfigShapeError as error:
        print(f"check:e2e-suites: {error}", file=sys.stderr)
        return 3

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
