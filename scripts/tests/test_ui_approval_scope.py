"""Tests for ui-approval-scope.sh, which decides whether a PR head needs Tim's UI
approval (PP-zxlq.4): only when a UI path changed since the newest earlier commit
whose UI Approval passed, with main's changes left out.
"""

import os
import stat
import subprocess
from pathlib import Path

import pytest

from scripts.tests.test_claude_review_range import (
    advance_main,
    commit_file,
    git,
    merge_main,
    pr_commits,
)

pytestmark = pytest.mark.integration

SCOPE_SCRIPT = Path(__file__).parent.parent / "workflow" / "ui-approval-scope.sh"


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-q", "-b", "main", cwd=repo)
    commit_file(repo, "README.md", "base\n", "base")
    git("checkout", "-qb", "feat", cwd=repo)
    return repo


def scope(
    tmp_path: Path, repo: Path, approved: list[str]
) -> tuple[dict[str, str], list[str]]:
    gh = tmp_path / "gh"
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, subprocess, sys\n"
        "args = sys.argv[1:]\n"
        "path = next(a for a in args if a.startswith('repos/'))\n"
        "if '/pulls/7/commits' in path:\n"
        "    print(os.environ['STUB_COMMITS'])\n"
        "elif '/check-runs' in path:\n"
        "    assert 'check_name=UI%20Approval' in path, path\n"
        "    sha = path.split('/commits/')[1].split('/')[0]\n"
        "    runs = [{'conclusion': 'success', 'app': {'slug': 'github-actions'}}\n"
        "            for s in os.environ['STUB_APPROVED'].split(',') if s == sha]\n"
        "    jq = args[args.index('--jq') + 1]\n"
        "    out = subprocess.run(['jq', '-r', jq], input=json.dumps({'check_runs': runs}),\n"
        "                         capture_output=True, text=True, check=True).stdout\n"
        "    print(out, end='')\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
    files = tmp_path / "ui-files.txt"
    head = git("rev-parse", "HEAD", cwd=repo)
    result = subprocess.run(
        ["bash", str(SCOPE_SCRIPT), "7", head],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
        env={
            **os.environ,
            "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
            "GITHUB_REPOSITORY": "acme/widget",
            "CLAUDE_REVIEW_MAIN_REF": "main",
            "UI_APPROVAL_FILES": str(files),
            "STUB_COMMITS": "\n".join(pr_commits(repo)),
            "STUB_APPROVED": ",".join(approved),
        },
    )
    assert result.returncode == 0, result.stderr
    outputs = dict(line.split("=", 1) for line in result.stdout.splitlines())
    return outputs, files.read_text().splitlines()


def test_pr_without_ui_changes_needs_no_approval(tmp_path: Path, repo: Path) -> None:
    commit_file(repo, "src/lib/math.ts", "x\n")
    commit_file(repo, "docs/notes.md", "y\n")
    outputs, files = scope(tmp_path, repo, approved=[])
    assert outputs["ui_changed"] == "false"
    assert files == []


@pytest.mark.parametrize(
    "path",
    [
        "src/app/(app)/m/page.tsx",
        "src/components/ui/button.tsx",
        "src/app/globals.css",
        "src/styles/theme.css",
        "tailwind.config.ts",
        "src/lib/design-tokens.ts",
    ],
)
def test_each_ui_path_needs_approval(tmp_path: Path, repo: Path, path: str) -> None:
    commit_file(repo, path, "x\n")
    outputs, files = scope(tmp_path, repo, approved=[])
    assert outputs["ui_changed"] == "true"
    assert files == [path]


def test_approval_carries_across_non_ui_commits(tmp_path: Path, repo: Path) -> None:
    approved = commit_file(repo, "src/components/a.tsx", "a\n")
    commit_file(repo, "e2e/full/a.spec.ts", "test\n")
    outputs, _ = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "false"
    assert outputs["last_approved"] == approved


def test_ui_change_after_approval_needs_approval_again(
    tmp_path: Path, repo: Path
) -> None:
    approved = commit_file(repo, "src/components/a.tsx", "a\n")
    commit_file(repo, "src/components/a.tsx", "a2\n")
    outputs, files = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "true"
    assert files == ["src/components/a.tsx"]


def test_ui_changes_from_main_do_not_need_approval(tmp_path: Path, repo: Path) -> None:
    approved = commit_file(repo, "src/components/a.tsx", "a\n")
    advance_main(repo, "src/components/other.tsx", "main\n")
    merge_main(repo)
    outputs, _ = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "false"
