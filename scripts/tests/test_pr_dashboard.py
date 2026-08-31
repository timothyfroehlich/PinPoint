"""Request-bound and fail-closed tests for the batched PR dashboard."""

import json
import os
import subprocess
from pathlib import Path

import pytest

DASHBOARD = Path(__file__).parent.parent / "workflow" / "pr-dashboard.sh"
HEAD = "a" * 40
CODEX_LOGIN = "chatgpt-codex-connector"


def connection(nodes=(), *, has_next=False, cursor=None):
    return {
        "nodes": list(nodes),
        "pageInfo": {"hasNextPage": has_next, "endCursor": cursor},
    }


def check(name="CI Gate", status="COMPLETED", conclusion="SUCCESS"):
    return {
        "__typename": "CheckRun",
        "name": name,
        "status": status,
        "conclusion": conclusion,
    }


def review(sha=HEAD, state="APPROVED", login=CODEX_LOGIN):
    return {
        "author": {"login": login},
        "state": state,
        "submittedAt": "2026-08-30T12:00:00Z",
        "commit": {"oid": sha},
    }


def pr_node(
    number,
    *,
    reviews=None,
    review_has_next=False,
    review_cursor=None,
    threads=(),
    checks=None,
    merge_state="CLEAN",
):
    if reviews is None:
        reviews = [review()]
    if checks is None:
        checks = [check()]
    return {
        "number": number,
        "title": f"PR {number}",
        "headRefName": f"branch-{number}",
        "headRefOid": HEAD,
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "mergeStateStatus": merge_state,
        "commits": {
            "nodes": [
                {"commit": {"statusCheckRollup": {"contexts": connection(checks)}}}
            ]
        },
        "reviews": connection(reviews, has_next=review_has_next, cursor=review_cursor),
        "reviewThreads": connection(threads),
    }


def open_pr_response(nodes):
    return {
        "data": {
            "repository": {
                "pullRequests": connection(nodes),
            }
        }
    }


def nested_review_response(nodes):
    return {
        "data": {
            "repository": {
                "pullRequest": {"reviews": connection(nodes)},
            }
        }
    }


@pytest.fixture
def run_dashboard(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_gh = fake_bin / "gh"
    fake_gh.write_text(
        """#!/usr/bin/env python3
import json
import os
import sys

args = sys.argv[1:]
with open(os.environ["FAKE_GH_LOG"], "a", encoding="utf-8") as handle:
    handle.write(json.dumps(args) + "\\n")
joined = " ".join(args)
with open(os.environ["FAKE_GH_RULES"], encoding="utf-8") as handle:
    rules = json.load(handle)
for rule in rules:
    if all(needle in joined for needle in rule.get("contains", [])):
        if rule.get("stderr"):
            print(rule["stderr"], file=sys.stderr)
        if rule.get("stdout") is not None:
            print(rule["stdout"])
        raise SystemExit(rule.get("exit", 0))
print(f"unmatched fake gh call: {joined}", file=sys.stderr)
raise SystemExit(99)
""",
        encoding="utf-8",
    )
    fake_gh.chmod(0o755)

    def invoke(rules, *args):
        rules_path = tmp_path / "rules.json"
        log_path = tmp_path / "gh.log"
        rules_path.write_text(json.dumps(rules), encoding="utf-8")
        log_path.write_text("", encoding="utf-8")
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{fake_bin}:{env['PATH']}",
                "GITHUB_REPOSITORY": "timothyfroehlich/PinPoint",
                "FAKE_GH_RULES": str(rules_path),
                "FAKE_GH_LOG": str(log_path),
            }
        )
        result = subprocess.run(
            [str(DASHBOARD), *map(str, args)],
            capture_output=True,
            text=True,
            env=env,
        )
        calls = [json.loads(line) for line in log_path.read_text().splitlines()]
        return result, calls

    return invoke


@pytest.mark.unit
def test_ten_native_reviewed_prs_use_one_graphql_request(run_dashboard):
    response = open_pr_response([pr_node(number) for number in range(1, 11)])
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(response)}]
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.count("reviewed") == 10
    assert len(calls) == 1
    assert calls[0][:2] == ["api", "graphql"]


@pytest.mark.unit
def test_no_open_prs_preserves_compact_cli_output(run_dashboard):
    result, calls = run_dashboard(
        [
            {
                "contains": ["pullRequests(first: 100"],
                "stdout": json.dumps(open_pr_response([])),
            }
        ]
    )

    assert result.returncode == 0
    assert result.stdout == "No open PRs found.\n"
    assert len(calls) == 1


@pytest.mark.unit
def test_comments_are_fetched_only_for_missing_native_evidence_and_verify_app(
    run_dashboard,
):
    response = open_pr_response(
        [
            pr_node(1),
            pr_node(2, reviews=[]),
            pr_node(3, reviews=[]),
        ]
    )
    trusted = [
        {
            "user": {"login": "chatgpt-codex-connector[bot]"},
            "performed_via_github_app": {"slug": "chatgpt-codex-connector"},
            "body": (
                "Codex Review: Didn't find any major issues.\n\n"
                f"**Reviewed commit:** `{HEAD[:10]}`"
            ),
            "updated_at": "2026-08-30T12:01:00Z",
        }
    ]
    untrusted = [
        {
            **trusted[0],
            "performed_via_github_app": {"slug": "lookalike-app"},
        }
    ]
    result, calls = run_dashboard(
        [
            {"contains": ["pullRequests(first: 100"], "stdout": json.dumps(response)},
            {"contains": ["issues/2/comments"], "stdout": json.dumps(trusted)},
            {"contains": ["issues/3/comments"], "stdout": json.dumps(untrusted)},
        ]
    )

    assert result.returncode == 0, result.stderr
    rows = result.stdout.splitlines()[2:]
    assert "reviewed" in rows[0]
    assert "reviewed" in rows[1]
    assert "NOT REVIEWED" in rows[2]
    joined_calls = [" ".join(call) for call in calls]
    assert not any("issues/1/comments" in call for call in joined_calls)
    assert sum("/comments" in call for call in joined_calls) == 2


@pytest.mark.unit
def test_comment_rate_limit_renders_review_unknown(run_dashboard):
    response = open_pr_response([pr_node(9, reviews=[])])
    result, calls = run_dashboard(
        [
            {"contains": ["pullRequests(first: 100"], "stdout": json.dumps(response)},
            {
                "contains": ["issues/9/comments"],
                "stderr": "HTTP 403: API rate limit exceeded",
                "exit": 1,
            },
        ]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" in row
    assert "?" in row
    assert "NOT REVIEWED" not in row
    assert len(calls) == 2


@pytest.mark.unit
def test_nested_review_pagination_is_targeted_and_avoids_comment_fallback(
    run_dashboard,
):
    initial = open_pr_response(
        [
            pr_node(
                4,
                reviews=[review("b" * 40)],
                review_has_next=True,
                review_cursor="REV_CURSOR",
            )
        ]
    )
    result, calls = run_dashboard(
        [
            {"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)},
            {
                "contains": ['reviews(first: 100, after: "REV_CURSOR")'],
                "stdout": json.dumps(nested_review_response([review()])),
            },
        ]
    )

    assert result.returncode == 0, result.stderr
    assert "reviewed" in result.stdout.splitlines()[2]
    assert len(calls) == 2
    assert all(call[:2] == ["api", "graphql"] for call in calls)


@pytest.mark.unit
def test_nested_pagination_rate_limit_renders_unknown_not_green(run_dashboard):
    initial = open_pr_response(
        [
            pr_node(
                5,
                review_has_next=True,
                review_cursor="REV_CURSOR",
            )
        ]
    )
    result, calls = run_dashboard(
        [
            {"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)},
            {
                "contains": ['reviews(first: 100, after: "REV_CURSOR")'],
                "stderr": "HTTP 403: API rate limit exceeded",
                "exit": 1,
            },
        ]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "?" in row
    assert "All passed" in row
    assert "reviewed" not in row
    assert len(calls) == 2


@pytest.mark.unit
def test_missing_pagination_cursor_is_unknown_without_a_speculative_call(
    run_dashboard,
):
    initial = open_pr_response(
        [
            pr_node(
                6,
                review_has_next=True,
                review_cursor=None,
            )
        ]
    )
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)}]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" in row
    assert "?" in row
    assert "reviewed" not in row
    assert len(calls) == 1


@pytest.mark.unit
def test_malformed_check_context_is_unknown_while_review_remains_usable(
    run_dashboard,
):
    initial = open_pr_response([pr_node(8, checks=[{}])])
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)}]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "?" in row
    assert "reviewed" in row
    assert "All passed" not in row
    assert len(calls) == 1


@pytest.mark.unit
def test_superseded_cancelled_check_does_not_override_replacement(run_dashboard):
    initial = open_pr_response(
        [
            pr_node(
                10,
                checks=[
                    check(conclusion="CANCELLED"),
                    check(conclusion="SUCCESS"),
                ],
            )
        ]
    )
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)}]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" in row
    assert "FAILED" not in row
    assert len(calls) == 1


@pytest.mark.unit
def test_non_authoritative_cancelled_check_still_fails_closed(run_dashboard):
    initial = open_pr_response(
        [
            pr_node(
                12,
                checks=[
                    check(name="Lint", conclusion="CANCELLED"),
                    check(name="Lint", conclusion="SUCCESS"),
                ],
            )
        ]
    )
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)}]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "1 FAILED" in row
    assert len(calls) == 1


@pytest.mark.unit
@pytest.mark.parametrize("merge_state", ["DIRTY", "DRAFT", "HAS_HOOKS"])
def test_valid_merge_states_remain_visible(run_dashboard, merge_state):
    initial = open_pr_response([pr_node(11, merge_state=merge_state)])
    result, calls = run_dashboard(
        [{"contains": ["pullRequests(first: 100"], "stdout": json.dumps(initial)}]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert merge_state in row
    assert len(calls) == 1


@pytest.mark.unit
def test_malformed_repository_response_renders_requested_pr_unknown(run_dashboard):
    result, calls = run_dashboard(
        [{"contains": ["pr_7: pullRequest"], "stdout": "{"}], 7
    )

    assert result.returncode == 1
    assert "#7" in result.stdout
    assert result.stdout.splitlines()[2].count("?") >= 5
    assert "malformed GitHub response" in result.stderr
    assert len(calls) == 1
