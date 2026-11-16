"""Tests for ui-approval-scope.sh, which decides whether a PR head needs Tim's UI
approval (PP-zxlq.4): only when the PR's own UI diff (merge base with main to head,
UI paths only) is a different patch from the one at the newest earlier commit whose
UI Approval passed. Also approve-ui.sh, which records an approval on a head that
moved past the commit Tim saw when that move left the PR's own UI diff alone, and
the workflow's merge-queue path, which never waits on sign-off.
"""

import json
import os
import stat
import subprocess
from pathlib import Path

import pytest
import yaml

from scripts.tests.test_claude_review_range import (
    GIT_ENV,
    advance_main,
    commit_file,
    git,
    merge_main,
    pr_commits,
)

pytestmark = pytest.mark.integration

WORKFLOW = Path(__file__).parent.parent / "workflow"
SCOPE_SCRIPT = WORKFLOW / "ui-approval-scope.sh"
APPROVE_SCRIPT = WORKFLOW / "approve-ui.sh"
UI_APPROVAL_YAML = (
    Path(__file__).parent.parent.parent / ".github" / "workflows" / "ui-approval.yaml"
)
LINES = "".join(f"line {n}\n" for n in range(1, 8))


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


def edit_line(text: str, number: int, new: str) -> str:
    lines = text.splitlines(keepends=True)
    lines[number - 1] = new + "\n"
    return "".join(lines)


def conflicted_merge_main(repo: Path) -> None:
    """Start a merge of main that stops on a conflict, for the test to resolve."""
    result = subprocess.run(
        ["git", "merge", "-q", "--no-edit", "main"],
        cwd=repo,
        capture_output=True,
        text=True,
        env={**os.environ, **GIT_ENV},
    )
    assert result.returncode != 0, "expected the merge of main to conflict"


def finish_merge(repo: Path, resolved: dict[str, str]) -> str:
    for path, text in resolved.items():
        (repo / path).write_text(text)
    git("add", "-A", cwd=repo)
    git("commit", "-q", "--no-edit", cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


def compare(repo: Path, approved: str, head: str) -> list[str]:
    result = subprocess.run(
        ["bash", str(SCOPE_SCRIPT), "--compare", approved, head],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "CLAUDE_REVIEW_MAIN_REF": "main"},
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.splitlines()


def test_clean_main_merge_into_a_ui_file_needs_no_new_approval(
    tmp_path: Path, repo: Path
) -> None:
    """Main edits a distant line of the PR's UI file; the PR's own patch is the same."""
    advance_main(repo, "src/components/a.tsx", LINES)
    merge_main(repo)
    approved = commit_file(
        repo, "src/components/a.tsx", edit_line(LINES, 2, "line 2 pr")
    )
    git("checkout", "-q", "main", cwd=repo)
    commit_file(repo, "src/components/a.tsx", edit_line(LINES, 6, "line 6 main"))
    git("checkout", "-q", "feat", cwd=repo)
    head = merge_main(repo)
    outputs, files = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "false"
    assert outputs["last_approved"] == approved
    assert files == []
    assert compare(repo, approved, head) == []


@pytest.mark.parametrize("conflict_in", ["ui", "non-ui"])
def test_conflicted_main_merge_that_keeps_the_prs_ui_diff_needs_no_new_approval(
    tmp_path: Path, repo: Path, conflict_in: str
) -> None:
    """The case behind PP-zxlq.4's rework: a conflicted merge of main re-asked
    because the old synthetic-merge range fell back to a full diff."""
    advance_main(repo, "src/components/a.tsx", LINES)
    advance_main(repo, "package.json", LINES)
    merge_main(repo)
    commit_file(repo, "package.json", edit_line(LINES, 2, "line 2 pr"))
    approved = commit_file(
        repo, "src/components/a.tsx", edit_line(LINES, 2, "line 2 pr")
    )
    # Main changes the adjacent line, which git reports as a conflict.
    conflicted = "src/components/a.tsx" if conflict_in == "ui" else "package.json"
    advance_main(repo, conflicted, edit_line(LINES, 3, "line 3 main"))
    conflicted_merge_main(repo)
    both = edit_line(edit_line(LINES, 2, "line 2 pr"), 3, "line 3 main")
    head = finish_merge(repo, {conflicted: both})
    outputs, files = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "false", outputs["detail"]
    assert files == []
    assert compare(repo, approved, head) == []


def test_conflict_resolution_that_changes_the_prs_ui_diff_needs_approval(
    tmp_path: Path, repo: Path
) -> None:
    advance_main(repo, "src/components/a.tsx", LINES)
    merge_main(repo)
    approved = commit_file(
        repo, "src/components/a.tsx", edit_line(LINES, 2, "line 2 pr")
    )
    advance_main(repo, "src/components/a.tsx", edit_line(LINES, 3, "line 3 main"))
    conflicted_merge_main(repo)
    reworked = edit_line(edit_line(LINES, 2, "line 2 reworked"), 3, "line 3 main")
    head = finish_merge(repo, {"src/components/a.tsx": reworked})
    outputs, files = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "true"
    assert files == ["src/components/a.tsx"]
    assert compare(repo, approved, head) == ["src/components/a.tsx"]


def test_new_ui_commit_after_a_main_merge_needs_approval(
    tmp_path: Path, repo: Path
) -> None:
    approved = commit_file(repo, "src/components/a.tsx", "a\n")
    advance_main(repo, "src/lib/other.ts", "main\n")
    merge_main(repo)
    head = commit_file(repo, "src/app/(app)/m/[id]/page.tsx", "page\n")
    outputs, files = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "true"
    assert files == ["src/app/(app)/m/[id]/page.tsx"]
    assert compare(repo, approved, head) == ["src/app/(app)/m/[id]/page.tsx"]


def test_reverting_a_ui_change_back_to_the_approved_one_needs_no_approval(
    tmp_path: Path, repo: Path
) -> None:
    approved = commit_file(repo, "src/components/a.tsx", "a\n")
    commit_file(repo, "src/components/a.tsx", "a2\n")
    commit_file(repo, "src/components/a.tsx", "a\n")
    outputs, _ = scope(tmp_path, repo, approved=[approved])
    assert outputs["ui_changed"] == "false"


# --- approve-ui.sh -----------------------------------------------------------


def approve(
    tmp_path: Path, repo: Path, seen: str
) -> tuple[subprocess.CompletedProcess[str], list[dict[str, str]]]:
    """Run approve-ui.sh against a bare origin holding the PR head, with gh stubbed."""
    origin = tmp_path / "origin.git"
    if not origin.exists():
        git("init", "-q", "--bare", str(origin), cwd=tmp_path)
        git("remote", "add", "origin", str(origin), cwd=repo)
    git("push", "-qf", "origin", "main", "feat:refs/pull/7/head", cwd=repo)
    head = git("rev-parse", "feat", cwd=repo)
    # A fresh clone, as approve-ui.sh runs: only what it fetches is known.
    clone = tmp_path / f"clone-{seen[:7]}-{head[:7]}"
    git("clone", "-q", str(origin), str(clone), cwd=tmp_path)
    posts = tmp_path / "posts.jsonl"
    gh = tmp_path / "bin" / "gh"
    gh.parent.mkdir(exist_ok=True)
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys\n"
        "args = sys.argv[1:]\n"
        "if args[:2] == ['repo', 'view']:\n"
        "    print('acme/widget')\n"
        "elif args[:2] == ['pr', 'view']:\n"
        "    print(os.environ['STUB_HEAD'])\n"
        "elif args[:2] == ['run', 'list']:\n"
        "    assert os.environ['STUB_HEAD'] in args, args\n"
        "    print('99')\n"
        "elif args[0] == 'api' and '-X' not in args:\n"
        "    print('5')\n"
        "elif args[0] == 'api':\n"
        "    fields = dict(a.split('=', 1) for a in args if '=' in a)\n"
        "    with open(os.environ['STUB_POSTS'], 'a') as f:\n"
        "        f.write(json.dumps(fields) + '\\n')\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
    result = subprocess.run(
        ["bash", str(APPROVE_SCRIPT), "7", "--head", seen[:7], "--source", "chat"],
        cwd=clone,
        capture_output=True,
        text=True,
        timeout=60,
        env={
            **os.environ,
            **GIT_ENV,
            "PATH": f"{gh.parent}{os.pathsep}{os.environ['PATH']}",
            "STUB_HEAD": head,
            "STUB_POSTS": str(posts),
        },
    )
    recorded = (
        [json.loads(line) for line in posts.read_text().splitlines()]
        if posts.exists()
        else []
    )
    return result, recorded


def test_approve_ui_records_on_the_seen_head(tmp_path: Path, repo: Path) -> None:
    seen = commit_file(repo, "src/components/a.tsx", "a\n")
    result, posts = approve(tmp_path, repo, seen)
    assert result.returncode == 0, result.stderr
    assert len(posts) == 1
    assert posts[0]["comment"] == f"UI approved by Tim (chat) on {seen[:7]}."


def test_approve_ui_follows_a_merge_of_main_past_the_seen_head(
    tmp_path: Path, repo: Path
) -> None:
    """#2482's case: Tim saw 6f8be05, main was merged in, he should not approve twice."""
    advance_main(repo, "src/components/a.tsx", LINES)
    merge_main(repo)
    seen = commit_file(repo, "src/components/a.tsx", edit_line(LINES, 2, "line 2 pr"))
    advance_main(repo, "src/components/a.tsx", edit_line(LINES, 3, "line 3 main"))
    conflicted_merge_main(repo)
    both = edit_line(edit_line(LINES, 2, "line 2 pr"), 3, "line 3 main")
    head = finish_merge(repo, {"src/components/a.tsx": both})
    result, posts = approve(tmp_path, repo, seen)
    assert result.returncode == 0, result.stderr
    assert len(posts) == 1
    assert posts[0]["state"] == "approved"
    assert posts[0]["comment"] == (
        f"UI approved by Tim (chat) on {head[:7]}. He saw {seen[:7]}; "
        f"the PR's own UI changes are the same at {head[:7]}."
    )


def test_approve_ui_refuses_a_head_with_new_ui_changes(
    tmp_path: Path, repo: Path
) -> None:
    seen = commit_file(repo, "src/components/a.tsx", "a\n")
    advance_main(repo, "src/lib/other.ts", "main\n")
    merge_main(repo)
    commit_file(repo, "src/components/b.tsx", "b\n")
    result, posts = approve(tmp_path, repo, seen)
    assert result.returncode == 1
    assert posts == []
    assert "src/components/b.tsx" in result.stderr


# --- the merge queue ---------------------------------------------------------


def test_merge_queue_never_waits_on_sign_off() -> None:
    """merge_group runs (gh-readonly-queue/... commits) skip the scope job, can never
    reach the ui-approval environment, and pass the decision job up front."""
    jobs = yaml.safe_load(UI_APPROVAL_YAML.read_text("utf-8"))["jobs"]
    assert jobs["scope"]["if"] == "github.event_name == 'pull_request'"
    sign_off = jobs["sign-off"]
    assert sign_off["environment"] == "ui-approval"
    assert sign_off["if"].startswith("github.event_name == 'pull_request' && ")
    decide = jobs["ui-approval"]["steps"][-1]["run"]
    first = decide.strip().splitlines()[:3]
    assert first == [
        'if [ "$EVENT" = "merge_group" ]; then',
        '  echo "Merge queue: each PR in this group passed UI Approval on its own head."',
        "  exit 0",
    ]
