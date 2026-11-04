#!/usr/bin/env python3
"""Render the PR dashboard from one repository-level GraphQL snapshot.

Every column comes from that snapshot. CI counts every check on the head commit.
Review and UI are the head's `Claude Review` and `UI Approval` required checks
(ruleset 6326455), counted only when the GitHub Actions app ran them, so a check
another app posts under the same name cannot read as a pass: pass, fail, pending,
skipped (the job did not run, as Claude Review on a draft), or — when absent. UI
reads `waiting` while the `Tim's UI sign-off` job waits on his approval, before
the `UI Approval` job that decides exists. Any
response the dashboard cannot read renders as `?`, never as green.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gh_cli import run_gh  # noqa: E402

CONNECTION_PAGE_SIZE = 100
CI_GATE_NAME = "CI Gate"
CLAUDE_REVIEW_NAME = "Claude Review"
UI_APPROVAL_NAME = "UI Approval"
UI_SIGN_OFF_NAME = "Tim's UI sign-off"
ACTIONS_APP_SLUG = "github-actions"
PENDING_CHECK_STATUSES = frozenset(
    {"IN_PROGRESS", "QUEUED", "PENDING", "WAITING", "REQUESTED"}
)
FAILED_CHECK_CONCLUSIONS = frozenset(
    {
        "ACTION_REQUIRED",
        "CANCELLED",
        "FAILURE",
        "STALE",
        "STARTUP_FAILURE",
        "TIMED_OUT",
    }
)


class DashboardError(RuntimeError):
    """A remote or malformed-response condition that cannot be shown as green."""


def gh(*args: str) -> str:
    return run_gh(*args, error=DashboardError)


def _repository_slug() -> tuple[str, str]:
    candidate = os.environ.get("GITHUB_REPOSITORY", "")
    if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", candidate):
        owner, repo = candidate.split("/", 1)
        return owner, repo

    result = subprocess.run(
        ["git", "remote", "get-url", "origin"], capture_output=True, text=True
    )
    if result.returncode != 0:
        raise DashboardError("could not determine repository from git remote origin")
    remote = result.stdout.strip()
    match = re.search(r"github\.com(?::|/)([^/]+)/([^/]+?)(?:\.git)?$", remote)
    if match is None:
        raise DashboardError(f"unsupported GitHub remote: {remote}")
    return match.group(1), match.group(2)


PR_FIELDS = f"""
  number
  title
  headRefName
  headRefOid
  isDraft
  mergeable
  mergeStateStatus
  commits(last: 1) {{
    nodes {{
      commit {{
        oid
        committedDate
        statusCheckRollup {{
          contexts(first: {CONNECTION_PAGE_SIZE}) {{
            pageInfo {{ hasNextPage endCursor }}
            nodes {{
              __typename
              ... on CheckRun {{
                name status conclusion startedAt completedAt
                checkSuite {{ app {{ slug }} }}
              }}
              ... on StatusContext {{ context state }}
            }}
          }}
        }}
      }}
    }}
  }}
"""


def _initial_query(owner: str, repo: str, numbers: list[int]) -> str:
    if numbers:
        selections = "\n".join(
            f"pr_{number}: pullRequest(number: {number}) {{ {PR_FIELDS} }}"
            for number in numbers
        )
    else:
        selections = f"""
        pullRequests(first: {CONNECTION_PAGE_SIZE}, states: OPEN) {{
          pageInfo {{ hasNextPage endCursor }}
          nodes {{ {PR_FIELDS} }}
        }}
        """
    return f"""
    query {{
      repository(owner: {json.dumps(owner)}, name: {json.dumps(repo)}) {{
        {selections}
      }}
    }}
    """


def _graphql(query: str) -> dict[str, Any]:
    try:
        payload = json.loads(gh("api", "graphql", "-f", f"query={query}"))
    except json.JSONDecodeError as exc:
        raise DashboardError(f"malformed GitHub response: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("errors"):
        raise DashboardError("GitHub GraphQL response contained errors")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise DashboardError("GitHub GraphQL response omitted data")
    return payload


def _connection(connection: Any) -> tuple[list[dict[str, Any]], bool, str]:
    if not isinstance(connection, dict):
        raise DashboardError("connection was missing")
    nodes = connection.get("nodes")
    page_info = connection.get("pageInfo")
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise DashboardError("connection nodes were malformed")
    if not isinstance(page_info, dict) or not isinstance(
        page_info.get("hasNextPage"), bool
    ):
        raise DashboardError("connection pageInfo was malformed")
    has_next = page_info["hasNextPage"]
    raw_cursor = page_info.get("endCursor")
    cursor = raw_cursor if isinstance(raw_cursor, str) else ""
    if has_next and not cursor:
        raise DashboardError("paginated connection omitted its cursor")
    return nodes, has_next, cursor


def _checks_query(owner: str, repo: str, pr: int, cursor: str) -> str:
    after = json.dumps(cursor)
    return f"""
    query {{ repository(owner: {json.dumps(owner)}, name: {json.dumps(repo)}) {{
      pullRequest(number: {pr}) {{
        commits(last: 1) {{ nodes {{ commit {{ statusCheckRollup {{
          contexts(first: {CONNECTION_PAGE_SIZE}, after: {after}) {{
            pageInfo {{ hasNextPage endCursor }}
            nodes {{
              __typename
              ... on CheckRun {{
                name status conclusion startedAt completedAt
                checkSuite {{ app {{ slug }} }}
              }}
              ... on StatusContext {{ context state }}
            }}
          }}
        }} }} }} }}
      }}
    }} }}
    """


def _checks_from_pr(pr_data: dict[str, Any]) -> Any:
    commits = pr_data.get("commits")
    if not isinstance(commits, dict) or not isinstance(commits.get("nodes"), list):
        raise DashboardError("commit connection was malformed")
    if not commits["nodes"]:
        return {"nodes": [], "pageInfo": {"hasNextPage": False, "endCursor": None}}
    try:
        rollup = commits["nodes"][0]["commit"].get("statusCheckRollup")
    except (KeyError, TypeError, AttributeError) as exc:
        raise DashboardError("status rollup was malformed") from exc
    if rollup is None:
        return {"nodes": [], "pageInfo": {"hasNextPage": False, "endCursor": None}}
    if not isinstance(rollup, dict):
        raise DashboardError("status rollup was malformed")
    return rollup.get("contexts")


def _complete_checks(
    owner: str, repo: str, pr: int, initial: Any
) -> list[dict[str, Any]]:
    nodes, has_next, cursor = _connection(initial)
    seen_cursors: set[str] = set()
    while has_next:
        if cursor in seen_cursors:
            raise DashboardError("checks pagination repeated its cursor")
        seen_cursors.add(cursor)
        payload = _graphql(_checks_query(owner, repo, pr, cursor))
        try:
            pr_data = payload["data"]["repository"]["pullRequest"]
            if not isinstance(pr_data, dict):
                raise DashboardError("checks pagination PR was unavailable")
            page = _checks_from_pr(pr_data)
        except (KeyError, TypeError, AttributeError) as exc:
            raise DashboardError("checks pagination response was malformed") from exc
        page_nodes, has_next, cursor = _connection(page)
        nodes.extend(page_nodes)
    return nodes


def _latest_run(runs: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The newest of several same-named check runs on one commit.

    A re-run, or a run a concurrency group cancelled, leaves its superseded check
    next to the live one; the most recent start wins. Raises DashboardError when
    two or more runs cannot be ordered, rather than guessing which one counts.
    """
    if len(runs) > 1:
        for run in runs:
            completed_at = run.get("completedAt")
            started_at = run.get("startedAt")
            if (
                completed_at is not None
                and not isinstance(completed_at, str)
                or started_at is not None
                and not isinstance(started_at, str)
                or not (completed_at or started_at)
            ):
                raise DashboardError("check runs could not be ordered")

    def run_rank(check: dict[str, Any]) -> str:
        when = check.get("startedAt") or check.get("completedAt") or ""
        return str(when)

    return max(runs, key=run_rank) if runs else None


def _app_slug(check: dict[str, Any]) -> str | None:
    suite = check.get("checkSuite")
    app = suite.get("app") if isinstance(suite, dict) else None
    slug = app.get("slug") if isinstance(app, dict) else None
    return slug if isinstance(slug, str) else None


def _required_check_label(checks: list[dict[str, Any]], name: str) -> str:
    """The state of one required check that GitHub Actions runs on the head."""
    runs = [
        check
        for check in checks
        if check.get("__typename") == "CheckRun"
        and check.get("name") == name
        and _app_slug(check) == ACTIONS_APP_SLUG
    ]
    try:
        run = _latest_run(runs)
    except DashboardError:
        return "?"
    if run is None:
        return "—"
    status = run.get("status")
    conclusion = run.get("conclusion")
    if status in PENDING_CHECK_STATUSES:
        return "pending"
    if status != "COMPLETED" or not isinstance(conclusion, str):
        return "?"
    if conclusion in {"SUCCESS", "NEUTRAL"}:
        return "pass"
    if conclusion == "SKIPPED":
        return "skipped"
    if conclusion in FAILED_CHECK_CONCLUSIONS:
        return "fail"
    return "?"


def _ui_label(checks: list[dict[str, Any]]) -> str:
    """UI Approval's state, or `waiting` while the sign-off job waits on Tim."""
    label = _required_check_label(checks, UI_APPROVAL_NAME)
    if label not in {"—", "pending"}:
        return label
    sign_offs = [
        check
        for check in checks
        if check.get("__typename") == "CheckRun"
        and check.get("name") == UI_SIGN_OFF_NAME
        and _app_slug(check) == ACTIONS_APP_SLUG
    ]
    try:
        sign_off = _latest_run(sign_offs)
    except DashboardError:
        return label
    if sign_off is not None and sign_off.get("status") == "WAITING":
        return "waiting"
    return label


def _ci_label(checks: list[dict[str, Any]]) -> str:
    gates = [
        check
        for check in checks
        if check.get("__typename") == "CheckRun" and check.get("name") == CI_GATE_NAME
    ]
    try:
        authoritative_gate = _latest_run(gates)
    except DashboardError:
        return "?"
    effective_checks = [
        check
        for check in checks
        if not (
            check.get("__typename") == "CheckRun" and check.get("name") == CI_GATE_NAME
        )
    ]
    if authoritative_gate is not None:
        effective_checks.append(authoritative_gate)
    total = len(effective_checks)
    passed = 0
    failed = 0
    pending = 0
    for check in effective_checks:
        name = check.get("name") or check.get("context") or ""
        typename = check.get("__typename")
        if typename == "StatusContext":
            state = check.get("state") or ""
            if not isinstance(name, str) or state not in {
                "SUCCESS",
                "FAILURE",
                "ERROR",
                "PENDING",
                "EXPECTED",
            }:
                return "?"
        elif typename == "CheckRun":
            status = check.get("status") or ""
            state = check.get("conclusion") or status
            if not isinstance(name, str) or status not in {
                "COMPLETED",
                "IN_PROGRESS",
                "QUEUED",
                "PENDING",
                "WAITING",
                "REQUESTED",
            }:
                return "?"
            if status == "COMPLETED" and not isinstance(check.get("conclusion"), str):
                return "?"
        else:
            return "?"
        if state == "SUCCESS":
            passed += 1
        elif state in {
            "ACTION_REQUIRED",
            "CANCELLED",
            "ERROR",
            "FAILURE",
            "STALE",
            "STARTUP_FAILURE",
            "TIMED_OUT",
        } and not str(name).startswith("codecov/"):
            failed += 1
        elif state in {
            "IN_PROGRESS",
            "QUEUED",
            "PENDING",
            "EXPECTED",
            "WAITING",
            "REQUESTED",
        }:
            pending += 1
        elif state not in {"NEUTRAL", "SKIPPED"}:
            return "?"
    if failed:
        return f"{failed} FAILED"
    if pending:
        return f"{passed}/{total} running"
    return "All passed"


def _merge_label(state: Any) -> str:
    return (
        str(state)
        if state
        in {
            "CONFLICTING",
            "DIRTY",
            "DRAFT",
            "HAS_HOOKS",
            "CLEAN",
            "BLOCKED",
            "UNSTABLE",
            "BEHIND",
            "UNKNOWN",
        }
        else "?"
    )


def _unknown_row(number: int) -> dict[str, str]:
    return {
        "number": str(number),
        "title": "?",
        "ci": "?",
        "review": "?",
        "ui": "?",
        "merge": "?",
        "draft": "?",
        "branch": "?",
    }


def _render_row(row: dict[str, str]) -> None:
    print(
        f"#{row['number']:<5} {row['title'][:40]:<40} {row['ci']:<12} "
        f"{row['review']:<8} {row['ui']:<8} {row['merge']:<10} {row['draft']:<8} "
        f"{row['branch']}"
    )


def _render_header() -> None:
    print(
        f"{'PR':<6} {'Title':<40} {'CI':<12} {'Review':<8} {'UI':<8} "
        f"{'Merge':<10} {'Draft':<8} Branch"
    )
    print(
        f"{'------':<6} {'----------------------------------------':<40} "
        f"{'------------':<12} {'--------':<8} {'--------':<8} {'----------':<10} "
        f"{'--------':<8} -------------------"
    )


def _parse_numbers(argv: list[str]) -> list[int]:
    numbers: list[int] = []
    for value in argv:
        if not value.isdigit():
            raise DashboardError(
                f"PR number must be numeric (e.g. '945'); received '{value}'."
            )
        numbers.append(int(value))
    return numbers


def _initial_prs(
    owner: str, repo: str, numbers: list[int]
) -> tuple[list[dict[str, Any]], bool]:
    payload = _graphql(_initial_query(owner, repo, numbers))
    try:
        repository = payload["data"]["repository"]
    except (KeyError, TypeError) as exc:
        raise DashboardError("repository response was malformed") from exc
    if not isinstance(repository, dict):
        raise DashboardError("repository was unavailable")
    if numbers:
        prs = []
        for number in numbers:
            node = repository.get(f"pr_{number}")
            prs.append(node if isinstance(node, dict) else {"number": number})
        return prs, False
    prs, has_next, _cursor = _connection(repository.get("pullRequests"))
    return prs, has_next


def _row_for_pr(owner: str, repo: str, pr_data: dict[str, Any]) -> dict[str, str]:
    number = pr_data.get("number")
    if not isinstance(number, int):
        return _unknown_row(0)
    head = pr_data.get("headRefOid")
    if not isinstance(head, str) or not head:
        return _unknown_row(number)

    try:
        checks = _complete_checks(owner, repo, number, _checks_from_pr(pr_data))
    except DashboardError:
        ci = review = ui = "?"
    else:
        ci = _ci_label(checks)
        review = _required_check_label(checks, CLAUDE_REVIEW_NAME)
        ui = _ui_label(checks)

    title = pr_data.get("title")
    branch = pr_data.get("headRefName")
    is_draft = pr_data.get("isDraft")
    return {
        "number": str(number),
        "title": title if isinstance(title, str) else "?",
        "ci": ci,
        "review": review,
        "ui": ui,
        "merge": _merge_label(pr_data.get("mergeStateStatus")),
        "draft": "draft" if is_draft is True else "" if is_draft is False else "?",
        "branch": branch if isinstance(branch, str) else "?",
    }


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    try:
        numbers = _parse_numbers(args)
        owner, repo = _repository_slug()
    except DashboardError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    try:
        prs, outer_truncated = _initial_prs(owner, repo, numbers)
    except DashboardError as exc:
        _render_header()
        for number in numbers:
            _render_row(_unknown_row(number))
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if not prs:
        print("No open PRs found.")
        return 0
    _render_header()
    rows = [_row_for_pr(owner, repo, pr_data) for pr_data in prs]
    rows.sort(key=lambda row: int(row["number"]))
    for row in rows:
        _render_row(row)
    if outer_truncated:
        print(
            "Warning: more than 100 open PRs; repository list is truncated.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
