#!/usr/bin/env python3
"""Pick one shard's spec files for the post-merge comprehensive E2E job.

  e2e-shard-files.py <list-json> <shard>/<total>

<list-json> is the JSON report of `playwright test --list --reporter=json` run
with every project the shard will run. stdout is a Playwright `--test-list`
file: one spec path per line, relative to the config's testDir (the form the
report uses and the form `--test-list` matches against).

Why files, not Playwright's own `--shard`: `--shard` splits the run's test
groups in project order, so with three browser projects shard 1 is mostly
chromium and shard 3 mostly Mobile Safari. The comprehensive job is the only
place all three projects run a spec against ONE database, which is how it
catches a spec that leaks seeded state (pinpoint-e2e skill, PP-168u). Keeping
every project of a file in the same shard keeps that check.

Files are balanced by test count, largest first onto the lightest shard. Every
leg runs this against the same list, so the shards always partition the full
file set. Exits non-zero rather than printing an empty list: an empty
`--test-list` would run nothing and the shard would only fail later, with a
less obvious "0 specs" verdict.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def count_tests(node: Any) -> int:
    """Count tests under a report suite, at any nesting depth."""
    if isinstance(node, dict):
        total = sum(len(spec.get("tests", [])) for spec in node.get("specs", []))
        return total + sum(count_tests(child) for child in node.get("suites", []))
    return 0


# Dependency projects run on every leg whatever --test-list says, so their
# files are not shardable: listing one would add weight to a leg for nothing,
# and count toward filling the shards while running no browser spec.
SETUP_PROJECTS = frozenset({"auth-setup"})


def project_names(node: Any) -> set[str]:
    """Every projectName under a report suite, at any nesting depth."""
    if not isinstance(node, dict):
        return set()
    names = {
        test.get("projectName", "")
        for spec in node.get("specs", [])
        for test in spec.get("tests", [])
    }
    for child in node.get("suites", []):
        names |= project_names(child)
    return names


def file_weights(report: dict[str, Any]) -> dict[str, int]:
    weights: dict[str, int] = {}
    for suite in report.get("suites", []):
        file = suite.get("file")
        if not file or project_names(suite) <= SETUP_PROJECTS:
            continue
        weights[file] = weights.get(file, 0) + count_tests(suite)
    return weights


def assign(weights: dict[str, int], total: int) -> list[list[str]]:
    """Greedy longest-first assignment; deterministic for a given input."""
    shards: list[list[str]] = [[] for _ in range(total)]
    loads = [0] * total
    for file in sorted(weights, key=lambda f: (-weights[f], f)):
        target = min(range(total), key=lambda i: (loads[i], i))
        shards[target].append(file)
        loads[target] += weights[file]
    return [sorted(files) for files in shards]


def parse_shard(arg: str) -> tuple[int, int]:
    try:
        current, total = (int(part) for part in arg.split("/"))
    except ValueError:
        raise SystemExit(f"shard must look like 1/4, got {arg!r}") from None
    if total < 1 or not 1 <= current <= total:
        raise SystemExit(f"shard {arg!r} is out of range")
    return current, total


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    report = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    current, total = parse_shard(argv[2])

    weights = file_weights(report)
    if len(weights) < total:
        print(
            f"error: {len(weights)} spec file(s) cannot fill {total} shards",
            file=sys.stderr,
        )
        return 1

    files = assign(weights, total)[current - 1]
    load = sum(weights[f] for f in files)
    print(
        f"shard {current}/{total}: {len(files)} file(s), {load} of "
        f"{sum(weights.values())} tests",
        file=sys.stderr,
    )
    for file in files:
        print(file)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
