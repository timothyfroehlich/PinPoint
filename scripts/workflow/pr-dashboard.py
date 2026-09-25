#!/usr/bin/env python3
"""Render the PR dashboard from one repository-level GraphQL snapshot.

CI and merge state come from the GraphQL snapshot. The Review column is the merge
gate's own label — `_review_summary` in `_pr-gates.sh` runs two checkers
(CodeRabbit approval, Codex evidence) and names the result with
one of four words: approved, changes requested, stale review, not reviewed. The
dashboard shells out to it per PR rather than keeping a Python copy of that logic.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

CONNECTION_PAGE_SIZE = 100
CI_GATE_NAME = "CI Gate"
GATES_SCRIPT = Path(__file__).resolve().parent / "_pr-gates.sh"
REVIEW_LABELS = frozenset(
    {"approved", "changes requested", "stale review", "not reviewed"}
)


class DashboardError(RuntimeError):
    """A remote or malformed-response condition that cannot be shown as green."""


def gh(*args: str) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise DashboardError(result.stderr.strip() or f"gh {args[0]} failed")
    return result.stdout.strip()


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
              ... on CheckRun {{ name status conclusion startedAt completedAt }}
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
              ... on CheckRun {{ name status conclusion startedAt completedAt }}
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


def review_label(pr: int) -> str:
    """The merge gate's review label for a PR, or "?" when the gate cannot say."""
    result = subprocess.run(
        [
            "bash",
            "-c",
            'set -euo pipefail; source "$1"; _review_summary "$2"',
            "_",
            str(GATES_SCRIPT),
            str(pr),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return "?"
    try:
        summary = json.loads(result.stdout)
    except json.JSONDecodeError:
        return "?"
    label = summary.get("label") if isinstance(summary, dict) else None
    return label if label in REVIEW_LABELS else "?"


def _ci_label(checks: list[dict[str, Any]]) -> str:
    gates = [
        check
        for check in checks
        if check.get("__typename") == "CheckRun" and check.get("name") == CI_GATE_NAME
    ]
    if len(gates) > 1:
        for gate in gates:
            completed_at = gate.get("completedAt")
            started_at = gate.get("startedAt")
            if (
                completed_at is not None
                and not isinstance(completed_at, str)
                or started_at is not None
                and not isinstance(started_at, str)
                or not (completed_at or started_at)
            ):
                return "?"

    def gate_rank(check: dict[str, Any]) -> str:
        when = check.get("startedAt") or check.get("completedAt") or ""
        return str(when)

    authoritative_gate = max(gates, key=gate_rank) if gates else None
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
        "merge": "?",
        "draft": "?",
        "branch": "?",
    }


def _render_row(row: dict[str, str]) -> None:
    print(
        f"#{row['number']:<5} {row['title'][:40]:<40} {row['ci']:<12} "
        f"{row['review']:<18} {row['merge']:<10} {row['draft']:<8} {row['branch']}"
    )


def _render_header() -> None:
    print(
        f"{'PR':<6} {'Title':<40} {'CI':<12} {'Review':<18} "
        f"{'Merge':<10} {'Draft':<8} Branch"
    )
    print(
        f"{'------':<6} {'----------------------------------------':<40} "
        f"{'------------':<12} {'------------------':<18} {'----------':<10} "
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
        ci = _ci_label(checks)
    except DashboardError:
        ci = "?"

    title = pr_data.get("title")
    branch = pr_data.get("headRefName")
    is_draft = pr_data.get("isDraft")
    return {
        "number": str(number),
        "title": title if isinstance(title, str) else "?",
        "ci": ci,
        "review": review_label(number),
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
