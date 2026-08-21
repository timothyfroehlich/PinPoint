"""Unit tests for scripts/workflow/review-preflight.sh.

The script exists because both reviewers Tim runs — `/codex:review` and the built-in
`/code-review` — read local git state and have no idea which PR you meant. Every failure
it catches is silent in the same way: the review runs, finds nothing, and a clean-looking
result gets attested against a commit nobody read.

So the tests are about refusing to print the commands. A preflight that prints a review
command next to a "NOT READY" block is worse than no preflight, because the command is
the only line anyone copies.

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
    base_branch: str = "main",
    stale_base: bool = False,
) -> Iterator[subprocess.CompletedProcess[str]]:
    """Run the preflight against a repo built to the described shape.

    `pushed_head` is what the stubbed GitHub claims the PR's head is; None means "match
    whatever the local HEAD turns out to be", since commit SHAs depend on commit time
    and a hard-coded one would be a different commit on every run.

    `origin/main` is written as a real remote-tracking ref rather than by configuring a
    remote, so no test reaches the network. `stale_base` advances it past local `main`,
    which is the routine state of any repo following AGENTS.md 5 -- merging `origin/main`
    into a feature branch never moves the local `main` it merged from.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        repo = tmp_path / "repo"
        repo.mkdir()

        git("init", "-q", "-b", "main", cwd=repo)
        (repo / "README.md").write_text("base\n")
        git("add", "-A", cwd=repo)
        git("commit", "-qm", "base", cwd=repo)
        git("update-ref", "refs/remotes/origin/main", "main", cwd=repo)

        git("checkout", "-qb", BRANCH, cwd=repo)
        if branch_commit:
            (repo / "src.ts").write_text("x\n")
            git("add", "-A", cwd=repo)
            git("commit", "-qm", "work", cwd=repo)

        local_head = git("rev-parse", "HEAD", cwd=repo)

        if stale_base:
            # A peer's work landed on the remote; local `main` never followed.
            git("checkout", "-q", "main", cwd=repo)
            (repo / "peer.ts").write_text("landed elsewhere\n")
            git("add", "-A", cwd=repo)
            git("commit", "-qm", "peer work", cwd=repo)
            git("update-ref", "refs/remotes/origin/main", "main", cwd=repo)
            git("reset", "-q", "--hard", "HEAD~1", cwd=repo)
            git("checkout", "-q", BRANCH, cwd=repo)

        if not on_branch:
            git("checkout", "-q", "main", cwd=repo)
        if dirty:
            (repo / "scratch.txt").write_text("uncommitted\n")

        meta = {
            "headRefName": BRANCH,
            "headRefOid": pushed_head or local_head,
            "state": state,
            "baseRefName": base_branch,
        }
        (tmp_path / "meta.json").write_text(json.dumps(meta))

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"pr view"*) jq -r "[.headRefName, .headRefOid, .state, .baseRefName] | @tsv" "$STUB_META" ;;\n'
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
    """Both reviewers, and the attestation pair for each.

    Tim picks which one he runs, and the preflight has no way to know in advance — so it
    hands over both rather than guessing and being wrong half the time.
    """
    with preflight() as run:
        assert run.returncode == 0, run.stdout + run.stderr
        assert "READY" in run.stdout
        assert "/codex:review" in run.stdout
        assert "/code-review" in run.stdout
        assert "--base" not in run.stdout
        assert f"mark-review.sh {PR} codex-plugin-cc base-main" in run.stdout
        assert f"mark-review.sh {PR} claude-code <depth>" in run.stdout


def test_each_review_command_sits_alone_on_its_line() -> None:
    """Tim copies a command by triple-clicking, which takes the whole line.

    A command sharing its line with a label, indentation or a trailing period pastes all
    of that into the prompt and stops being a working slash command.
    """
    with preflight() as run:
        lines = run.stdout.splitlines()
    assert "/codex:review" in lines, run.stdout
    assert "/code-review" in lines, run.stdout


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
        pytest.param({"stale_base": True}, "behind 'origin/main'", id="stale-base"),
        pytest.param(
            {"base_branch": "release/2.0"},
            "targets 'release/2.0'",
            id="pr-not-based-on-main",
        ),
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
        pytest.param({"stale_base": True}, id="stale-base"),
        pytest.param({"base_branch": "release/2.0"}, id="pr-not-based-on-main"),
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
        assert "/code-review" not in run.stdout, run.stdout
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

    The Codex pair is a literal on both sides. The Claude one cannot be — its detail is
    the `/code-review` depth Tim chose, so the preflight prints a `<depth>` placeholder.
    What is pinned there instead is that the marker still accepts a `claude-code:` detail
    at all, which is what makes the printed line completable.
    """
    marker = (SCRIPT.parent / "mark-review.sh").read_text()
    with preflight() as run:
        assert "codex-plugin-cc base-main" in run.stdout, run.stdout
        assert "claude-code <depth>" in run.stdout, run.stdout
    assert "codex-plugin-cc:base-main)" in marker
    assert "claude-code:medium" in marker


# --- The retired wrapper ------------------------------------------------------------

WRAPPER = "mark-claude-review"

# Live instruction surfaces only. `docs/superpowers/**` and `docs/plans/**` are dated
# records of what was true when they were written (AGENTS.md §8) and keep their
# references; a repo-wide grep would need an exclusion list that ages badly.
INSTRUCTION_FILES = [
    ".claude/settings.json",
    "CLAUDE.md",
    "AGENTS.md",
    "scripts/workflow/AGENTS.md",
]

REPO_ROOT = SCRIPT.parent.parent.parent


def test_the_claude_wrapper_script_is_gone() -> None:
    """`mark-review.sh` is the single entrypoint; the wrapper was a migration step."""
    assert not (SCRIPT.parent / "mark-claude-review.sh").exists()


@pytest.mark.parametrize("relpath", INSTRUCTION_FILES)
def test_no_live_instruction_file_still_points_at_the_wrapper(relpath: str) -> None:
    """A deleted script named in a startup-loaded instruction file is worse than a stale
    doc: the agent runs it, gets `No such file`, and the attestation step has no path
    forward. `CLAUDE.md` naming it is exactly the defect the Codex review of #1931 found.

    `.claude/settings.json` is here for a different reason — a `permissions.allow` entry
    for a command that cannot run is dead config that outlives everyone's memory of it.
    """
    assert WRAPPER not in (REPO_ROOT / relpath).read_text()


# --- The base ref the reviewer actually resolves ------------------------------------


def test_a_stale_local_main_blocks_and_names_the_worktree_to_fix_it() -> None:
    """The check is on LOCAL `main`, and that is not an oversight.

    `/codex:review` resolves its base through the plugin's `detectDefaultBranch`, which
    reads `refs/remotes/origin/HEAD` and then strips the `refs/remotes/origin/` prefix,
    returning the bare name — so git resolves it as the local branch. Measuring anything
    else would check a ref the reviewer never looks at.

    Local `main` goes stale as a matter of routine, because AGENTS.md 5 says sync with
    `git fetch origin && git merge origin/main`, which advances the feature branch and
    never the `main` it merged from. On PR #1931 that inflated the reviewed diff from the
    PR's 22 files to 34 — twelve files of a peer's already-merged work.
    """
    with preflight(stale_base=True) as run:
        assert run.returncode == 1, run.stdout
        assert "behind 'origin/main'" in run.stdout, run.stdout
        # A branch checked out in another worktree cannot be fast-forwarded from here, so
        # the remedy has to name a directory rather than print a bare fetch.
        assert "pull --ff-only" in run.stdout or "fetch origin main:main" in run.stdout


def test_a_pr_based_on_another_branch_is_refused() -> None:
    """`base-main` is a claim about scope, and this is the only place it can be checked.

    Nothing downstream re-derives the base: `mark-review.sh` takes the pair as given and
    `merge-handoff.sh` renders it back verbatim. A PR based elsewhere would otherwise
    collect a marker asserting a diff against `main` that nobody produced.
    """
    with preflight(base_branch="release/2.0") as run:
        assert run.returncode == 1, run.stdout
        assert "targets 'release/2.0'" in run.stdout, run.stdout
