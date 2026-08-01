"""Unit tests for scripts/hooks/huddle-digest.sh (PP-llkj).

The digest answers "what kind of work is this project doing right now" at
session start, including after compaction. It is deliberately derived from the
local git object store alone — no LLM, no network, no `bd` — so these tests are
just: build a throwaway repo with known commits and branches, run the script,
assert on the rendered block.

The properties worth pinning down are the ones a reader relies on:
  - counts are honest even when the bullet list is truncated
  - dependency-bump churn collapses instead of crowding out real work
  - non-conventional and multi-scope (dependabot) subjects don't fall through
  - branch noise (trunk, dependabot, worktree-agent-*) stays out of "in flight"
  - anything unexpected degrades to empty output, never to a broken hook
"""

import datetime
import os
import subprocess
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "hooks" / "huddle-digest.sh"


def git(repo: Path, *args: str, **kwargs: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
        **kwargs,  # type: ignore[arg-type]
    )


def commit(repo: Path, subject: str, days_ago: int = 0) -> None:
    """An empty commit dated `days_ago` days back, on the current branch.

    Both author *and* committer dates are pinned: the digest filters on
    `git log --since`, which reads the committer date, while `for-each-ref`
    sorts on it too — an unpinned committer date would make every "old commit"
    test silently pass for the wrong reason.
    """
    when = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_ago)
    ).strftime("%Y-%m-%dT%H:%M:%S+0000")
    env = os.environ.copy()
    env["GIT_COMMITTER_DATE"] = when
    env["GIT_AUTHOR_DATE"] = when
    git(
        repo,
        "-c",
        "user.email=t@example.com",
        "-c",
        "user.name=T",
        "commit",
        "-q",
        "--allow-empty",
        "-m",
        subject,
        env=env,
    )


@pytest.fixture
def repo() -> Iterator[Path]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        git(root, "init", "-q", "-b", "main")
        yield root


def run(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["bash", str(SCRIPT), *args],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    return proc.stdout


# --- Degrade-to-silence paths ------------------------------------------------


def test_empty_repo_prints_nothing(repo: Path) -> None:
    assert run(repo) == ""


def test_commits_older_than_the_window_print_nothing(repo: Path) -> None:
    commit(repo, "feat(ui): ancient history", days_ago=30)
    assert run(repo) == ""


def test_outside_a_git_repo_prints_nothing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        proc = subprocess.run(
            ["bash", str(SCRIPT)], cwd=tmp, capture_output=True, text=True
        )
        assert proc.returncode == 0
        assert proc.stdout == ""


# --- Grouping and counting ---------------------------------------------------


def test_groups_commits_by_work_type(repo: Path) -> None:
    commit(repo, "feat(settings): shareable settings sets (#1730)")
    commit(repo, "fix(hooks): stop the memory gate descending into heredocs (#1755)")
    commit(repo, "refactor(agents): retire the Antigravity surface (#1761)")
    commit(repo, "docs(chores): name all 9 Supabase CLI pin sites (#1749)")
    out = run(repo)

    assert "_New capability (1)_" in out
    assert "_Fixes (1)_" in out
    assert "_Refactors (1)_" in out
    assert "_Docs & agent context (1)_" in out
    assert "shareable settings sets (#1730)" in out
    # The scope histogram names which parts of the app moved.
    assert "— settings" in out


def test_header_reports_the_true_commit_count(repo: Path) -> None:
    for i in range(5):
        commit(repo, f"fix(hooks): thing {i}")
    out = run(repo)
    assert "5 commits in the last 7 days" in out


def test_truncated_bucket_still_states_its_full_count(repo: Path) -> None:
    for i in range(12):
        commit(repo, f"fix(hooks): thing {i}")
    out = run(repo, "--max-items", "3")
    # A reader must never mistake a truncated list for a complete one.
    assert "_Fixes (12)_" in out
    assert "…and 9 more" in out


def test_budget_favours_variety_over_the_largest_bucket(repo: Path) -> None:
    """A 20-fix week must still show the feature that landed."""
    for i in range(20):
        commit(repo, f"fix(hooks): thing {i}")
    commit(repo, "feat(settings): the one feature (#1)")
    out = run(repo, "--max-items", "4")
    assert "the one feature (#1)" in out


# --- Noise collapse ----------------------------------------------------------


def test_dependency_bumps_collapse_into_one_housekeeping_line(repo: Path) -> None:
    commit(repo, "chore(deps): bump a")
    # dependabot's real-world double-scope shape — a single-scope parser drops
    # these into the catch-all bucket instead of collapsing them.
    commit(repo, "chore(deps)(deps): bump the minor-patch-updates group (#1735)")
    commit(repo, "chore(deps)(deps-dev): bump @types/node (#1716)")
    out = run(repo)

    assert "3 dependency bumps" in out
    assert "bump the minor-patch-updates group" not in out
    assert "_Fixes" not in out


def test_unconventional_subjects_are_counted_not_dropped(repo: Path) -> None:
    commit(repo, "just some freeform commit message")
    out = run(repo)
    assert "1 commits in the last 7 days" in out
    assert "1 other" in out


def test_bead_id_suffixes_are_stripped_from_titles(repo: Path) -> None:
    commit(repo, "fix(hooks): verify-guard-stack checks disk (PP-ncla) (#1756)")
    out = run(repo)
    assert "verify-guard-stack checks disk (#1756)" in out
    assert "PP-ncla" not in out


# --- In-flight branches ------------------------------------------------------


def _remote_branch(repo: Path, name: str, subject: str) -> None:
    """Fabricate a remote-tracking ref without needing a real remote."""
    git(repo, "checkout", "-q", "-b", name)
    commit(repo, subject)
    sha = git(repo, "rev-parse", "HEAD").stdout.strip()
    git(repo, "update-ref", f"refs/remotes/origin/{name}", sha)
    git(repo, "checkout", "-q", "main")
    git(repo, "branch", "-q", "-D", name)


def test_in_flight_lists_recent_remote_branches(repo: Path) -> None:
    commit(repo, "fix(hooks): base")
    _remote_branch(repo, "feat/machine-edit-page", "feat(ui): the edit page")
    out = run(repo)
    assert "**In flight" in out
    assert "`feat/machine-edit-page`" in out
    assert "the edit page" in out


def test_in_flight_excludes_trunk_and_bot_branches(repo: Path) -> None:
    commit(repo, "fix(hooks): base")
    sha = git(repo, "rev-parse", "HEAD").stdout.strip()
    git(repo, "update-ref", "refs/remotes/origin/main", sha)
    _remote_branch(repo, "dependabot/npm_and_yarn/main/tiptap", "chore(deps): bump")
    _remote_branch(repo, "worktree-agent-abc123", "wip")
    _remote_branch(repo, "pr-screenshots", "PR #1762 @ 8d507d45")
    _remote_branch(repo, "feat/real-work", "feat(ui): real work")

    out = run(repo)
    assert "`feat/real-work`" in out
    assert "dependabot/" not in out
    assert "worktree-agent-" not in out
    assert "pr-screenshots" not in out
    assert "`main`" not in out.split("**In flight", 1)[1]


def test_no_branches_flag_suppresses_the_section(repo: Path) -> None:
    commit(repo, "fix(hooks): base")
    _remote_branch(repo, "feat/machine-edit-page", "feat(ui): the edit page")
    out = run(repo, "--no-branches")
    assert "**In flight" not in out
    assert "Merged to" in out
