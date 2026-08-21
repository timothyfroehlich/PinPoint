"""Unit tests for scripts/workflow/review-preflight.sh.

The script exists because `/codex:review` reviews local git state and has no idea which
PR you meant. Every failure it catches is silent in the same way: the review runs, finds
nothing, and a clean-looking result gets attested against a commit Codex never read.

So the tests are about refusing to print the command. A preflight that prints
`/codex:review` next to a "NOT READY" block is worse than no preflight, because the
command is the only line anyone copies.

Each test drives the real bash against a real temporary git repository and a stubbed
`gh`, so the branch/HEAD/diff plumbing is exercised rather than mocked away.
"""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "workflow" / "review-preflight.sh"

PR = 123
BRANCH = "feat/thing-PP-abcd"

GIT_ENV = {
    "GIT_AUTHOR_NAME": "Test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "Test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
}


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        env={**os.environ, **GIT_ENV},
        timeout=60,
        check=True,
    )
    return result.stdout.strip()


@contextmanager
def preflight(
    *,
    branch_commit: bool = True,
    on_branch: bool = True,
    pushed_head: str | None = None,
    dirty: bool = False,
    state: str = "OPEN",
) -> Iterator[subprocess.CompletedProcess[str]]:
    """Run the preflight against a repo built to the described shape.

    `pushed_head` is what the stubbed GitHub claims the PR's head is; None means "match
    whatever the local HEAD turns out to be", since commit SHAs depend on commit time
    and a hard-coded one would be a different commit on every run.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        repo = tmp_path / "repo"
        repo.mkdir()

        git("init", "-q", "-b", "main", cwd=repo)
        (repo / "README.md").write_text("base\n")
        git("add", "-A", cwd=repo)
        git("commit", "-qm", "base", cwd=repo)

        git("checkout", "-qb", BRANCH, cwd=repo)
        if branch_commit:
            (repo / "src.ts").write_text("x\n")
            git("add", "-A", cwd=repo)
            git("commit", "-qm", "work", cwd=repo)

        local_head = git("rev-parse", "HEAD", cwd=repo)

        if not on_branch:
            git("checkout", "-q", "main", cwd=repo)
        if dirty:
            (repo / "scratch.txt").write_text("uncommitted\n")

        meta = {
            "headRefName": BRANCH,
            "headRefOid": pushed_head or local_head,
            "state": state,
        }
        (tmp_path / "meta.json").write_text(json.dumps(meta))

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"pr view"*) jq -r "[.headRefName, .headRefOid, .state] | @tsv" "$STUB_META" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        yield subprocess.run(
            ["bash", str(SCRIPT), str(PR)],
            cwd=repo,
            capture_output=True,
            text=True,
            env={
                **os.environ,
                **GIT_ENV,
                "PATH": f"{tmp}{os.pathsep}{os.environ.get('PATH', '')}",
                "STUB_META": str(tmp_path / "meta.json"),
            },
            timeout=120,
        )


def test_a_ready_branch_prints_the_review_and_attest_commands() -> None:
    with preflight() as run:
        assert run.returncode == 0, run.stdout + run.stderr
        assert "READY" in run.stdout
        assert "/codex:review --base main" in run.stdout
        assert f"mark-review.sh {PR} codex-plugin-cc base-main" in run.stdout


@pytest.mark.parametrize(
    "kwargs,expected",
    [
        pytest.param({"on_branch": False}, f"not '{BRANCH}'", id="wrong-branch"),
        pytest.param(
            {"pushed_head": "0" * 40}, "is not the pushed head", id="head-not-pushed"
        ),
        pytest.param({"dirty": True}, "working tree is dirty", id="dirty-tree"),
        pytest.param(
            {"branch_commit": False},
            "would find nothing and read as clean",
            id="empty-diff",
        ),
        pytest.param({"state": "MERGED"}, "not open", id="pr-not-open"),
    ],
)
def test_each_way_the_review_would_miss_the_diff_blocks(
    kwargs: dict[str, object], expected: str
) -> None:
    """Every one of these produces a review that looks fine and covers nothing."""
    with preflight(**kwargs) as run:  # type: ignore[arg-type]
        assert run.returncode == 1, run.stdout
        assert "NOT READY" in run.stdout
        assert expected in run.stdout


@pytest.mark.parametrize(
    "kwargs",
    [
        pytest.param({"on_branch": False}, id="wrong-branch"),
        pytest.param({"branch_commit": False}, id="empty-diff"),
        pytest.param({"dirty": True}, id="dirty-tree"),
    ],
)
def test_a_blocked_preflight_never_prints_the_review_command(
    kwargs: dict[str, object],
) -> None:
    """The command is the only line anyone copies.

    Printing it under a NOT READY header is how a preflight becomes worse than none —
    the reader takes the command and leaves the reasons on the screen.
    """
    with preflight(**kwargs) as run:  # type: ignore[arg-type]
        assert "/codex:review" not in run.stdout, run.stdout
        assert "mark-review.sh" not in run.stdout, run.stdout


def test_the_wrong_branch_says_whether_a_worktree_has_it() -> None:
    """Wrong place is half an answer; the other half is one `git worktree list` away."""
    with preflight(on_branch=False) as run:
        assert "no worktree has it checked out" in run.stdout, run.stdout


def test_a_non_numeric_pr_is_a_usage_error() -> None:
    result = subprocess.run(
        ["bash", str(SCRIPT), "not-a-number"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 2
    assert "usage:" in result.stderr


def test_a_base_argument_is_refused_rather_than_ignored() -> None:
    """The base is `main` and is not a parameter.

    It briefly was, and the printed attestation followed it — `mark-review.sh` accepts
    only `codex-plugin-cc base-main`, so any other base produced a READY handoff to a
    command that exits 2. Ignoring the argument instead would review against `main`
    while the caller believed otherwise, which is the same looks-fine-covers-nothing
    shape this script exists to catch.
    """
    result = subprocess.run(
        ["bash", str(SCRIPT), str(PR), "develop"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 2
    assert "the base is always 'main'" in result.stderr


def test_the_printed_attestation_is_a_pair_mark_review_accepts() -> None:
    """The two scripts have to agree on the vocabulary, so pin them together.

    This is the coupling the Codex review of #1931 found broken: the preflight built
    the detail string from its own input and never checked it against the marker's
    allowlist.
    """
    marker = SCRIPT.parent / "mark-review.sh"
    with preflight() as run:
        assert "codex-plugin-cc base-main" in run.stdout, run.stdout
    assert "codex-plugin-cc:base-main)" in marker.read_text()
