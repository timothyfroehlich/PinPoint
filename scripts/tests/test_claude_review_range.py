"""Tests for claude-review-range.sh, which picks what the Claude Review CI job reviews
(PP-zxlq.1): the whole PR, only the commits since the last successful run with
main's changes left out, or nothing when those commits add nothing beyond main.
"""

import os
import stat
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

WORKFLOW = Path(__file__).parent.parent / "workflow"
RANGE_SCRIPT = WORKFLOW / "claude-review-range.sh"
LEVEL_SCRIPT = WORKFLOW / "claude-review-level.sh"

GIT_ENV = {
    "GIT_AUTHOR_NAME": "t",
    "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t",
    "GIT_COMMITTER_EMAIL": "t@example.com",
}


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, **GIT_ENV},
    ).stdout.strip()


def commit_file(repo: Path, path: str, text: str, message: str = "change") -> str:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    git("add", "-A", cwd=repo)
    git("commit", "-qm", message, cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-q", "-b", "main", cwd=repo)
    commit_file(repo, "README.md", "base\n", "base")
    git("checkout", "-qb", "feat", cwd=repo)
    return repo


def advance_main(repo: Path, path: str, text: str) -> str:
    git("checkout", "-q", "main", cwd=repo)
    sha = commit_file(repo, path, text, "main change")
    git("checkout", "-q", "feat", cwd=repo)
    return sha


def merge_main(repo: Path) -> str:
    git("merge", "-q", "--no-edit", "main", cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


def pr_commits(repo: Path) -> list[str]:
    """The PR's commits as GitHub lists them: on the branch, not on main, oldest first."""
    return git("rev-list", "--reverse", "main..feat", cwd=repo).splitlines()


def plan(tmp_path: Path, repo: Path, reviewed: list[str]) -> tuple[dict[str, str], str]:
    gh = tmp_path / "gh"
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, subprocess, sys\n"
        "args = sys.argv[1:]\n"
        "path = next(a for a in args if a.startswith('repos/'))\n"
        "if '/pulls/7/commits' in path:\n"
        "    print(os.environ['STUB_COMMITS'])\n"
        "elif '/check-runs' in path:\n"
        "    sha = path.split('/commits/')[1].split('/')[0]\n"
        "    runs = [{'conclusion': 'success', 'app': {'slug': app}}\n"
        "            for entry in os.environ['STUB_REVIEWED'].split(',') if entry\n"
        "            for app_sha, _, app in [entry.partition(':')] if app_sha == sha]\n"
        "    jq = args[args.index('--jq') + 1]\n"
        "    out = subprocess.run(['jq', '-r', jq], input=json.dumps({'check_runs': runs}),\n"
        "                         capture_output=True, text=True, check=True).stdout\n"
        "    print(out, end='')\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
    output = tmp_path / "github_output"
    head = git("rev-parse", "HEAD", cwd=repo)
    result = subprocess.run(
        ["bash", str(RANGE_SCRIPT), "7", head],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
        env={
            **os.environ,
            "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
            "GITHUB_REPOSITORY": "acme/widget",
            "GITHUB_OUTPUT": str(output),
            "CLAUDE_REVIEW_MAIN_REF": "main",
            "STUB_COMMITS": "\n".join(pr_commits(repo)),
            "STUB_REVIEWED": ",".join(
                r if ":" in r else f"{r}:github-actions" for r in reviewed
            ),
        },
    )
    assert result.returncode == 0, result.stderr
    outputs = dict(line.split("=", 1) for line in result.stdout.splitlines())
    assert output.read_text() == result.stdout
    return outputs, head


def changed_files(repo: Path, base: str, head: str) -> list[str]:
    return git("diff", "--name-only", base, head, cwd=repo).splitlines()


def test_first_review_covers_the_whole_pr(tmp_path: Path, repo: Path) -> None:
    commit_file(repo, "src/a.ts", "a\n")
    commit_file(repo, "src/b.ts", "b\n")
    outputs, head = plan(tmp_path, repo, reviewed=[])
    assert outputs["mode"] == "full"
    assert outputs["last_reviewed"] == ""
    assert changed_files(repo, outputs["base"], head) == ["src/a.ts", "src/b.ts"]


def test_later_push_reviews_only_the_new_commits(tmp_path: Path, repo: Path) -> None:
    reviewed = commit_file(repo, "src/a.ts", "a\n")
    commit_file(repo, "src/b.ts", "b\n")
    outputs, head = plan(tmp_path, repo, reviewed=[reviewed])
    assert outputs["mode"] == "incremental"
    assert outputs["last_reviewed"] == reviewed
    assert changed_files(repo, outputs["base"], head) == ["src/b.ts"]


def test_newest_reviewed_commit_wins(tmp_path: Path, repo: Path) -> None:
    first = commit_file(repo, "src/a.ts", "a\n")
    second = commit_file(repo, "src/b.ts", "b\n")
    commit_file(repo, "src/c.ts", "c\n")
    outputs, _ = plan(tmp_path, repo, reviewed=[first, second])
    assert outputs["last_reviewed"] == second


def test_clean_merge_of_main_needs_no_review(tmp_path: Path, repo: Path) -> None:
    reviewed = commit_file(repo, "src/a.ts", "a\n")
    advance_main(repo, "src/main.ts", "main\n")
    merge_main(repo)
    outputs, _ = plan(tmp_path, repo, reviewed=[reviewed])
    assert outputs["mode"] == "skip"
    assert outputs["base"] == ""


def test_main_changes_are_left_out_of_an_incremental_review(
    tmp_path: Path, repo: Path
) -> None:
    reviewed = commit_file(repo, "src/a.ts", "a\n")
    advance_main(repo, "src/main.ts", "main\n")
    merge_main(repo)
    commit_file(repo, "src/b.ts", "b\n")
    outputs, head = plan(tmp_path, repo, reviewed=[reviewed])
    assert outputs["mode"] == "incremental"
    assert changed_files(repo, outputs["base"], head) == ["src/b.ts"]


def test_conflict_resolution_in_a_main_merge_is_reviewed(
    tmp_path: Path, repo: Path
) -> None:
    reviewed = commit_file(repo, "README.md", "branch\n")
    advance_main(repo, "README.md", "main\n")
    subprocess.run(
        ["git", "merge", "-q", "main"],
        cwd=repo,
        capture_output=True,
        env={**os.environ, **GIT_ENV},
    )
    (repo / "README.md").write_text("resolved\n")
    git("add", "README.md", cwd=repo)
    git("commit", "-qm", "merge main", cwd=repo)
    outputs, head = plan(tmp_path, repo, reviewed=[reviewed])
    assert outputs["mode"] == "full"
    assert changed_files(repo, outputs["base"], head) == ["README.md"]


def test_reviewed_head_itself_is_not_its_own_baseline(
    tmp_path: Path, repo: Path
) -> None:
    head = commit_file(repo, "src/a.ts", "a\n")
    outputs, _ = plan(tmp_path, repo, reviewed=[head])
    assert outputs["mode"] == "full"


def test_level_from_sizes_the_exact_diff(repo: Path) -> None:
    base = commit_file(repo, "src/a.ts", "".join(f"{i}\n" for i in range(2000)))
    commit_file(repo, "src/b.ts", "".join(f"{i}\n" for i in range(10)))
    result = subprocess.run(
        ["bash", str(LEVEL_SCRIPT), "--from", base],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines()[0] == "low"


def test_check_runs_from_other_apps_do_not_count(tmp_path: Path, repo: Path) -> None:
    other = commit_file(repo, "src/a.ts", "a\n")
    commit_file(repo, "src/b.ts", "b\n")
    outputs, _ = plan(tmp_path, repo, reviewed=[f"{other}:some-other-app"])
    assert outputs["mode"] == "full"
    assert outputs["last_reviewed"] == ""
