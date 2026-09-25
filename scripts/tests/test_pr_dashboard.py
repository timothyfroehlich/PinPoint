"""Fail-closed tests for the PR dashboard.

CI and merge state are parsed from one GraphQL snapshot. The Review column is the
merge gate's own label (`_review_summary` in `_pr-gates.sh`), so these tests feed the
gate's `gh` calls through the same fake `gh` and assert the four labels come through
verbatim — and that a gate failure reads as `?`, never as green.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

DASHBOARD = Path(__file__).parent.parent / "workflow" / "pr-dashboard.sh"
HEAD = "a" * 40
OLD = "b" * 40
CODEX_BOT = "chatgpt-codex-connector[bot]"
CODEX_APP = "chatgpt-codex-connector"
CODERABBIT_BOT = "coderabbitai[bot]"
OWNER = "timothyfroehlich"


def connection(nodes=(), *, has_next=False, cursor=None):
    return {
        "nodes": list(nodes),
        "pageInfo": {"hasNextPage": has_next, "endCursor": cursor},
    }


def check(
    name="CI Gate",
    status="COMPLETED",
    conclusion="SUCCESS",
    completed_at="2026-08-30T12:00:00Z",
    started_at="2026-08-30T11:59:00Z",
):
    return {
        "__typename": "CheckRun",
        "name": name,
        "status": status,
        "conclusion": conclusion,
        "completedAt": completed_at,
        "startedAt": started_at,
    }


def review(sha=HEAD, state="APPROVED", login=CODEX_BOT):
    """A REST review record, as `_review_evidence` reads it."""
    return {
        "user": {"login": login},
        "state": state,
        "submitted_at": "2026-08-30T12:00:00Z",
        "commit_id": sha,
    }


def marker(sha=HEAD):
    return {
        "user": {"login": OWNER},
        "body": f"<!-- pinpoint-review: {sha} -->\nreviewed by hand",
        "updated_at": "2026-08-30T12:01:00Z",
    }


def clean_codex_comment(sha=HEAD[:10], app=CODEX_APP):
    return {
        "user": {"login": CODEX_BOT},
        "performed_via_github_app": {"slug": app},
        "body": (
            "Codex Review: Didn't find any major issues.\n\n"
            f"**Reviewed commit:** `{sha}`"
        ),
        "updated_at": "2026-08-30T12:01:00Z",
    }


def pr_node(
    number,
    *,
    checks=None,
    checks_has_next=False,
    checks_cursor=None,
    merge_state="CLEAN",
):
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
                {
                    "commit": {
                        "statusCheckRollup": {
                            "contexts": connection(
                                checks, has_next=checks_has_next, cursor=checks_cursor
                            )
                        }
                    }
                }
            ]
        },
    }


def open_pr_response(nodes):
    return {"data": {"repository": {"pullRequests": connection(nodes)}}}


def list_rule(nodes):
    return {
        "contains": ["pullRequests(first: 100"],
        "stdout": json.dumps(open_pr_response(nodes)),
    }


def gate_rules(pr, *, reviews=(), comments=(), unresolved=0):
    """Every `gh` call `_review_summary` makes for one PR, answered."""
    threads = [{"isResolved": False}] * unresolved
    return [
        {
            "contains": ["repo view", "nameWithOwner"],
            "stdout": f"{OWNER}/PinPoint",
        },
        {"contains": [f"pr view {pr} --json headRefOid"], "stdout": HEAD},
        {"contains": [f"pulls/{pr}/reviews"], "stdout": json.dumps(list(reviews))},
        {"contains": [f"issues/{pr}/comments"], "stdout": json.dumps(list(comments))},
        {
            "contains": [f"pullRequest(number: {pr})", "reviewThreads"],
            "stdout": json.dumps(
                {
                    "data": {
                        "repository": {
                            "pullRequest": {"reviewThreads": connection(threads)}
                        }
                    }
                }
            ),
        },
    ]


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
                "GITHUB_REPOSITORY": f"{OWNER}/PinPoint",
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


def review_column(result, row=0):
    """The Review cell of the Nth data row (columns are fixed-width)."""
    line = result.stdout.splitlines()[2 + row]
    return line[61:79].strip()


# ---------------------------------------------------------------------------------
# Review column: the gate's four labels, verbatim
# ---------------------------------------------------------------------------------


@pytest.mark.unit
def test_open_pr_list_is_one_graphql_request_plus_the_gate_per_pr(run_dashboard):
    nodes = [pr_node(number) for number in range(1, 4)]
    rules = [list_rule(nodes)]
    for number in range(1, 4):
        rules.extend(gate_rules(number, reviews=[review()]))
    result, calls = run_dashboard(rules)

    assert result.returncode == 0, result.stderr
    assert [review_column(result, row) for row in range(3)] == ["approved"] * 3
    list_calls = [call for call in calls if "pullRequests(first: 100" in " ".join(call)]
    assert len(list_calls) == 1


@pytest.mark.unit
@pytest.mark.parametrize("login", [CODEX_BOT, CODERABBIT_BOT])
def test_exact_head_native_approval_is_approved(run_dashboard, login):
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, reviews=[review(login=login)])]
    )

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "approved"


@pytest.mark.unit
def test_stale_native_approval_is_stale_review(run_dashboard):
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, reviews=[review(sha=OLD)])]
    )

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "stale review"


@pytest.mark.unit
def test_coderabbit_changes_requested_on_head_is_changes_requested(run_dashboard):
    result, _calls = run_dashboard(
        [
            list_rule([pr_node(1)]),
            *gate_rules(
                1,
                reviews=[review(login=CODERABBIT_BOT, state="CHANGES_REQUESTED")],
            ),
        ]
    )

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "changes requested"


@pytest.mark.unit
def test_unresolved_threads_are_changes_requested(run_dashboard):
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, reviews=[review()], unresolved=2)]
    )

    assert result.returncode == 0, result.stderr
    # Coverage wins the label; threads are the thread gate's business.
    assert review_column(result) == "approved"

    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, unresolved=2)]
    )
    assert review_column(result) == "changes requested"


@pytest.mark.unit
def test_no_evidence_is_not_reviewed(run_dashboard):
    result, _calls = run_dashboard([list_rule([pr_node(1)]), *gate_rules(1)])

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "not reviewed"


@pytest.mark.unit
def test_pending_codex_request_is_still_not_reviewed(run_dashboard):
    request = {
        "user": {"login": OWNER},
        "body": f"@codex review\n<!-- pinpoint-codex-review-head: {HEAD} -->",
        "created_at": "2026-08-30T12:01:00Z",
    }
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, comments=[request])]
    )

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "not reviewed"


@pytest.mark.unit
def test_trusted_clean_codex_comment_is_approved_and_lookalike_is_not(run_dashboard):
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, comments=[clean_codex_comment()])]
    )
    assert review_column(result) == "approved"

    result, _calls = run_dashboard(
        [
            list_rule([pr_node(1)]),
            *gate_rules(1, comments=[clean_codex_comment(app="lookalike-app")]),
        ]
    )
    assert review_column(result) == "not reviewed"


@pytest.mark.unit
def test_local_review_marker_is_not_coverage(run_dashboard):
    # Only CodeRabbit and Codex cover a head; a retired local marker pinned to head
    # reads as not reviewed.
    result, _calls = run_dashboard(
        [list_rule([pr_node(1)]), *gate_rules(1, comments=[marker()])]
    )
    assert review_column(result) == "not reviewed"


@pytest.mark.unit
def test_gate_failure_renders_review_unknown_not_green(run_dashboard):
    rules = [list_rule([pr_node(9)])]
    rules.extend(
        rule
        for rule in gate_rules(9, reviews=[review()])
        if "issues/9/comments" not in rule["contains"]
    )
    rules.append(
        {
            "contains": ["issues/9/comments"],
            "stderr": "HTTP 403: API rate limit exceeded",
            "exit": 1,
        }
    )
    result, _calls = run_dashboard(rules)

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" in row
    assert review_column(result) == "?"


@pytest.mark.unit
def test_no_open_prs_preserves_compact_cli_output(run_dashboard):
    result, calls = run_dashboard([list_rule([])])

    assert result.returncode == 0
    assert result.stdout == "No open PRs found.\n"
    assert len(calls) == 1


# ---------------------------------------------------------------------------------
# CI column
# ---------------------------------------------------------------------------------


@pytest.mark.unit
def test_checks_pagination_rate_limit_renders_ci_unknown_not_green(run_dashboard):
    node = pr_node(5, checks_has_next=True, checks_cursor="CHK_CURSOR")
    result, _calls = run_dashboard(
        [
            list_rule([node]),
            {
                "contains": ['contexts(first: 100, after: "CHK_CURSOR")'],
                "stderr": "HTTP 403: API rate limit exceeded",
                "exit": 1,
            },
            *gate_rules(5, reviews=[review()]),
        ]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" not in row
    assert row[48:60].strip() == "?"
    assert review_column(result) == "approved"


@pytest.mark.unit
def test_missing_checks_cursor_is_unknown_without_a_speculative_call(run_dashboard):
    node = pr_node(6, checks_has_next=True, checks_cursor=None)
    result, calls = run_dashboard([list_rule([node]), *gate_rules(6)])

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" not in row
    assert row[48:60].strip() == "?"
    assert not any("after:" in " ".join(call) for call in calls)


@pytest.mark.unit
def test_malformed_check_context_is_unknown_while_review_remains_usable(
    run_dashboard,
):
    result, _calls = run_dashboard(
        [list_rule([pr_node(8, checks=[{}])]), *gate_rules(8, reviews=[review()])]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert row[48:60].strip() == "?"
    assert review_column(result) == "approved"
    assert "All passed" not in row


@pytest.mark.unit
def test_superseded_cancelled_check_does_not_override_replacement(run_dashboard):
    node = pr_node(
        10,
        checks=[
            check(
                conclusion="CANCELLED",
                completed_at="2026-08-30T12:05:00Z",
                started_at="2026-08-30T11:58:00Z",
            ),
            check(
                conclusion="SUCCESS",
                completed_at="2026-08-30T12:01:00Z",
                started_at="2026-08-30T11:59:00Z",
            ),
        ],
    )
    result, _calls = run_dashboard([list_rule([node]), *gate_rules(10)])

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" in row
    assert "FAILED" not in row


@pytest.mark.unit
@pytest.mark.parametrize(
    ("older_conclusion", "newer_conclusion", "expected"),
    [
        ("FAILURE", "SUCCESS", "All passed"),
        ("SUCCESS", "FAILURE", "1 FAILED"),
        ("SUCCESS", "CANCELLED", "1 FAILED"),
    ],
)
def test_latest_authoritative_ci_gate_rerun_wins(
    run_dashboard,
    older_conclusion,
    newer_conclusion,
    expected,
):
    node = pr_node(
        13,
        checks=[
            check(
                conclusion=older_conclusion,
                completed_at="2026-08-30T12:00:00Z",
                started_at="2026-08-30T11:58:00Z",
            ),
            check(
                conclusion=newer_conclusion,
                completed_at="2026-08-30T12:01:00Z",
                started_at="2026-08-30T11:59:00Z",
            ),
        ],
    )
    result, _calls = run_dashboard([list_rule([node]), *gate_rules(13)])

    assert result.returncode == 0
    assert expected in result.stdout.splitlines()[2]


@pytest.mark.unit
def test_multiple_ci_gates_without_timestamps_fail_closed(run_dashboard):
    node = pr_node(
        14,
        checks=[
            check(conclusion="FAILURE", completed_at="", started_at=""),
            check(conclusion="SUCCESS", completed_at="", started_at=""),
        ],
    )
    result, _calls = run_dashboard([list_rule([node]), *gate_rules(14)])

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert row[48:60].strip() == "?"
    assert "All passed" not in row


@pytest.mark.unit
def test_non_authoritative_cancelled_check_still_fails_closed(run_dashboard):
    node = pr_node(
        12,
        checks=[
            check(name="Lint", conclusion="CANCELLED"),
            check(name="Lint", conclusion="SUCCESS"),
        ],
    )
    result, _calls = run_dashboard([list_rule([node]), *gate_rules(12)])

    assert result.returncode == 0
    assert "1 FAILED" in result.stdout.splitlines()[2]


# ---------------------------------------------------------------------------------
# Merge column and malformed responses
# ---------------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("merge_state", ["DIRTY", "DRAFT", "HAS_HOOKS"])
def test_valid_merge_states_remain_visible(run_dashboard, merge_state):
    result, _calls = run_dashboard(
        [list_rule([pr_node(11, merge_state=merge_state)]), *gate_rules(11)]
    )

    assert result.returncode == 0
    assert merge_state in result.stdout.splitlines()[2]


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
