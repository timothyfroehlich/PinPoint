#!/usr/bin/env python3
"""Render the PR dashboard from one repository-level GraphQL snapshot."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

CODEX_REVIEW_GRAPHQL_LOGIN = "chatgpt-codex-connector"
CODEX_COMMENT_BOT = "chatgpt-codex-connector[bot]"
CODEX_REVIEW_APP_SLUG = "chatgpt-codex-connector"
CODEX_CLEAN_REVIEW_PREFIX = "Codex Review: Didn't find any major issues."
GITHUB_ACTIONS_BOT = "github-actions[bot]"
GITHUB_ACTIONS_APP_SLUG = "github-actions"
CODEX_REACTION_WITNESS_PREFIX = "<!-- pinpoint-codex-reaction-witness:"
REVIEW_MARKER_PREFIX = "<!-- pinpoint-review:"
LEGACY_REVIEW_MARKER_PREFIX = "<!-- pinpoint-claude-review:"
CONNECTION_PAGE_SIZE = 100


@dataclass(frozen=True)
class ReviewRecord:
    state: str
    sha: str = ""
    at: str = ""


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
        statusCheckRollup {{
          contexts(first: {CONNECTION_PAGE_SIZE}) {{
            pageInfo {{ hasNextPage endCursor }}
            nodes {{
              __typename
              ... on CheckRun {{ name status conclusion }}
              ... on StatusContext {{ context state }}
            }}
          }}
        }}
      }}
    }}
  }}
  reviews(first: {CONNECTION_PAGE_SIZE}) {{
    pageInfo {{ hasNextPage endCursor }}
    nodes {{ state submittedAt commit {{ oid }} author {{ login }} }}
  }}
  reviewThreads(first: {CONNECTION_PAGE_SIZE}) {{
    pageInfo {{ hasNextPage endCursor }}
    nodes {{ isResolved }}
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


def _nested_query(owner: str, repo: str, pr: int, kind: str, cursor: str) -> str:
    after = json.dumps(cursor)
    if kind == "threads":
        selection = f"""
        reviewThreads(first: {CONNECTION_PAGE_SIZE}, after: {after}) {{
          pageInfo {{ hasNextPage endCursor }} nodes {{ isResolved }}
        }}
        """
    elif kind == "reviews":
        selection = f"""
        reviews(first: {CONNECTION_PAGE_SIZE}, after: {after}) {{
          pageInfo {{ hasNextPage endCursor }}
          nodes {{ state submittedAt commit {{ oid }} author {{ login }} }}
        }}
        """
    elif kind == "checks":
        selection = f"""
        commits(last: 1) {{ nodes {{ commit {{ statusCheckRollup {{
          contexts(first: {CONNECTION_PAGE_SIZE}, after: {after}) {{
            pageInfo {{ hasNextPage endCursor }}
            nodes {{
              __typename
              ... on CheckRun {{ name status conclusion }}
              ... on StatusContext {{ context state }}
            }}
          }}
        }} }} }} }}
        """
    else:
        raise ValueError(f"unknown connection kind: {kind}")
    return f"""
    query {{ repository(owner: {json.dumps(owner)}, name: {json.dumps(repo)}) {{
      pullRequest(number: {pr}) {{ {selection} }}
    }} }}
    """


def _connection_from_pr(pr_data: dict[str, Any], kind: str) -> Any:
    if kind == "threads":
        return pr_data.get("reviewThreads")
    if kind == "reviews":
        return pr_data.get("reviews")
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


def _complete_nested_connection(
    owner: str,
    repo: str,
    pr: int,
    kind: str,
    initial: Any,
) -> list[dict[str, Any]]:
    nodes, has_next, cursor = _connection(initial)
    seen_cursors: set[str] = set()
    while has_next:
        if cursor in seen_cursors:
            raise DashboardError(f"{kind} pagination repeated its cursor")
        seen_cursors.add(cursor)
        payload = _graphql(_nested_query(owner, repo, pr, kind, cursor))
        try:
            pr_data = payload["data"]["repository"]["pullRequest"]
            if not isinstance(pr_data, dict):
                raise DashboardError(f"{kind} pagination PR was unavailable")
            page = _connection_from_pr(pr_data, kind)
        except (KeyError, TypeError, AttributeError) as exc:
            raise DashboardError(f"{kind} pagination response was malformed") from exc
        page_nodes, has_next, cursor = _connection(page)
        nodes.extend(page_nodes)
    return nodes


def _decode_paginated_lists(raw: str) -> list[dict[str, Any]]:
    if not raw.strip():
        raise DashboardError("comments response was empty")
    decoder = json.JSONDecoder()
    items: list[dict[str, Any]] = []
    index = 0
    while index < len(raw):
        while index < len(raw) and raw[index].isspace():
            index += 1
        if index >= len(raw):
            break
        try:
            document, index = decoder.raw_decode(raw, index)
        except json.JSONDecodeError as exc:
            raise DashboardError(f"malformed comments response: {exc}") from exc
        if not isinstance(document, list) or not all(
            isinstance(item, dict) for item in document
        ):
            raise DashboardError("comments response was not a list")
        items.extend(document)
    return items


def _issue_comments(owner: str, repo: str, pr: int) -> list[dict[str, Any]]:
    raw = gh(
        "api",
        "--paginate",
        f"repos/{owner}/{repo}/issues/{pr}/comments?per_page=100",
    )
    return _decode_paginated_lists(raw)


def _native_review_record(reviews: list[dict[str, Any]], head: str) -> ReviewRecord:
    for review in reviews:
        author = review.get("author")
        if author is not None and not isinstance(author, dict):
            raise DashboardError("review author was malformed")
        if (
            isinstance(author, dict)
            and author.get("login") == CODEX_REVIEW_GRAPHQL_LOGIN
        ):
            commit = review.get("commit")
            if (
                not isinstance(review.get("state"), str)
                or not isinstance(review.get("submittedAt"), str)
                or not isinstance(commit, dict)
                or not isinstance(commit.get("oid"), str)
            ):
                raise DashboardError("trusted native review was malformed")
    trusted = [
        review
        for review in reviews
        if (review.get("author") or {}).get("login") == CODEX_REVIEW_GRAPHQL_LOGIN
    ]
    trusted.sort(key=lambda review: review.get("submittedAt") or "")
    if not trusted:
        return ReviewRecord("unreviewed")
    head_reviews = [
        review
        for review in trusted
        if ((review.get("commit") or {}).get("oid") or "") == head
    ]
    latest = (head_reviews or trusted)[-1]
    sha = (latest.get("commit") or {}).get("oid") or ""
    state = latest.get("state") or "UNKNOWN"
    submitted_at = latest.get("submittedAt") or ""
    if state == "APPROVED" and sha == head:
        return ReviewRecord("approval", sha, submitted_at)
    if state == "APPROVED":
        return ReviewRecord("stale_approval", sha, submitted_at)
    if sha == head and state in {"COMMENTED", "CHANGES_REQUESTED"}:
        return ReviewRecord("reviewed", sha, submitted_at)
    return ReviewRecord("not_approved", sha, submitted_at)


def _comment_records(
    comments: list[dict[str, Any]], head: str
) -> tuple[list[ReviewRecord], list[ReviewRecord]]:
    automatic: list[ReviewRecord] = []
    markers: list[ReviewRecord] = []
    for comment in comments:
        body = comment.get("body") or ""
        if not isinstance(body, str):
            continue
        login = (comment.get("user") or {}).get("login")
        app = (comment.get("performed_via_github_app") or {}).get("slug")
        at = comment.get("updated_at") or comment.get("created_at") or ""
        if (
            login == CODEX_COMMENT_BOT
            and app == CODEX_REVIEW_APP_SLUG
            and body.startswith(CODEX_CLEAN_REVIEW_PREFIX)
        ):
            match = re.search(
                r"\*\*Reviewed commit:\*\* `([0-9a-f]{10}|[0-9a-f]{40})`", body
            )
            if match is not None:
                automatic.append(ReviewRecord("clean_comment", match.group(1), at))
        if (
            login == GITHUB_ACTIONS_BOT
            and app == GITHUB_ACTIONS_APP_SLUG
            and body.startswith(CODEX_REACTION_WITNESS_PREFIX)
        ):
            match = re.match(
                r"<!-- pinpoint-codex-reaction-witness: ([0-9a-f]{40}) -->", body
            )
            if match is not None:
                automatic.append(ReviewRecord("clean_reaction", match.group(1), at))
        if body.startswith(REVIEW_MARKER_PREFIX) or body.startswith(
            LEGACY_REVIEW_MARKER_PREFIX
        ):
            match = re.match(
                r"<!-- (?:pinpoint-review|pinpoint-claude-review):\s*([^ ]+)\s*-->",
                body,
            )
            if match is not None:
                markers.append(ReviewRecord("marker", match.group(1), at))
    automatic.sort(key=lambda record: record.at)
    markers.sort(key=lambda record: record.at)
    return automatic, markers


def _comment_review_record(comments: list[dict[str, Any]], head: str) -> ReviewRecord:
    automatic, markers = _comment_records(comments, head)
    current_markers = [record for record in markers if record.sha == head]
    if current_markers:
        return current_markers[-1]
    current_automatic = [
        record
        for record in automatic
        if (
            head.startswith(record.sha)
            if record.state == "clean_comment"
            else record.sha == head
        )
    ]
    if current_automatic:
        return current_automatic[-1]
    stale = markers + automatic
    if not stale:
        return ReviewRecord("unreviewed")
    latest = max(stale, key=lambda record: record.at)
    stale_state = {
        "marker": "stale_marker",
        "clean_comment": "stale_clean_comment",
        "clean_reaction": "stale_clean_reaction",
    }[latest.state]
    return ReviewRecord(stale_state, latest.sha, latest.at)


def _combined_review_state(native: ReviewRecord, comment: ReviewRecord) -> str:
    if comment.state == "marker":
        return "marker"
    if comment.state in {"clean_comment", "clean_reaction"}:
        comment_covers_native = native.sha == comment.sha or (
            comment.state == "clean_comment" and native.sha.startswith(comment.sha)
        )
        if native.state == "unreviewed" or not comment_covers_native:
            return comment.state
        return comment.state if comment.at > native.at else native.state
    if native.state == "reviewed":
        return native.state
    if comment.state == "unreviewed":
        return native.state
    return comment.state if comment.at > native.at else native.state


def _review_label(state: str) -> str:
    if state in {"approval", "clean_comment", "clean_reaction", "reviewed", "marker"}:
        return "reviewed"
    if state.startswith("stale_"):
        return "RE-REVIEW"
    if state == "not_approved":
        return "NOT APPROVED"
    if state == "unreviewed":
        return "NOT REVIEWED"
    return "?"


def _ci_label(checks: list[dict[str, Any]]) -> str:
    replacement_names = {
        check.get("name")
        for check in checks
        if check.get("__typename") == "CheckRun"
        and check.get("name") == "CI Gate"
        and (check.get("conclusion") or check.get("status")) != "CANCELLED"
    }
    effective_checks = [
        check
        for check in checks
        if not (
            check.get("__typename") == "CheckRun"
            and check.get("conclusion") == "CANCELLED"
            and check.get("name") in replacement_names
        )
    ]
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
        f"{row['review']:<12} {row['merge']:<10} {row['draft']:<8} {row['branch']}"
    )


def _render_header() -> None:
    print(
        f"{'PR':<6} {'Title':<40} {'CI':<12} {'Review':<12} "
        f"{'Merge':<10} {'Draft':<8} Branch"
    )
    print(
        f"{'------':<6} {'----------------------------------------':<40} "
        f"{'------------':<12} {'------------':<12} {'----------':<10} "
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

    connections: dict[str, list[dict[str, Any]] | None] = {}
    for kind in ("checks", "threads", "reviews"):
        try:
            connections[kind] = _complete_nested_connection(
                owner, repo, number, kind, _connection_from_pr(pr_data, kind)
            )
        except DashboardError:
            connections[kind] = None

    checks = connections["checks"]
    ci = _ci_label(checks) if checks is not None else "?"
    threads = connections["threads"]
    reviews = connections["reviews"]
    if threads is None or reviews is None:
        review = "?"
    else:
        if any(not isinstance(thread.get("isResolved"), bool) for thread in threads):
            review = "?"
        else:
            unresolved = sum(thread["isResolved"] is False for thread in threads)
            if unresolved:
                review = f"{unresolved} unres"
            else:
                try:
                    native = _native_review_record(reviews, head)
                    if native.state in {"approval", "reviewed"}:
                        review = "reviewed"
                    else:
                        comments = _issue_comments(owner, repo, number)
                        review = _review_label(
                            _combined_review_state(
                                native, _comment_review_record(comments, head)
                            )
                        )
                except DashboardError:
                    review = "?"

    title = pr_data.get("title")
    branch = pr_data.get("headRefName")
    is_draft = pr_data.get("isDraft")
    return {
        "number": str(number),
        "title": title if isinstance(title, str) else "?",
        "ci": ci,
        "review": review,
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
