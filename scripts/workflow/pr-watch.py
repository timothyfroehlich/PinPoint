#!/usr/bin/env python3
"""Wait on one PR head: its CI Gate and Claude Review, or its merge-queue entry.

Run it as a background command; it blocks until a verdict:

  pr-watch.py <PR> --phase ci --expected-head <SHA>
  pr-watch.py <PR> --phase queue --expected-head <SHA>

Progress goes to stderr, one line per state change. stdout carries exactly one
terminal JSON verdict. The watch is pinned to the expected head: if the PR head
moves it ends `stale` instead of following the new head, and a DIRTY/CONFLICTING
merge state on an open PR ends it `conflicting`.

`ci` outcomes: passed | failed | stale | conflicting | timed_out | undetermined.
`passed` means CI Gate passed and, on a PR that is not a draft, the `Claude
Review` check passed too (a draft skips Claude Review, so only CI Gate is
awaited). Claude Review's findings are review threads the owning agent still
adjudicates. A failed check saves the failed-step log to
tmp/gh-monitor/failure-<run>.md and returns it as `failure_artifact`. `UI
Approval` is not awaited: it can wait on Tim indefinitely.

`queue` outcomes: merged | removed | not_queued | stale | conflicting |
timed_out | undetermined. Run it after `gh pr merge` put the PR in the merge
queue, or armed auto-merge, which enqueues the PR once its checks pass.
`merged` carries the merge commit. `removed` means the PR left the queue
without merging; the failing `merge_group` run for the PR's queue branch, when
there is one, supplies `detail_url`, `failing_jobs`, and the same failure
artifact the ci phase writes.

A cancelled CI Gate is superseded, not failed: pushing a second commit cancels
the in-flight run via concurrency groups. (PP-r63o) A gh API error (rate-limit
403, network drop, auth failure) is not a failure either — it means we could
not find out. (PP-qkl8)

Exit 0: passed or merged.
Exit 1: failed, removed, not_queued, stale, or conflicting.
Exit 2: timed_out or undetermined — neither a pass nor a failure. Usage errors
        also exit 2, with nothing on stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gh_cli import run_gh  # noqa: E402

REPO_OWNER = "minamaya"
REPO_NAME = "PinPoint"
CI_GATE_NAME = "CI Gate"
CLAUDE_REVIEW_NAME = "Claude Review"

LOG_DIR = "tmp/gh-monitor"
WATCH_POLL_SECONDS = 30
# PR CI currently has a 30-minute job backstop. Leave another 30 minutes for
# runner queueing while still bounding unattended harness waits.
WATCH_TIMEOUT_SECONDS = 3600

# How long to keep polling for a replacement CI Gate after the current one came
# back cancelled. A cancel almost always means a newer run is already queued;
# this bounds the wait so a genuinely abandoned run still terminates.
SUPERSEDED_GATE_GRACE = 180  # seconds

REPOSITORY = f"{REPO_OWNER}/{REPO_NAME}"
CONFLICT_STATES = ("DIRTY", "CONFLICTING")
EXIT_UNDETERMINED = 2
EXIT_CODES = {
    "passed": 0,
    "merged": 0,
    "failed": 1,
    "removed": 1,
    "not_queued": 1,
    "stale": 1,
    "conflicting": 1,
    "timed_out": EXIT_UNDETERMINED,
    "undetermined": EXIT_UNDETERMINED,
}


def emit(msg: str) -> None:
    """Progress and diagnostics go to stderr; stdout is reserved for the verdict."""
    print(f"[{datetime.now():%H:%M:%S}] {msg}", file=sys.stderr, flush=True)


def gh(*args: str) -> str:
    """Run a gh CLI command, returning stdout. Raises RuntimeError on failure."""
    return run_gh(*args, error=RuntimeError)


# ---------------------------------------------------------------------------
# Run/check conclusion classification
# ---------------------------------------------------------------------------
#
# Three classes, not two. `gh run list` reports conclusions lowercase and the
# statusCheckRollup reports them uppercase, so every comparison goes through
# these helpers rather than an inline set membership test.

_PASSING_CONCLUSIONS = {"success", "skipped", "neutral"}

# A cancelled run is neither a pass nor a failure — it is *superseded*. Pushing
# a second commit cancels the in-flight run via concurrency groups, and the
# Preview Auto-Resync workflow cancels itself the same way, so cancellation is
# routine rather than exceptional. A cancelled run has no failed step, which is
# why any failure artifact written for one reads "(no log available)". Treating
# it as a failure produced false "✗ CI — failed" alarms. (PP-r63o)
_SUPERSEDED_CONCLUSIONS = {"cancelled"}


def _is_passing(conclusion: str | None) -> bool:
    return (conclusion or "").lower() in _PASSING_CONCLUSIONS


def _is_superseded(conclusion: str | None) -> bool:
    return (conclusion or "").lower() in _SUPERSEDED_CONCLUSIONS


def _is_failing(conclusion: str | None) -> bool:
    """True for a real failure, given the conclusion of a COMPLETED run/check.

    Fail-safe by construction: anything that isn't recognisably passing and
    isn't a supersession counts as a failure, including an unrecognised
    conclusion and an empty one. GitHub can briefly report a run as `completed`
    before its conclusion is populated, and a watcher that shrugged at that
    could report green without ever having observed the real outcome.

    Every caller must gate on `status == "completed"` first — an empty
    conclusion on a run that is still queued or in progress just means "not
    decided yet", which `status` already tells you.
    """
    return not _is_passing(conclusion) and not _is_superseded(conclusion)


def _select_ci_gate(rollup: list[dict], name: str = CI_GATE_NAME) -> dict | None:
    """Select the authoritative CI Gate from one current-head rollup.

    GitHub scopes statusCheckRollup to the PR's current head commit, but that
    commit can still carry MORE THAN ONE entry for a check — a re-run, or a run
    cancelled by a concurrency group, leaves its superseded check behind next to
    the live one. Select the entry with the most recent start time. Completion
    is only a fallback because an older run can finish cancelling after its
    replacement has already completed. (PP-r63o)
    """
    gates = [c for c in rollup if c.get("name") == name]
    if not gates:
        return None
    return max(gates, key=lambda c: c.get("startedAt") or c.get("completedAt") or "")


# ---------------------------------------------------------------------------
# Failure artifact
# ---------------------------------------------------------------------------


def write_failure_artifact(run_id: int) -> str:
    """Fetch failure logs and write a markdown report. Returns the file path."""
    os.makedirs(LOG_DIR, exist_ok=True)
    path = f"{LOG_DIR}/failure-{run_id}.md"

    log = subprocess.run(
        ["gh", "run", "view", str(run_id), "--log-failed"],
        capture_output=True,
        text=True,
    )
    summary = subprocess.run(
        ["gh", "run", "view", str(run_id)],
        capture_output=True,
        text=True,
    )
    log_tail = "\n".join(log.stdout.splitlines()[-100:]) or "(no log available)"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(path, "w", encoding="utf-8") as f:
        f.write("# GitHub Actions Failure Report\n")
        f.write(f"Run ID: {run_id}\n")
        f.write(f"URL: https://github.com/{REPOSITORY}/actions/runs/{run_id}\n")
        f.write(f"Generated: {now}\n\n")
        f.write(f"## Failed Steps Log\n\n```text\n{log_tail}\n```\n\n")
        summary_text = summary.stdout or "(no summary available)"
        f.write(f"## Run Summary\n\n```text\n{summary_text}\n```\n")

    return path


def _failed_ci_run_id(head_sha: str, details_url: str = "") -> int | None:
    """Return the newest confirmed-failing CI workflow run for ``head_sha``.

    This lookup happens only after CI Gate or Claude Review is red. The ordinary
    watch path never enumerates workflow runs. Prefer the run ID already
    embedded in the selected gate's URL; the fallback filters a commit-scoped
    list after retrieval so duplicate workflow names cannot make `gh` abort.
    """
    match = re.search(r"/actions/runs/(\d+)(?:/|$)", details_url)
    if match is not None:
        return int(match.group(1))

    raw = gh(
        "run",
        "list",
        "--commit",
        head_sha,
        "--limit",
        "10",
        "--json",
        "databaseId,status,conclusion,headSha,workflowName",
    )
    runs = json.loads(raw)
    failed = [
        run
        for run in runs
        if run.get("headSha") == head_sha
        and run.get("workflowName") == "CI"
        and run.get("status") == "completed"
        and _is_failing(run.get("conclusion"))
    ]
    if not failed:
        return None
    return int(
        max(failed, key=lambda run: int(run.get("databaseId") or 0))["databaseId"]
    )


# ---------------------------------------------------------------------------
# Pinned-head watches
# ---------------------------------------------------------------------------


@dataclass
class Verdict:
    """How one watch ended; main() wraps it in the terminal JSON envelope."""

    outcome: str
    observed_head: str = ""
    ci_gate: str = "UNKNOWN"
    # The head's Claude Review conclusion (or status), or SKIPPED_DRAFT on a draft.
    claude_review: str = "UNKNOWN"
    # Unresolved review threads when the watch passes; None when not counted.
    unresolved_threads: int | None = None
    merge_state: str = "UNKNOWN"
    detail_url: str | None = None
    failure_artifact: str | None = None


def _verdict(outcome: str, detail: str, *, cls: type = Verdict, **fields):
    """Log why the watch ended and build its verdict as the phase's dataclass."""
    emit(detail)
    return cls(outcome, **fields)


def _current_phase_ci_snapshot(
    pr: int,
) -> tuple[str, dict | None, dict | None, bool, str]:
    """Fetch head, CI Gate, Claude Review, draft state, and merge state in one query.

    Keeping them in one response is the exact-head boundary: a push cannot
    interleave between separate head and check reads. GitHub reports
    mergeStateStatus UNKNOWN while it recomputes mergeability (after any push
    to main); that is "no conflict seen yet", not an error — GitHub
    re-checks conflicts at merge time.
    """
    raw = gh(
        "pr",
        "view",
        str(pr),
        "--json",
        "headRefOid,statusCheckRollup,mergeStateStatus,isDraft",
    )
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("GitHub returned invalid PR metadata")
    head_sha = str(data.get("headRefOid") or "")
    rollup = data.get("statusCheckRollup") or []
    gate = _select_ci_gate(rollup)
    # Only the Claude Review workflow's own job counts, not a check another app
    # posts under the same name (those carry no workflowName).
    review = _select_ci_gate(
        [c for c in rollup if c.get("workflowName") == CLAUDE_REVIEW_NAME],
        CLAUDE_REVIEW_NAME,
    )
    merge_state = str(data.get("mergeStateStatus") or "UNKNOWN")
    return head_sha, gate, review, bool(data.get("isDraft")), merge_state


def _head_problem(
    head_sha: str,
    merge_state: str,
    expected_head: str,
    watch: str,
    *,
    cls: type = Verdict,
):
    """End a watch whose pinned head is unknown, moved, or conflicted."""
    if not head_sha:
        return _verdict(
            "undetermined",
            f"⚠  Could not determine {watch} state — PR head was empty.",
            cls=cls,
        )
    if head_sha != expected_head:
        return _verdict(
            "stale",
            f"PR head moved {expected_head[:7]} → {head_sha[:7]} — {watch} watch is stale",
            cls=cls,
            observed_head=head_sha,
            merge_state=merge_state,
        )
    if merge_state in CONFLICT_STATES:
        return _verdict(
            "conflicting",
            f"PR merge state is {merge_state} — conflict must be resolved",
            cls=cls,
            observed_head=head_sha,
            merge_state=merge_state,
        )
    return None


def _graphql_pull_request(fields: str, pr: int) -> dict:
    """Fetch `fields` of one pull request in a single GraphQL query.

    Raises RuntimeError (gh failed, or no such PR), json.JSONDecodeError,
    KeyError, or TypeError when GitHub's answer is unusable.
    """
    query = (
        "query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name)"
        f"{{pullRequest(number:$pr){{{fields}}}}}}}"
    )
    raw = gh(
        "api",
        "graphql",
        "-f",
        f"query={query}",
        "-F",
        f"owner={REPO_OWNER}",
        "-F",
        f"name={REPO_NAME}",
        "-F",
        f"pr={pr}",
    )
    pull = json.loads(raw)["data"]["repository"]["pullRequest"]
    if not isinstance(pull, dict):
        raise RuntimeError(f"GitHub returned no pull request #{pr}")
    return pull


def _unresolved_threads(pr: int) -> int | None:
    """Count the PR's unresolved review threads; None when GitHub cannot say."""
    try:
        threads = _graphql_pull_request(
            "reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved}}", pr
        )["reviewThreads"]
        if threads["pageInfo"]["hasNextPage"]:
            return None
        return sum(1 for t in threads["nodes"] if not t["isResolved"])
    except (RuntimeError, json.JSONDecodeError, KeyError, TypeError) as exc:
        emit(f"Review threads unavailable: {exc}")
        return None


def _failure_artifact(head_sha: str, details_url: str) -> str | None:
    """Write the failed run's log to disk; None when it cannot be found."""
    try:
        run_id = _failed_ci_run_id(head_sha, details_url)
        if run_id is not None:
            artifact = write_failure_artifact(run_id)
            emit(f"Failure details: {artifact}")
            return artifact
    except (RuntimeError, json.JSONDecodeError, OSError, ValueError) as exc:
        emit(f"Failure logs unavailable: {exc}")
    return None


def _watch_phase_ci(
    pr: int,
    expected_head: str,
    *,
    timeout_sec: float = WATCH_TIMEOUT_SECONDS,
    poll_sec: float = WATCH_POLL_SECONDS,
) -> Verdict:
    """Watch CI Gate and Claude Review for one pinned head, one query per interval."""
    deadline = time.monotonic() + timeout_sec
    superseded_deadline: float | None = None
    last_signature: tuple[str, str] | None = None
    last_review_signature: tuple[str, str] | None = None
    seen: dict = {}

    while time.monotonic() < deadline:
        try:
            head_sha, gate, review, is_draft, merge_state = _current_phase_ci_snapshot(
                pr
            )
        except (RuntimeError, json.JSONDecodeError) as exc:
            return _verdict(
                "undetermined",
                "⚠  Could not determine CI Gate state — "
                f"the GitHub API was unreachable ({exc}).",
            )
        problem = _head_problem(head_sha, merge_state, expected_head, "CI")
        if problem is not None:
            return problem

        status = (gate or {}).get("status") or ""
        conclusion = (gate or {}).get("conclusion") or ""
        details_url = (gate or {}).get("detailsUrl") or ""
        review_status = (review or {}).get("status") or ""
        review_conclusion = (review or {}).get("conclusion") or ""
        review_url = (review or {}).get("detailsUrl") or ""
        seen = {
            "observed_head": head_sha,
            "ci_gate": conclusion or status or "UNKNOWN",
            "claude_review": "SKIPPED_DRAFT"
            if is_draft
            else (review_conclusion or review_status or "UNKNOWN"),
            "merge_state": merge_state,
            "detail_url": details_url or None,
        }
        if (status, conclusion) != last_signature:
            emit(
                f"CI Gate {status.lower() or 'not yet posted'} on {head_sha[:7]}"
                + (f" ({conclusion})" if conclusion else "")
            )
            last_signature = (status, conclusion)

        # Claude Review can finish before CI Gate; a red review ends the watch
        # without waiting for CI.
        if (
            not is_draft
            and review_status == "COMPLETED"
            and _is_failing(review_conclusion)
        ):
            emit(
                f"Claude Review failed on {head_sha[:7]} (conclusion={review_conclusion})"
            )
            return Verdict(
                "failed",
                failure_artifact=_failure_artifact(head_sha, review_url),
                **{**seen, "detail_url": review_url or None},
            )

        if status == "COMPLETED":
            if _is_passing(conclusion):
                if is_draft or (
                    review_status == "COMPLETED"
                    and _is_passing(review_conclusion)
                    # A job-level skip only happens on a draft; on a ready PR
                    # it is a leftover from the draft, so wait for the review.
                    and review_conclusion.upper() != "SKIPPED"
                ):
                    threads = _unresolved_threads(pr)
                    if threads:
                        emit(f"{threads} unresolved review thread(s) to adjudicate")
                    return _verdict(
                        "passed",
                        f"CI Gate passed on {head_sha[:7]} (conclusion={conclusion})"
                        + ("" if is_draft else "; Claude Review passed")
                        + " ✓",
                        unresolved_threads=threads,
                        **seen,
                    )
                if (review_status, review_conclusion) != last_review_signature:
                    emit(
                        f"CI Gate passed; Claude Review {review_status.lower() or 'not yet posted'}"
                        + (f" ({review_conclusion})" if review_conclusion else "")
                    )
                    last_review_signature = (review_status, review_conclusion)
            elif not _is_superseded(conclusion):
                emit(
                    f"CI Gate failed on {head_sha[:7]} "
                    f"(conclusion={conclusion or 'unknown'})"
                )
                return Verdict(
                    "failed",
                    failure_artifact=_failure_artifact(head_sha, details_url),
                    **seen,
                )
            elif superseded_deadline is None:
                superseded_deadline = time.monotonic() + SUPERSEDED_GATE_GRACE
                emit("CI Gate cancelled (superseded) — waiting for a replacement run")
            elif time.monotonic() >= superseded_deadline:
                return _verdict(
                    "undetermined",
                    "⊘  CI Gate cancelled (superseded) — no replacement run appeared",
                    **seen,
                )
        else:
            superseded_deadline = None

        time.sleep(poll_sec)

    return _verdict(
        "timed_out",
        f"⚠  Could not determine CI Gate state — no terminal verdict within {timeout_sec}s.",
        **seen,
    )


# ---------------------------------------------------------------------------
# Merge-queue watch
# ---------------------------------------------------------------------------
#
# The queue builds a `gh-readonly-queue/<base>/pr-<n>-<sha>` commit and runs the
# required checks on it as a `merge_group` event; it then merges the PR or
# drops it from the queue, leaving it open. While queued, a PR has a
# mergeQueueEntry and no autoMergeRequest; armed auto-merge waiting for the PR's
# own checks is the reverse; a merged or dropped PR has neither.

QUEUE_BRANCH_PREFIX = "gh-readonly-queue/"

# Merging is two writes on GitHub's side: the entry disappears, then the state
# flips to MERGED. A read between them shows an open PR with no entry, so one
# such read is only a candidate; the watch re-reads after this grace and decides
# on the second consecutive one.
QUEUE_ABSENT_CONFIRM_SECONDS = 10

# The branch-prefix fallback scans this many recent merge_group runs; a busy
# queue spends three runs (one per required workflow) on every group.
QUEUE_RUN_SCAN_LIMIT = 200

# One query per interval carries everything a queue verdict needs. The entry's
# headCommit is the merge-group commit its merge_group runs are built on.
_QUEUE_FIELDS = (
    "state headRefOid mergeStateStatus mergeCommit{oid} "
    "autoMergeRequest{enabledAt} "
    "mergeQueueEntry{state position enqueuedAt headCommit{oid}}"
)


@dataclass
class QueueVerdict:
    """How a queue watch ended; main() wraps it in the terminal JSON envelope."""

    outcome: str
    observed_head: str = ""
    # OPEN, MERGED, or CLOSED.
    pr_state: str = "UNKNOWN"
    # The last observed queue entry state (QUEUED, AWAITING_CHECKS, MERGEABLE,
    # UNMERGEABLE, LOCKED), AUTO_MERGE_ARMED while waiting to be enqueued, or
    # NOT_QUEUED.
    queue_state: str = "UNKNOWN"
    queue_position: int | None = None
    merge_state: str = "UNKNOWN"
    merge_commit: str | None = None
    failing_jobs: list[str] = field(default_factory=list)
    detail_url: str | None = None
    failure_artifact: str | None = None


_QUEUE_RUN_FIELDS = (
    "databaseId,status,conclusion,headBranch,headSha,workflowName,createdAt,url"
)


def _newest_failing_group_run(runs: list[dict]) -> dict | None:
    """Among red runs, the newest failing commit's run, preferring CI.

    A queue that rebuilds a group (a PR ahead of it dropped out) leaves
    cancelled runs on the older commits, so the newest failing commit is the
    one that removed the PR; CI carries CI Gate, the queue's real gate.
    """
    failed = [
        run
        for run in runs
        if run.get("status") == "completed" and _is_failing(run.get("conclusion"))
    ]
    if not failed:
        return None
    newest_sha = max(failed, key=lambda run: int(run.get("databaseId") or 0))["headSha"]
    return max(
        (run for run in failed if run["headSha"] == newest_sha),
        key=lambda run: (
            run.get("workflowName") == "CI",
            int(run.get("databaseId") or 0),
        ),
    )


def _failed_queue_run(pr: int, since: str, group_sha: str | None) -> dict | None:
    """Return the failing merge_group run that removed ``pr`` from the queue.

    Called once, after the removal is confirmed. With the merge-group commit
    seen while the PR was queued, look up that commit's runs directly: exact,
    and independent of how busy the queue is. Without one (the PR left the
    queue before a poll caught its group), or when that commit has no red run
    (the queue rebuilt the group after the last poll and the new commit
    failed), scan recent merge_group runs for the PR's queue branch created
    since this attempt was enqueued.
    """
    if group_sha:
        raw = gh(
            "run",
            "list",
            "--commit",
            group_sha,
            "--event",
            "merge_group",
            "--limit",
            "20",
            "--json",
            _QUEUE_RUN_FIELDS,
        )
        run = _newest_failing_group_run(
            [run for run in json.loads(raw) if run.get("headSha") == group_sha]
        )
        if run is not None:
            return run
        emit(
            f"No failing merge_group run on {group_sha[:7]}; scanning the queue branch"
        )
    raw = gh(
        "run",
        "list",
        "--event",
        "merge_group",
        "--limit",
        str(QUEUE_RUN_SCAN_LIMIT),
        "--json",
        _QUEUE_RUN_FIELDS,
    )
    marker = f"/pr-{pr}-"
    return _newest_failing_group_run(
        [
            run
            for run in json.loads(raw)
            if str(run.get("headBranch") or "").startswith(QUEUE_BRANCH_PREFIX)
            and marker in str(run.get("headBranch"))
            and str(run.get("createdAt") or "") >= since
        ]
    )


def _queue_failure(pr: int, since: str, group_sha: str | None) -> dict:
    """The removed PR's failing run: detail_url, failing_jobs, failure_artifact.

    Whatever was found before an error is kept; nothing found is an empty dict,
    which is the case for a conflict, a manual dequeue, or a closed PR.
    """
    found: dict = {}
    try:
        run = _failed_queue_run(pr, since, group_sha)
        if run is None:
            emit("No failing merge_group run found for this PR's queue branch")
            return found
        run_id = int(run["databaseId"])
        found["detail_url"] = (
            run.get("url") or f"https://github.com/{REPOSITORY}/actions/runs/{run_id}"
        )
        jobs = json.loads(gh("run", "view", str(run_id), "--json", "jobs"))["jobs"]
        found["failing_jobs"] = [
            str(job.get("name"))
            for job in jobs
            if job.get("status") == "completed" and _is_failing(job.get("conclusion"))
        ]
        emit(
            f"merge_group run failed: {found['detail_url']} "
            f"({', '.join(found['failing_jobs']) or 'no failed job listed'})"
        )
        found["failure_artifact"] = write_failure_artifact(run_id)
        emit(f"Failure details: {found['failure_artifact']}")
    except (
        RuntimeError,
        json.JSONDecodeError,
        OSError,
        ValueError,
        KeyError,
        TypeError,
    ) as exc:
        emit(f"Queue failure details unavailable: {exc}")
    return found


def _watch_phase_queue(
    pr: int,
    expected_head: str,
    *,
    timeout_sec: float = WATCH_TIMEOUT_SECONDS,
    poll_sec: float = WATCH_POLL_SECONDS,
) -> QueueVerdict:
    """Watch one pinned head through the merge queue, one query per interval."""
    deadline = time.monotonic() + timeout_sec
    # Per-attempt state, taken from the latest entry (or armed auto-merge) so a
    # drop and re-enqueue starts a new attempt: when it was enqueued (or armed),
    # and the merge-group commit its runs are built on. `since` stays None until
    # the PR is first seen headed into the queue.
    since: str | None = None
    group_sha: str | None = None
    # True after one read showed no entry and no auto-merge (see
    # QUEUE_ABSENT_CONFIRM_SECONDS); the next such read is the verdict.
    absent_once = False
    last_signature: tuple | None = None
    seen: dict = {}

    while time.monotonic() < deadline:
        try:
            pull = _graphql_pull_request(_QUEUE_FIELDS, pr)
            entry = pull.get("mergeQueueEntry") or {}
            auto_merge = pull.get("autoMergeRequest") or {}
            merge_commit = (pull.get("mergeCommit") or {}).get("oid")
        except (
            RuntimeError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            AttributeError,
        ) as exc:
            return _verdict(
                "undetermined",
                "⚠  Could not determine merge-queue state — "
                f"the GitHub API was unreachable ({exc}).",
                cls=QueueVerdict,
                **seen,
            )
        state = str(pull.get("state") or "UNKNOWN")
        head_sha = str(pull.get("headRefOid") or "")
        merge_state = str(pull.get("mergeStateStatus") or "UNKNOWN")
        seen = {
            "observed_head": head_sha,
            "pr_state": state,
            "queue_state": entry.get("state")
            or ("AUTO_MERGE_ARMED" if auto_merge else "NOT_QUEUED"),
            "queue_position": entry.get("position"),
            "merge_state": merge_state,
        }
        # A conflict only matters while the PR can still merge.
        problem = _head_problem(
            head_sha,
            merge_state if state == "OPEN" else "UNKNOWN",
            expected_head,
            "queue",
            cls=QueueVerdict,
        )
        if problem is not None:
            return problem

        if state == "MERGED":
            return _verdict(
                "merged",
                f"PR #{pr} merged as {(merge_commit or 'unknown')[:7]} ✓",
                cls=QueueVerdict,
                merge_commit=merge_commit,
                **seen,
            )
        if entry or auto_merge:
            absent_once = False
            attempt = str(entry.get("enqueuedAt") or auto_merge.get("enabledAt") or "")
            if attempt != since:
                # A new attempt (first sighting, armed → enqueued, or a
                # re-enqueue): an earlier attempt's group commit is not this one's.
                since, group_sha = attempt, None
            group_sha = (entry.get("headCommit") or {}).get("oid") or group_sha
            signature = (seen["queue_state"], seen["queue_position"])
            if signature != last_signature:
                emit(
                    f"Queued at position {entry.get('position')} ({str(entry.get('state')).lower()})"
                    if entry
                    else "Auto-merge armed — waiting for GitHub to enqueue the PR"
                )
                last_signature = signature
        elif not absent_once:
            absent_once = True
            last_signature = None
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            emit("No queue entry — re-reading to confirm")
            # Clamped to the budget: the confirming read never overruns the
            # timeout, and the loop condition turns an exhausted budget into
            # timed_out rather than a read past it.
            time.sleep(min(QUEUE_ABSENT_CONFIRM_SECONDS, remaining))
            continue
        elif since is None:
            # Not queued when the watch began (confirmed by a second read), with
            # no auto-merge armed either.
            # That is `not_queued` (exit 1, act on it), not undetermined (exit
            # 2): GitHub answered, and nothing will merge this PR on its own.
            # Exit 2 means "could not find out; re-run the watch", and re-running
            # here can never change the answer. The caller acts: enqueue it with
            # `gh pr merge`, or, if it was dropped before the watch started,
            # read why on the PR page.
            return _verdict(
                "not_queued",
                f"PR #{pr} is {state.lower()} and not in the merge queue",
                cls=QueueVerdict,
                **seen,
            )
        else:
            emit(f"PR #{pr} left the merge queue without merging ({state.lower()})")
            return QueueVerdict(
                "removed", **seen, **_queue_failure(pr, since, group_sha)
            )

        time.sleep(poll_sec)

    return _verdict(
        "timed_out",
        f"⚠  Could not determine merge-queue state — no terminal verdict within {timeout_sec}s.",
        cls=QueueVerdict,
        **seen,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _full_sha(value: str) -> str:
    if re.fullmatch(r"[0-9a-f]{40}", value) is None:
        raise argparse.ArgumentTypeError(
            "must be a full 40-character lowercase commit SHA"
        )
    return value


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("pr", type=int, help="pull request number")
    parser.add_argument(
        "--phase", choices=("ci", "queue"), required=True, help="phase to wait on"
    )
    parser.add_argument(
        "--expected-head",
        type=_full_sha,
        metavar="SHA",
        required=True,
        help="full head SHA the watch is pinned to",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    watch = _watch_phase_queue if args.phase == "queue" else _watch_phase_ci
    verdict = watch(args.pr, args.expected_head)
    artifact = verdict.failure_artifact
    payload = {
        "schema_version": 2,
        "repository": REPOSITORY,
        "pr": args.pr,
        "phase": args.phase,
        "expected_head": args.expected_head,
        **asdict(verdict),
        "failure_artifact": str(Path(artifact).resolve()) if artifact else None,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    print(json.dumps(payload, separators=(",", ":")), flush=True)
    return EXIT_CODES[verdict.outcome]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[interrupted]", file=sys.stderr)
        sys.exit(130)
    except (RuntimeError, json.JSONDecodeError) as err:
        print(f"[error] {err}", file=sys.stderr)
        sys.exit(1)
