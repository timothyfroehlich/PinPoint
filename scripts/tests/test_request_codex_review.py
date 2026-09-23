"""Tests for the one-per-head manual Codex review request guard."""

import json
import os
import stat
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

SCRIPT = Path(__file__).parent.parent / "workflow" / "request-codex-review.sh"
HEAD = "a" * 40
OTHER_HEAD = "b" * 40
HEAD_COMMITTED_AT = "2026-09-05T12:00:00Z"


def coderabbit_request(created_at: str = "2026-09-05T12:01:00Z") -> dict:
    return {
        "user": {"login": "acme"},
        "body": "@coderabbitai review",
        "created_at": created_at,
    }


def rate_limit_response(
    *,
    login: str = "coderabbitai[bot]",
    app: str = "coderabbitai",
    issue_url: str = "https://api.github.com/repos/acme/widget/issues/123",
    body: str = "Review rate limited.",
    created_at: str = "2026-09-05T12:01:01Z",
    updated_at: str = "2026-09-05T12:01:05Z",
) -> dict:
    return {
        "user": {"login": login},
        "performed_via_github_app": {"slug": app},
        "issue_url": issue_url,
        "body": body,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def run_request(
    tmp_path: Path,
    *,
    actor: str = "acme",
    draft: bool = False,
    state: str = "OPEN",
    ci_status: str = "COMPLETED",
    ci_conclusion: str = "SUCCESS",
    ci_gates: list[dict] | None = None,
    reviews: list[dict] | None = None,
    comments: list[dict] | None = None,
    rate_limit_comment: dict | None = None,
    rate_limit_comment_id: str | None = "456",
    head_committed_at: str = HEAD_COMMITTED_AT,
    latest_head: str = HEAD,
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    posts = tmp_path / "posts.jsonl"
    gh = tmp_path / "gh"
    gh.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys\n"
        "args = sys.argv[1:]\n"
        "if args[:2] == ['repo', 'view']:\n"
        "    print('acme/widget')\n"
        "elif args[:2] == ['api', 'user']:\n"
        "    print(os.environ['STUB_ACTOR'])\n"
        "elif args[:2] == ['pr', 'view'] and 'headRefOid,isDraft,state,statusCheckRollup' in args:\n"
        "    print(os.environ['STUB_METADATA'])\n"
        "elif args[:2] == ['pr', 'view'] and 'headRefOid' in args:\n"
        "    print(os.environ['STUB_LATEST_HEAD'])\n"
        "elif args[:2] == ['api', 'graphql']:\n"
        "    print(json.dumps({'data': {'repository': {'pullRequest': {'reviewThreads': "
        "{'pageInfo': {'hasNextPage': False, 'endCursor': None}, 'nodes': []}}}}}))\n"
        "elif any('/commits/' in arg for arg in args):\n"
        "    print(os.environ['STUB_HEAD_COMMITTED_AT'])\n"
        "elif any('/issues/comments/' in arg for arg in args):\n"
        "    print(os.environ['STUB_RATE_LIMIT_COMMENT'])\n"
        "elif any('/pulls/' in arg and '/reviews' in arg for arg in args):\n"
        "    print(os.environ['STUB_REVIEWS'])\n"
        "elif any('/issues/' in arg and '/comments' in arg for arg in args) and '--method' not in args:\n"
        "    print(os.environ['STUB_COMMENTS'])\n"
        "elif '--method' in args and 'POST' in args:\n"
        "    body = next(arg for arg in args if arg.startswith('body='))[5:]\n"
        "    with open(os.environ['STUB_POSTS'], 'a') as output:\n"
        "        output.write(json.dumps(body) + '\\n')\n"
        "    print('https://github.example/review-request')\n"
        "else:\n"
        "    raise SystemExit(f'unexpected gh call: {args}')\n"
    )
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)

    metadata = {
        "headRefOid": HEAD,
        "isDraft": draft,
        "state": state,
        "statusCheckRollup": ci_gates
        or [
            {
                "name": "CI Gate",
                "status": ci_status,
                "conclusion": ci_conclusion,
                "startedAt": "2026-09-05T12:00:00Z",
            }
        ],
    }
    env = {
        **os.environ,
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "STUB_ACTOR": actor,
        "STUB_METADATA": json.dumps(metadata),
        "STUB_LATEST_HEAD": latest_head,
        "STUB_HEAD_COMMITTED_AT": head_committed_at,
        "STUB_RATE_LIMIT_COMMENT": json.dumps(
            rate_limit_comment
            if rate_limit_comment is not None
            else rate_limit_response()
        ),
        "STUB_REVIEWS": json.dumps(reviews or []),
        "STUB_COMMENTS": json.dumps(
            comments if comments is not None else [coderabbit_request()]
        ),
        "STUB_POSTS": str(posts),
    }
    result = subprocess.run(
        [
            "bash",
            str(SCRIPT),
            "123",
            *([rate_limit_comment_id] if rate_limit_comment_id else []),
        ],
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )
    posted = (
        [json.loads(line) for line in posts.read_text().splitlines()]
        if posts.exists()
        else []
    )
    return result, posted


def request_comment(sha: str = HEAD) -> dict:
    return {
        "user": {"login": "acme"},
        "body": f"@codex review\n<!-- pinpoint-codex-review-head: {sha} -->",
        "created_at": "2026-09-05T12:01:00Z",
    }


def approval(sha: str = HEAD) -> dict:
    return {
        "user": {"login": "chatgpt-codex-connector[bot]"},
        "state": "APPROVED",
        "commit_id": sha,
        "submitted_at": "2026-09-05T12:01:00Z",
        "body": "clean",
    }


def test_requests_sha_bound_review_after_green_ci(tmp_path: Path) -> None:
    result, posts = run_request(tmp_path)

    assert result.returncode == 0, result.stderr
    assert result.stderr == ""
    assert posts == [f"@codex review\n<!-- pinpoint-codex-review-head: {HEAD} -->"]
    assert f"head {HEAD[:7]}" in result.stdout


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"rate_limit_comment_id": None}, "Usage:"),
        ({"comments": []}, "no current-head CodeRabbit request"),
        (
            {"comments": [coderabbit_request("2026-09-05T11:59:00Z")]},
            "no current-head CodeRabbit request",
        ),
        (
            {"comments": [coderabbit_request("2026-09-05T12:02:00Z")]},
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {"rate_limit_comment": rate_limit_response(login="other[bot]")},
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {"rate_limit_comment": rate_limit_response(app="other-app")},
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {
                "rate_limit_comment": rate_limit_response(
                    issue_url="https://api.github.com/repos/acme/widget/issues/124"
                )
            },
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {"rate_limit_comment": rate_limit_response(body="Review finished.")},
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {
                "rate_limit_comment": rate_limit_response(
                    updated_at="2026-09-05T11:59:00Z"
                )
            },
            "does not prove CodeRabbit usage exhaustion",
        ),
        (
            {
                "rate_limit_comment": rate_limit_response(
                    created_at="2026-09-05T11:59:00Z"
                )
            },
            "does not prove CodeRabbit usage exhaustion",
        ),
    ],
)
def test_requires_current_head_coderabbit_usage_limit(
    tmp_path: Path, kwargs: dict[str, object], message: str
) -> None:
    result, posts = run_request(tmp_path, **kwargs)

    assert result.returncode != 0
    assert message in result.stderr
    assert posts == []


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"actor": "someone-else"}, "not repository owner"),
        ({"draft": True}, "is draft"),
        ({"state": "CLOSED"}, "not OPEN"),
        ({"ci_status": "IN_PROGRESS"}, "status=IN_PROGRESS"),
        ({"ci_conclusion": "FAILURE"}, "conclusion=FAILURE"),
        ({"latest_head": OTHER_HEAD}, "head moved"),
    ],
)
def test_refuses_ineligible_request(
    tmp_path: Path, kwargs: dict[str, object], message: str
) -> None:
    result, posts = run_request(tmp_path, **kwargs)

    assert result.returncode == 1
    assert message in result.stderr
    assert posts == []


def test_refuses_duplicate_request_for_same_head(tmp_path: Path) -> None:
    result, posts = run_request(tmp_path, comments=[request_comment()])

    assert result.returncode == 1
    assert "already requested" in result.stderr
    assert posts == []


def test_refuses_head_that_already_has_review_coverage(tmp_path: Path) -> None:
    result, posts = run_request(tmp_path, reviews=[approval()])

    assert result.returncode == 1
    assert "already has exact-head review coverage" in result.stderr
    assert posts == []


def test_uses_latest_duplicate_ci_gate(tmp_path: Path) -> None:
    result, posts = run_request(
        tmp_path,
        ci_gates=[
            {
                "name": "CI Gate",
                "status": "COMPLETED",
                "conclusion": "SUCCESS",
                "startedAt": "2026-09-05T12:00:00Z",
            },
            {
                "name": "CI Gate",
                "status": "IN_PROGRESS",
                "conclusion": None,
                "startedAt": "2026-09-05T12:05:00Z",
            },
        ],
    )

    assert result.returncode == 1
    assert "status=IN_PROGRESS" in result.stderr
    assert posts == []
