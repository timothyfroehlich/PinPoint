"""Fail-closed tests for the PR dashboard.

Every column is parsed from one GraphQL snapshot. Review and UI are the head's
`Claude Review` and `UI Approval` required checks, counted only when the GitHub
Actions app ran them; anything the dashboard cannot read renders as `?`, never green.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

DASHBOARD = Path(__file__).parent.parent / "workflow" / "pr-dashboard.sh"
HEAD = "a" * 40
OWNER = "timothyfroehlich"
ACTIONS = "github-actions"


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
    app=ACTIONS,
):
    return {
        "__typename": "CheckRun",
        "name": name,
        "status": status,
        "conclusion": conclusion,
        "completedAt": completed_at,
        "startedAt": started_at,
        "checkSuite": {"app": {"slug": app}},
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


def cells(result, row=0):
    """The CI, Review, and UI cells of the Nth data row (columns are fixed-width)."""
    line = result.stdout.splitlines()[2 + row]
    return line[48:60].strip(), line[61:69].strip(), line[70:78].strip()


def review_column(result, row=0):
    return cells(result, row)[1]


def ui_column(result, row=0):
    return cells(result, row)[2]


def required(name, **kwargs):
    return check(name=name, **kwargs)


# ---------------------------------------------------------------------------------
# Review and UI columns: the head's required checks, from the same snapshot
# ---------------------------------------------------------------------------------


@pytest.mark.unit
def test_header_names_the_review_and_ui_columns(run_dashboard):
    result, _calls = run_dashboard([list_rule([pr_node(1)])])

    assert result.returncode == 0, result.stderr
    header = result.stdout.splitlines()[0]
    assert header[61:69].strip() == "Review"
    assert header[70:78].strip() == "UI"


@pytest.mark.unit
def test_open_pr_list_is_one_graphql_request(run_dashboard):
    checks = [
        check(),
        required("Claude Review"),
        required("UI Approval"),
    ]
    nodes = [pr_node(number, checks=checks) for number in range(1, 4)]
    result, calls = run_dashboard([list_rule(nodes)])

    assert result.returncode == 0, result.stderr
    assert [cells(result, row) for row in range(3)] == [
        ("All passed", "pass", "pass")
    ] * 3
    assert len(calls) == 1
    assert "checkSuite { app { slug } }" in " ".join(calls[0])


@pytest.mark.unit
@pytest.mark.parametrize(
    ("status", "conclusion", "expected"),
    [
        ("COMPLETED", "SUCCESS", "pass"),
        ("COMPLETED", "NEUTRAL", "pass"),
        ("COMPLETED", "SKIPPED", "skipped"),
        ("COMPLETED", "FAILURE", "fail"),
        ("COMPLETED", "CANCELLED", "fail"),
        ("COMPLETED", "TIMED_OUT", "fail"),
        ("IN_PROGRESS", None, "pending"),
        ("QUEUED", None, "pending"),
        ("WAITING", None, "pending"),
        ("COMPLETED", None, "?"),
        ("COMPLETED", "SOMETHING_NEW", "?"),
        ("MYSTERY", None, "?"),
    ],
)
@pytest.mark.parametrize(
    ("name", "column"), [("Claude Review", review_column), ("UI Approval", ui_column)]
)
def test_required_check_states(
    run_dashboard, status, conclusion, expected, name, column
):
    node = pr_node(1, checks=[required(name, status=status, conclusion=conclusion)])
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0, result.stderr
    assert column(result) == expected


@pytest.mark.unit
def test_absent_required_checks_render_a_dash(run_dashboard):
    result, _calls = run_dashboard([list_rule([pr_node(1)])])

    assert result.returncode == 0, result.stderr
    assert cells(result) == ("All passed", "—", "—")


@pytest.mark.unit
def test_ui_reads_waiting_while_sign_off_waits_on_tim(run_dashboard):
    node = pr_node(
        1, checks=[required("Tim's UI sign-off", status="WAITING", conclusion=None)]
    )
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0, result.stderr
    assert ui_column(result) == "waiting"


@pytest.mark.unit
def test_ui_approval_result_wins_over_a_finished_sign_off(run_dashboard):
    node = pr_node(
        1,
        checks=[
            required("Tim's UI sign-off", status="COMPLETED", conclusion="SUCCESS"),
            required("UI Approval", status="COMPLETED", conclusion="SUCCESS"),
        ],
    )
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0, result.stderr
    assert ui_column(result) == "pass"


@pytest.mark.unit
def test_required_check_from_another_app_is_not_counted(run_dashboard):
    lookalike = [
        required("Claude Review", app="lookalike-app"),
        required("UI Approval", app="lookalike-app"),
    ]
    result, _calls = run_dashboard([list_rule([pr_node(1, checks=lookalike)])])
    assert (review_column(result), ui_column(result)) == ("—", "—")

    # A newer pass from another app cannot override the Actions run's failure.
    node = pr_node(
        1,
        checks=[
            required(
                "Claude Review",
                conclusion="FAILURE",
                started_at="2026-08-30T11:58:00Z",
            ),
            required(
                "Claude Review",
                app="lookalike-app",
                started_at="2026-08-30T12:30:00Z",
            ),
        ],
    )
    result, _calls = run_dashboard([list_rule([node])])
    assert review_column(result) == "fail"


@pytest.mark.unit
def test_required_check_without_a_check_suite_is_not_counted(run_dashboard):
    run = required("UI Approval")
    del run["checkSuite"]
    result, _calls = run_dashboard([list_rule([pr_node(1, checks=[run])])])

    assert result.returncode == 0, result.stderr
    assert ui_column(result) == "—"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("older", "newer", "expected"),
    [
        ("FAILURE", "SUCCESS", "pass"),
        ("SUCCESS", "FAILURE", "fail"),
        ("SUCCESS", "CANCELLED", "fail"),
    ],
)
def test_latest_required_check_rerun_wins(run_dashboard, older, newer, expected):
    node = pr_node(
        1,
        checks=[
            required(
                "UI Approval", conclusion=older, started_at="2026-08-30T11:58:00Z"
            ),
            required(
                "UI Approval", conclusion=newer, started_at="2026-08-30T11:59:00Z"
            ),
        ],
    )
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0, result.stderr
    assert ui_column(result) == expected


@pytest.mark.unit
def test_unordered_required_check_reruns_fail_closed(run_dashboard):
    node = pr_node(
        1,
        checks=[
            required(
                "Claude Review", conclusion="FAILURE", completed_at="", started_at=""
            ),
            required(
                "Claude Review", conclusion="SUCCESS", completed_at="", started_at=""
            ),
        ],
    )
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0, result.stderr
    assert review_column(result) == "?"


@pytest.mark.unit
def test_required_check_on_a_later_checks_page_is_counted(run_dashboard):
    node = pr_node(4, checks_has_next=True, checks_cursor="CHK_CURSOR")
    later_page = {
        "data": {
            "repository": {
                "pullRequest": {
                    "commits": {
                        "nodes": [
                            {
                                "commit": {
                                    "statusCheckRollup": {
                                        "contexts": connection(
                                            [
                                                required("Claude Review"),
                                                required(
                                                    "UI Approval",
                                                    status="WAITING",
                                                    conclusion=None,
                                                ),
                                            ]
                                        )
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        }
    }
    result, calls = run_dashboard(
        [
            list_rule([node]),
            {
                "contains": ['contexts(first: 100, after: "CHK_CURSOR")'],
                "stdout": json.dumps(later_page),
            },
        ]
    )

    assert result.returncode == 0, result.stderr
    assert cells(result) == ("2/3 running", "pass", "pending")
    assert len(calls) == 2


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
    # The first page already carries passing required checks; an incomplete
    # snapshot still cannot show them, because a later page could hold a rerun.
    node = pr_node(
        5,
        checks=[check(), required("Claude Review"), required("UI Approval")],
        checks_has_next=True,
        checks_cursor="CHK_CURSOR",
    )
    result, _calls = run_dashboard(
        [
            list_rule([node]),
            {
                "contains": ['contexts(first: 100, after: "CHK_CURSOR")'],
                "stderr": "HTTP 403: API rate limit exceeded",
                "exit": 1,
            },
        ]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" not in row
    assert cells(result) == ("?", "?", "?")


@pytest.mark.unit
def test_missing_checks_cursor_is_unknown_without_a_speculative_call(run_dashboard):
    node = pr_node(6, checks_has_next=True, checks_cursor=None)
    result, calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert "All passed" not in row
    assert cells(result) == ("?", "?", "?")
    assert not any("after:" in " ".join(call) for call in calls)


@pytest.mark.unit
def test_malformed_check_context_is_unknown_while_review_remains_usable(
    run_dashboard,
):
    result, _calls = run_dashboard(
        [list_rule([pr_node(8, checks=[{}, required("Claude Review")])])]
    )

    assert result.returncode == 0
    row = result.stdout.splitlines()[2]
    assert cells(result) == ("?", "pass", "—")
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
    result, _calls = run_dashboard([list_rule([node])])

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
    result, _calls = run_dashboard([list_rule([node])])

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
    result, _calls = run_dashboard([list_rule([node])])

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
    result, _calls = run_dashboard([list_rule([node])])

    assert result.returncode == 0
    assert "1 FAILED" in result.stdout.splitlines()[2]


# ---------------------------------------------------------------------------------
# Merge column and malformed responses
# ---------------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("merge_state", ["DIRTY", "DRAFT", "HAS_HOOKS"])
def test_valid_merge_states_remain_visible(run_dashboard, merge_state):
    result, _calls = run_dashboard([list_rule([pr_node(11, merge_state=merge_state)])])

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
