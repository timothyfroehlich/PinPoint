"""Tests for the local Claude review helpers (spec pr-lifecycle-monitoring §8.14–8.20).

claude-review-level.sh picks the /code-review level from the weighted diff size;
record-claude-review.sh posts the review record the merge gate counts as coverage.
"""

import json
import os
import stat
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

WORKFLOW = Path(__file__).parent.parent / "workflow"
LEVEL_SCRIPT = WORKFLOW / "claude-review-level.sh"
RECORD_SCRIPT = WORKFLOW / "record-claude-review.sh"


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@example.com",
        },
    ).stdout.strip()


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-q", "-b", "main", cwd=repo)
    (repo / "README.md").write_text("base\n")
    git("add", "-A", cwd=repo)
    git("commit", "-qm", "base", cwd=repo)
    git("checkout", "-qb", "feat", cwd=repo)
    return repo


def commit_lines(repo: Path, files: dict[str, int], message: str = "change") -> str:
    for path, count in files.items():
        target = repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("".join(f"line {i}\n" for i in range(count)))
    git("add", "-A", cwd=repo)
    git("commit", "-qm", message, cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


def level(repo: Path) -> list[str]:
    result = subprocess.run(
        ["bash", str(LEVEL_SCRIPT), "main"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.splitlines()


# ---------------------------------------------------------------------------------
# claude-review-level.sh
# ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("code_lines", "expected"),
    [
        (49, "low"),
        (50, "medium"),
        (1499, "medium"),
        (1500, "high"),
        (3000, "high"),
        (3001, "ask"),
    ],
)
def test_level_bands_are_exclusive(
    tmp_path: Path, code_lines: int, expected: str
) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": code_lines})
    assert level(repo)[0] == expected


def test_tests_count_at_half_weight(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(
        repo,
        {
            "src/app.ts": 20,
            "src/app.test.ts": 40,
            "e2e/smoke/page.spec.ts": 20,
            "scripts/tests/test_x.py": 20,
        },
    )
    word, detail = level(repo)
    assert word == "medium"
    assert detail.startswith("weighted 60 lines: code 20, tests 80 at half weight")


def test_generated_fixture_and_spec_files_are_left_out(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(
        repo,
        {
            "pnpm-lock.yaml": 5000,
            "drizzle/meta/0099_snapshot.json": 3000,
            "src/lib/pinballmap/fixtures/region.json": 4000,
            "eslint-rules/__fixtures__/case.ts": 500,
            "docs/feature-specs/thing.md": 900,
            "src/app.ts": 10,
        },
    )
    word, detail = level(repo)
    assert word == "low"
    assert (
        detail == "weighted 10 lines: code 10, tests 0 at half weight, 13400 left out"
    )


def test_binary_files_drop_out(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    (repo / "logo.png").write_bytes(bytes(range(256)) * 50)
    git("add", "-A", cwd=repo)
    git("commit", "-qm", "binary", cwd=repo)
    assert level(repo)[0] == "low"


# ---------------------------------------------------------------------------------
# record-claude-review.sh
# ---------------------------------------------------------------------------------


def run_record(
    tmp_path: Path,
    repo: Path,
    findings: object,
    *,
    level_arg: str = "medium",
    pr_head: str | None = None,
    draft: bool = True,
    state: str = "OPEN",
    actor: str = "acme",
    comments: list[dict] | None = None,
    dry_run: bool = False,
) -> tuple[subprocess.CompletedProcess[str], list[str], list[str]]:
    posts = tmp_path / "posts.jsonl"
    calls = tmp_path / "calls.txt"
    gh = tmp_path / "gh"
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys\n"
        "args = sys.argv[1:]\n"
        "with open(os.environ['STUB_CALLS'], 'a') as log:\n"
        "    log.write(' '.join(args) + '\\n')\n"
        "if args[:2] == ['repo', 'view']:\n"
        "    print('acme/widget')\n"
        "elif args[:2] == ['api', 'user']:\n"
        "    print(os.environ['STUB_ACTOR'])\n"
        "elif args[:2] == ['pr', 'view'] and 'headRefOid,isDraft,state' in args:\n"
        "    print(os.environ['STUB_METADATA'])\n"
        "elif args[:2] == ['pr', 'view'] and '--jq' in args and '.headRefOid' in args:\n"
        "    print(json.loads(os.environ['STUB_METADATA'])['headRefOid'])\n"
        "elif args[:2] == ['pr', 'view'] and 'baseRefName' in args:\n"
        "    print(json.dumps({'baseRefName': 'main'}))\n"
        "elif args[:2] == ['pr', 'ready']:\n"
        "    print('marked ready')\n"
        "elif args[:2] == ['api', 'graphql']:\n"
        "    print(json.dumps({'data': {'repository': {'pullRequest': {'reviewThreads': "
        "{'pageInfo': {'hasNextPage': False, 'endCursor': None}, 'nodes': []}}}}}))\n"
        "elif any('/pulls/' in arg and '/reviews' in arg for arg in args):\n"
        "    print('[]')\n"
        "elif '--method' in args and 'POST' in args:\n"
        "    body = next(arg for arg in args if arg.startswith('body='))[5:]\n"
        "    with open(os.environ['STUB_POSTS'], 'a') as output:\n"
        "        output.write(json.dumps(body) + '\\n')\n"
        "    print('https://github.example/record')\n"
        "elif any('/issues/' in arg and '/comments' in arg for arg in args):\n"
        "    print(os.environ['STUB_COMMENTS'])\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
    findings_path = tmp_path / "findings.json"
    findings_path.write_text(
        findings if isinstance(findings, str) else json.dumps(findings)
    )
    head = git("rev-parse", "HEAD", cwd=repo)
    env = {
        **os.environ,
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "STUB_ACTOR": actor,
        "STUB_METADATA": json.dumps(
            {"headRefOid": pr_head or head, "isDraft": draft, "state": state}
        ),
        "STUB_COMMENTS": json.dumps(comments or []),
        "STUB_POSTS": str(posts),
        "STUB_CALLS": str(calls),
    }
    args = [
        "bash",
        str(RECORD_SCRIPT),
        "123",
        "--level",
        level_arg,
        "--findings",
        str(findings_path),
    ]
    if dry_run:
        args.append("--dry-run")
    result = subprocess.run(
        args, cwd=repo, capture_output=True, text=True, env=env, timeout=60
    )
    posted = (
        [json.loads(line) for line in posts.read_text().splitlines()]
        if posts.exists()
        else []
    )
    call_lines = calls.read_text().splitlines() if calls.exists() else []
    return result, posted, call_lines


def test_clean_review_posts_a_pinned_record_and_promotes_the_draft(
    tmp_path: Path,
) -> None:
    repo = make_repo(tmp_path)
    head = commit_lines(repo, {"src/app.ts": 5})
    result, posted, calls = run_record(tmp_path, repo, [])
    assert result.returncode == 0, result.stderr
    assert len(posted) == 1
    body = posted[0]
    assert body.startswith(f"<!-- pinpoint-claude-review: {head} level=medium -->\n")
    assert "No findings." in body
    assert "pr ready 123" in calls


def test_record_lists_every_finding_with_its_disposition(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    fix = commit_lines(repo, {"src/app.ts": 5}, "fix")
    commit_lines(repo, {"src/other.ts": 3}, "more")
    findings = [
        {
            "round": 2,
            "file": "src/b.ts",
            "line": 4,
            "summary": "a | pipe",
            "disposition": "declined",
            "reason": "out of scope",
        },
        {
            "round": 1,
            "file": "src/a.ts",
            "line": 12,
            "summary": "null deref",
            "disposition": "fixed",
            "commit": fix,
        },
    ]
    result, posted, _ = run_record(tmp_path, repo, findings, draft=False)
    assert result.returncode == 0, result.stderr
    body = posted[0]
    assert "2 findings: 1 fixed, 1 declined." in body
    rows = [
        line
        for line in body.splitlines()
        if line.startswith("| 1 ") or line.startswith("| 2 ")
    ]
    assert rows == [
        f"| 1 | `src/a.ts:12` — null deref | Fixed in {fix[:7]} |",
        "| 2 | `src/b.ts:4` — a \\| pipe | Declined: out of scope |",
    ]


def test_ready_pr_is_not_promoted_again(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, _, calls = run_record(tmp_path, repo, [], draft=False)
    assert result.returncode == 0, result.stderr
    assert not any(call.startswith("pr ready") for call in calls)


def test_dry_run_prints_the_record_without_posting(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    head = commit_lines(repo, {"src/app.ts": 5})
    result, posted, calls = run_record(
        tmp_path, repo, [], level_arg="low", dry_run=True
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.startswith(
        f"<!-- pinpoint-claude-review: {head} level=low -->"
    )
    assert posted == []
    assert not any(call.startswith("pr ready") for call in calls)


@pytest.mark.parametrize(
    ("findings", "message"),
    [
        pytest.param(
            [{"round": 1, "file": "a", "summary": "s", "disposition": "fixed"}],
            "finding 1 is fixed but names no commit",
            id="fixed-without-commit",
        ),
        pytest.param(
            [
                {
                    "round": 1,
                    "file": "a",
                    "summary": "s",
                    "disposition": "declined",
                    "reason": " ",
                }
            ],
            "finding 1 is declined without a reason",
            id="declined-without-reason",
        ),
        pytest.param(
            [{"round": 1, "file": "a", "summary": "s"}],
            "finding 1 is neither fixed nor declined",
            id="open-finding",
        ),
        pytest.param(
            [{"file": "a", "summary": "s", "disposition": "declined", "reason": "r"}],
            "finding 1 has no round number",
            id="no-round",
        ),
        pytest.param({"findings": []}, "must hold a JSON array", id="not-an-array"),
        pytest.param("not json", "not valid JSON", id="invalid-json"),
    ],
)
def test_record_refuses_findings_that_are_not_all_dispositioned(
    tmp_path: Path, findings: object, message: str
) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, posted, _ = run_record(tmp_path, repo, findings)
    assert result.returncode == 1
    assert message in result.stderr
    assert posted == []


def test_fix_commit_must_be_in_head(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    findings = [
        {
            "round": 1,
            "file": "a",
            "summary": "s",
            "disposition": "fixed",
            "commit": "deadbeef",
        }
    ]
    result, posted, _ = run_record(tmp_path, repo, findings)
    assert result.returncode == 1
    assert "fix commit deadbeef is not in HEAD" in result.stderr
    assert posted == []


def test_record_refuses_a_head_that_is_not_the_pr_head(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, posted, _ = run_record(tmp_path, repo, [], pr_head="f" * 40)
    assert result.returncode == 1
    assert "head is fffffff but the local HEAD is" in result.stderr
    assert posted == []


def test_record_refuses_uncommitted_changes(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    (repo / "src/app.ts").write_text("edited\n")
    result, posted, _ = run_record(tmp_path, repo, [])
    assert result.returncode == 1
    assert "uncommitted changes" in result.stderr
    assert posted == []


def test_record_refuses_a_closed_pr(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, posted, _ = run_record(tmp_path, repo, [], state="MERGED")
    assert result.returncode == 1
    assert "is not open" in result.stderr
    assert posted == []


def test_record_refuses_a_non_owner_account(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, posted, _ = run_record(tmp_path, repo, [], actor="someone-else")
    assert result.returncode == 1
    assert "is not repository owner acme" in result.stderr
    assert posted == []


def test_record_refuses_a_duplicate_for_the_same_head(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    head = commit_lines(repo, {"src/app.ts": 5})
    existing = {
        "user": {"login": "acme"},
        "body": f"<!-- pinpoint-claude-review: {head} level=medium -->\nearlier",
        "created_at": "2026-09-25T12:00:00Z",
        "updated_at": "2026-09-25T12:00:00Z",
    }
    result, posted, _ = run_record(tmp_path, repo, [], comments=[existing])
    assert result.returncode == 1
    assert "already has a review record" in result.stderr
    assert posted == []


def test_invalid_level_is_a_usage_error(tmp_path: Path) -> None:
    repo = make_repo(tmp_path)
    commit_lines(repo, {"src/app.ts": 5})
    result, posted, _ = run_record(tmp_path, repo, [], level_arg="max")
    assert result.returncode == 2
    assert posted == []
