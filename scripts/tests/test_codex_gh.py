"""Tests for the approval-gated external-repository GitHub wrapper."""

import os
import stat
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "workflow" / "codex-gh.sh"


def run_wrapper(
    tmp_path: Path, *args: str
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    calls = tmp_path / "calls"
    for command in ("git", "gh"):
        stub = tmp_path / command
        stub.write_text(
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            f"printf '%s\\0' '{command}' \"$@\" >> \"$STUB_CALLS\"\n"
            "if [[ $1 == rev-parse && $2 == --show-toplevel ]]; then\n"
            "  printf '%s\\n' \"$STUB_REPOSITORY_ROOT\"\n"
            "fi\n"
        )
        stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
    env = {
        **os.environ,
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "STUB_CALLS": str(calls),
        "STUB_REPOSITORY_ROOT": str(SCRIPT.parent.parent.parent),
    }
    result = subprocess.run(
        ["bash", str(SCRIPT), *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )
    recorded = calls.read_bytes().decode().rstrip("\0").split("\0")
    return result, recorded


@pytest.mark.parametrize(
    ("args", "expected"),
    [
        (("pr-list", "--limit", "20"), ["gh", "pr", "list", "--limit", "20"]),
        (
            ("pr-view", "17", "--json", "title"),
            ["gh", "pr", "view", "17", "--json", "title"],
        ),
        (("pr-checks", "17"), ["gh", "pr", "checks", "17"]),
        (("pr-diff", "17"), ["gh", "pr", "diff", "17"]),
        (("run-list", "--limit", "20"), ["gh", "run", "list", "--limit", "20"]),
        (("run-view", "12345"), ["gh", "run", "view", "12345"]),
    ],
)
def test_read_operations_fix_the_gh_subcommand(
    tmp_path: Path, args: tuple[str, ...], expected: list[str]
) -> None:
    result, calls = run_wrapper(tmp_path, *args)

    assert result.returncode == 0, result.stderr
    assert calls == ["git", "rev-parse", "--show-toplevel", *expected]


def test_merges_only_a_statically_named_external_repository(tmp_path: Path) -> None:
    result, calls = run_wrapper(
        tmp_path, "merge-external", "owner/other", "17", "squash"
    )

    assert result.returncode == 0, result.stderr
    assert calls == [
        "git",
        "rev-parse",
        "--show-toplevel",
        "gh",
        "pr",
        "merge",
        "17",
        "--repo",
        "owner/other",
        "--squash",
    ]


@pytest.mark.parametrize(
    "repository",
    [
        "timothyfroehlich/PinPoint",
        "TimothyFroehlich/pinpoint",
    ],
)
def test_refuses_pinpoint_targets(tmp_path: Path, repository: str) -> None:
    result, calls = run_wrapper(
        tmp_path, "merge-external", repository, "2058", "squash"
    )

    assert result.returncode == 1
    assert "merge-pr.sh 2058 --human" in result.stderr
    assert calls == ["git", "rev-parse", "--show-toplevel"]


@pytest.mark.parametrize(
    "args",
    [
        (),
        ("merge-external", "owner/other", "17"),
        ("merge-external", "owner/other", "not-a-number", "squash"),
        ("merge-external", "owner/other", "17", "force"),
        ("merge-external", "https://github.com/owner/other", "17", "squash"),
        ("merge-external", "owner/other", "17", "squash", "--admin"),
        ("api", "repos/owner/other"),
        ("pr-merge", "17"),
    ],
)
def test_rejects_unknown_or_extra_arguments(
    tmp_path: Path, args: tuple[str, ...]
) -> None:
    result, calls = run_wrapper(tmp_path, *args)

    assert result.returncode == 2
    assert calls == ["git", "rev-parse", "--show-toplevel"]
