"""Unit tests for scripts/workflow/e2e-shard-files.py.

The comprehensive post-merge E2E job runs one leg per shard, and each leg runs
this script to pick its files. A file in no shard is a spec that silently stops
running on main; a file in two shards runs twice against different databases.
Both are invisible from any single leg's green verdict, so the partition is
what these tests pin.
"""

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "workflow" / "e2e-shard-files.py"
_spec = importlib.util.spec_from_file_location("e2e_shard_files", SCRIPT_PATH)
assert _spec is not None and _spec.loader is not None
shard_files = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(shard_files)


BROWSERS = ["chromium", "Mobile Chrome", "Mobile Safari"]


def suite(file: str, tests_per_project: int, projects: list[str] = BROWSERS) -> dict:
    """A file suite as `--list --reporter=json` emits it: specs nested under a describe."""
    specs = [
        {"title": f"t{i}", "tests": [{"projectName": p} for p in projects]}
        for i in range(tests_per_project)
    ]
    return {
        "file": file,
        "specs": [],
        "suites": [{"title": "describe", "specs": specs}],
    }


REPORT = {
    "suites": [
        suite("full/big.spec.ts", 10),
        suite("full/medium.spec.ts", 5),
        suite("full/a.spec.ts", 2),
        suite("full/b.spec.ts", 2),
        suite("full/c.spec.ts", 1),
        suite("auth.setup.ts", 1, projects=["auth-setup"]),
    ]
}
SPEC_FILES = sorted(s["file"] for s in REPORT["suites"] if s["file"] != "auth.setup.ts")


def run(tmp_path: Path, report: dict, shard: str) -> subprocess.CompletedProcess[str]:
    path = tmp_path / "list.json"
    path.write_text(json.dumps(report))
    return subprocess.run(
        [sys.executable, str(SCRIPT_PATH), str(path), shard],
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize("total", [1, 2, 3, 4])
def test_shards_partition_every_file_exactly_once(tmp_path: Path, total: int) -> None:
    picked: list[str] = []
    for current in range(1, total + 1):
        result = run(tmp_path, REPORT, f"{current}/{total}")
        assert result.returncode == 0, result.stderr
        lines = result.stdout.splitlines()
        assert lines, f"shard {current}/{total} is empty"
        picked.extend(lines)
    assert sorted(picked) == SPEC_FILES


def test_counts_tests_in_nested_suites_across_projects() -> None:
    weights = shard_files.file_weights(REPORT)
    assert weights["full/big.spec.ts"] == 30


def test_setup_project_files_are_not_sharded() -> None:
    """auth.setup.ts runs on every leg as a dependency project, whatever the list says.

    Listing it would weigh one leg down for nothing and let it count toward
    filling the shards while running no browser spec.
    """
    assert "auth.setup.ts" not in shard_files.file_weights(REPORT)


def test_setup_file_does_not_count_toward_filling_shards(tmp_path: Path) -> None:
    report = {
        "suites": [
            suite("full/only.spec.ts", 3),
            suite("auth.setup.ts", 1, projects=["auth-setup"]),
        ]
    }
    result = run(tmp_path, report, "2/2")
    assert result.returncode == 1
    assert "cannot fill 2 shards" in result.stderr


def test_balances_by_test_count_not_file_count() -> None:
    weights = {"heavy.spec.ts": 100, **{f"light{i}.spec.ts": 10 for i in range(10)}}
    shards = shard_files.assign(weights, 2)
    assert shards[0] == ["heavy.spec.ts"]
    assert len(shards[1]) == 10


def test_assignment_is_deterministic_regardless_of_report_order() -> None:
    weights = shard_files.file_weights(REPORT)
    reversed_weights = dict(reversed(list(weights.items())))
    assert shard_files.assign(weights, 3) == shard_files.assign(reversed_weights, 3)


def test_refuses_more_shards_than_files(tmp_path: Path) -> None:
    result = run(tmp_path, {"suites": [suite("full/only.spec.ts", 3)]}, "2/2")
    assert result.returncode == 1
    assert result.stdout == ""
    assert "cannot fill 2 shards" in result.stderr


@pytest.mark.parametrize("shard", ["0/2", "3/2", "1", "a/b", "1/0"])
def test_rejects_malformed_shard(tmp_path: Path, shard: str) -> None:
    result = run(tmp_path, REPORT, shard)
    assert result.returncode != 0
    assert result.stdout == ""


def test_refuses_to_shard_when_a_spec_failed_to_load(tmp_path: Path) -> None:
    """A file that fails to load is absent from `suites`; sharding would drop it."""
    report = {**REPORT, "errors": [{"message": "SyntaxError in full/broken.spec.ts"}]}
    result = run(tmp_path, report, "1/2")
    assert result.returncode == 1
    assert result.stdout == ""
    assert "broken.spec.ts" in result.stderr
