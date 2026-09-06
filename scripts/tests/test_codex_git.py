"""Tests for the fixed-interface Codex Git mutation wrapper."""

import os
import stat
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "workflow" / "codex-git.sh"


def run_wrapper(
    tmp_path: Path, *args: str, branch: str = "codex/test"
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    calls = tmp_path / "git-calls"
    git = tmp_path / "git"
    git.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        'printf \'%s\\0\' "$@" >> "$STUB_GIT_CALLS"\n'
        "if [[ $1 == rev-parse && $2 == --show-toplevel ]]; then\n"
        "  printf '%s\\n' \"$STUB_REPOSITORY_ROOT\"\n"
        "elif [[ $1 == symbolic-ref ]]; then\n"
        "  printf '%s\\n' \"$STUB_BRANCH\"\n"
        "fi\n"
    )
    git.chmod(git.stat().st_mode | stat.S_IEXEC)
    env = {
        **os.environ,
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "STUB_BRANCH": branch,
        "STUB_GIT_CALLS": str(calls),
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
        (
            ("commit", "fix(workflow): keep --no-verify inside the message"),
            [
                "rev-parse",
                "--show-toplevel",
                "symbolic-ref",
                "--quiet",
                "--short",
                "HEAD",
                "commit",
                "--message=fix(workflow): keep --no-verify inside the message",
                "--",
            ],
        ),
        (
            ("push",),
            [
                "rev-parse",
                "--show-toplevel",
                "symbolic-ref",
                "--quiet",
                "--short",
                "HEAD",
                "push",
                "--set-upstream",
                "origin",
                "HEAD:refs/heads/codex/test",
            ],
        ),
        (
            ("merge-main",),
            [
                "rev-parse",
                "--show-toplevel",
                "symbolic-ref",
                "--quiet",
                "--short",
                "HEAD",
                "merge",
                "origin/main",
            ],
        ),
        (
            ("branch", "codex/new-task"),
            [
                "rev-parse",
                "--show-toplevel",
                "check-ref-format",
                "--branch",
                "codex/new-task",
                "switch",
                "-c",
                "codex/new-task",
            ],
        ),
    ],
)
def test_runs_only_fixed_git_arguments(
    tmp_path: Path, args: tuple[str, ...], expected: list[str]
) -> None:
    result, calls = run_wrapper(tmp_path, *args)

    assert result.returncode == 0, result.stderr
    assert calls == expected


@pytest.mark.parametrize(
    "args",
    [
        (),
        ("commit",),
        ("commit", "safe", "--no-verify"),
        ("push", "--force"),
        ("merge-main", "--no-verify"),
        ("branch", "topic"),
        ("branch", "codex/topic", "--discard-changes"),
        ("unknown",),
    ],
)
def test_rejects_extra_flags_and_unknown_operations(
    tmp_path: Path, args: tuple[str, ...]
) -> None:
    result, calls = run_wrapper(tmp_path, *args)

    assert result.returncode == 2
    assert calls == ["rev-parse", "--show-toplevel"]


@pytest.mark.parametrize(
    "args",
    [
        ("commit", "safe"),
        ("push",),
        ("merge-main",),
    ],
)
def test_refuses_mutations_on_main(tmp_path: Path, args: tuple[str, ...]) -> None:
    result, calls = run_wrapper(tmp_path, *args, branch="main")

    assert result.returncode == 1
    assert "refuses main" in result.stderr
    assert calls == [
        "rev-parse",
        "--show-toplevel",
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
    ]
