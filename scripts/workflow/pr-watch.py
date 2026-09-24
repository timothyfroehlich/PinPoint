#!/usr/bin/env python3
"""Wait on one PR head's CI Gate or review, or report review-readiness.

Watch — run it as a background command; it blocks until a verdict:

  pr-watch.py <PR> --phase ci --expected-head <SHA>
  pr-watch.py <PR> --phase review --expected-head <SHA>

  Progress goes to stderr, one line per state change. stdout carries exactly
  one terminal JSON verdict. The watch is pinned to the expected head: if the
  PR head moves it ends `stale` instead of following the new head, and a
  DIRTY/CONFLICTING merge state ends it `conflicting`.

  ci      passed | failed | stale | conflicting | timed_out | undetermined.
          A failed gate saves the failed-step log to
          tmp/gh-monitor/failure-<run>.md and returns it as `failure_artifact`.
  review  passed (approved, 0 unresolved threads) | action_required (approved
          with unresolved threads, or changes requested) | stale |
          conflicting | timed_out | undetermined. `not reviewed` and
          `stale review` keep waiting.

Readiness snapshot:

  pr-watch.py <PR> --check-ready

  Mergeable + CI Gate green + review threads resolved. The review label is
  reported but is NOT part of the verdict: this answers "is this PR worth
  Tim's review right now?", so requiring the review to have already happened
  would be circular. merge-pr.sh's `reviewed` gate refuses to merge an
  unreviewed head.

A cancelled CI Gate is superseded, not failed: pushing a second commit cancels
the in-flight run via concurrency groups. (PP-r63o) A gh API error (rate-limit
403, network drop, auth failure) is not a failure either — it means we could
not find out. (PP-qkl8)

Exit 0: passed, or (--check-ready) ready.
Exit 1: failed, stale, conflicting, action_required, or (--check-ready) not ready.
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
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

REPO_OWNER = "timothyfroehlich"
REPO_NAME = "PinPoint"
READY_LABEL = "ready-for-review"
CI_GATE_NAME = "CI Gate"

# --- Review state ---------------------------------------------------------------
# Read from scripts/workflow/_pr-gates.sh (`_review_summary`), never mirrored here.
# This watcher only reports the label; merge-pr.sh is the enforcement point.
GATES_SCRIPT = Path(__file__).resolve().parent / "_pr-gates.sh"
REVIEW_LABELS = ("approved", "changes requested", "stale review", "not reviewed")
REVIEW_HINT = (
    "after current-head CI succeeds and the PR is ready, run "
    "request-codex-review.sh #{pr} exactly once for this head, or ask Tim for a "
    "CodeRabbit request or a local review; a new head requires replacement CI and "
    "a new review"
)
REVIEW_REQUESTED_HINT = (
    "the manual Codex review for this head was already requested; wait for exact-head "
    "evidence and do not request the same head again; a new head requires replacement "
    "CI and one new request"
)

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
    "failed": 1,
    "stale": 1,
    "conflicting": 1,
    "action_required": 1,
    "timed_out": EXIT_UNDETERMINED,
    "undetermined": EXIT_UNDETERMINED,
}


def emit(msg: str) -> None:
    """Progress and diagnostics go to stderr; stdout is reserved for the verdict."""
    print(f"[{datetime.now():%H:%M:%S}] {msg}", file=sys.stderr, flush=True)


def gh(*args: str) -> str:
    """Run a gh CLI command, returning stdout. Raises RuntimeError on failure."""
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"gh {args[0]} failed")
    return result.stdout.strip()


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


# ---------------------------------------------------------------------------
# Readiness audit
# ---------------------------------------------------------------------------


def get_review_threads(pr: int) -> list[dict]:
    """Fetch every review thread for a PR, paginating via GraphQL cursor.

    The `after:` argument is omitted on the first page because GraphQL rejects
    empty strings for that input. Subsequent pages inline the cursor literally.
    """
    threads: list[dict] = []
    cursor: str | None = None
    while True:
        after_arg = f', after: "{cursor}"' if cursor else ""
        query = f"""
        query {{
          repository(owner: "{REPO_OWNER}", name: "{REPO_NAME}") {{
            pullRequest(number: {pr}) {{
              reviewThreads(first: 100{after_arg}) {{
                pageInfo {{ hasNextPage endCursor }}
                nodes {{ isResolved }}
              }}
            }}
          }}
        }}"""
        data = json.loads(gh("api", "graphql", "-f", f"query={query}"))
        rt = data["data"]["repository"]["pullRequest"]["reviewThreads"]
        threads.extend(rt["nodes"])
        if not rt["pageInfo"]["hasNextPage"]:
            return threads
        cursor = rt["pageInfo"]["endCursor"]


def review_summary(pr: int, *, timeout: float | None = None) -> dict:
    """The review summary for a PR, computed by the bash gate.

    `_review_summary` in scripts/workflow/_pr-gates.sh is the single implementation
    of review evidence — three checkers (CodeRabbit approval, Codex evidence, local
    attestation) and a four-word label. This watcher and the dashboard read its JSON
    instead of mirroring the logic, so no Python copy can drift from the merge gate.

    `timeout` bounds the gate's `gh` calls; the review-phase watcher passes what is
    left of its own deadline so a hung request cannot outlive the watch.
    """
    try:
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
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"_review_summary timed out after {timeout:.0f}s") from exc
    if result.returncode != 0:
        raise RuntimeError(
            f"_review_summary failed (exit {result.returncode}): {result.stderr.strip()}"
        )
    summary = json.loads(result.stdout)
    if not isinstance(summary, dict) or "label" not in summary:
        raise RuntimeError("_review_summary returned malformed JSON")
    return summary


def _checker_lines(summary: dict) -> str:
    head = str(summary.get("head") or "")[:7]
    names = {
        "coderabbit": "CodeRabbit",
        "codex": "Codex",
        "marker": "local attestation",
    }
    parts: list[str] = []
    for key, name in names.items():
        record = (summary.get("checkers") or {}).get(key) or {}
        verdict = record.get("verdict")
        if verdict == "covers":
            parts.append(f"{name}: covers head {head}")
        elif verdict == "changes_requested":
            parts.append(f"{name}: requested changes on head {head}")
        elif verdict == "stale":
            parts.append(
                f"{name}: newest evidence names {str(record.get('sha') or '')[:7]}, head is {head}"
            )
        else:
            parts.append(f"{name}: none")
    return "; ".join(parts)


def review_state(pr: int) -> tuple[str, str]:
    """Return (label, detail) for the current head.

    Labels are the gate's four words: approved, changes requested, stale review,
    not reviewed.
    """
    summary = review_summary(pr)
    label = str(summary.get("label") or "not reviewed")
    head = str(summary.get("head") or "")[:7]
    if label == "approved":
        coverage = summary.get("coverage") or {}
        who = {
            "coderabbit": "CodeRabbit approval",
            "codex": "Codex evidence",
            "marker": "local review attestation",
        }.get(str(coverage.get("checker")), "review")
        return label, f"{who} covers head {head}"
    lines = _checker_lines(summary)
    if summary.get("codex_request_pending"):
        return label, f"{lines}; {REVIEW_REQUESTED_HINT}"
    return label, f"{lines}; {REVIEW_HINT.format(pr=pr)}"


def _unresolved_threads(threads: list[dict]) -> int:
    """Count unresolved review threads, from any author.

    Author-agnostic since PP-4ric: the old Copilot-login filter would match
    nothing now that Copilot is retired, silently turning every thread check
    into a pass. Threads come from Tim or another agent, and AGENTS.md §5
    requires each to be fixed or declined-and-resolved either way.
    """
    return sum(1 for t in threads if not t["isResolved"])


def _select_ci_gate(rollup: list[dict]) -> dict | None:
    """Select the authoritative CI Gate from one current-head rollup.

    GitHub scopes statusCheckRollup to the PR's current head commit, but that
    commit can still carry MORE THAN ONE `CI Gate` entry — a re-run, or a run
    cancelled by a concurrency group, leaves its superseded check behind next to
    the live one. Select the entry with the most recent start time. Completion
    is only a fallback because an older run can finish cancelling after its
    replacement has already completed. (PP-r63o)
    """
    gates = [c for c in rollup if c.get("name") == CI_GATE_NAME]
    if not gates:
        return None
    return max(gates, key=lambda c: c.get("startedAt") or c.get("completedAt") or "")


def _ci_gate_state(pr: int) -> tuple[str, str]:
    """Return (status, conclusion) for the CI Gate check, or ("", "") if absent."""
    data = json.loads(gh("pr", "view", str(pr), "--json", "statusCheckRollup"))
    gate = _select_ci_gate(data.get("statusCheckRollup") or [])
    if gate is None:
        return "", ""
    return gate.get("status", ""), gate.get("conclusion", "")


def _fetch_merge_state(pr: int) -> tuple[str, set[str]]:
    """Fetch (mergeStateStatus, labels). Retries once if state is UNKNOWN.

    GitHub computes merge state lazily — the first probe often returns UNKNOWN
    and the same query a moment later returns the real value.
    """
    for attempt in range(2):
        data = json.loads(
            gh("pr", "view", str(pr), "--json", "mergeStateStatus,labels")
        )
        merge_state = data["mergeStateStatus"]
        labels = {lbl["name"] for lbl in data["labels"]}
        if merge_state != "UNKNOWN" or attempt == 1:
            return merge_state, labels
        time.sleep(2)
    return "UNKNOWN", set()


def run_audit(pr: int) -> bool:
    """Print a pass/fail report for review-readiness. Return True if all pass."""
    merge_state, labels = _fetch_merge_state(pr)
    ci_status, ci_conclusion = _ci_gate_state(pr)
    unresolved = _unresolved_threads(get_review_threads(pr))

    bad_merge = merge_state in ("DIRTY", "CONFLICTING", "BEHIND")
    merge_detail = f"mergeStateStatus={merge_state}"

    if not ci_status:
        ci_check = (False, "CI Gate check not found")
    elif ci_status != "COMPLETED":
        ci_check = (False, f"in progress (status={ci_status})")
    elif _is_superseded(ci_conclusion):
        # Not a failure, but not a green gate either — the PR genuinely isn't
        # ready until a replacement run posts one. Say why, so the reader
        # pushes/re-runs rather than hunting for a broken test. (PP-r63o)
        ci_check = (False, "cancelled (superseded) — needs a re-run or a new push")
    else:
        ci_check = (
            _is_passing(ci_conclusion),
            f"conclusion={ci_conclusion or 'unknown'}",
        )

    # ready-for-review is informational — orchestrator applies it after the
    # audit passes, so its absence isn't a failure.
    label_detail = (
        "applied" if READY_LABEL in labels else "not applied (orchestrator applies)"
    )

    # Reported, but NOT part of the verdict. This mode answers "can this head leave
    # draft and become eligible for a manual review request?"; gating on review here
    # would make the check
    # circular and permanently red. merge-pr.sh's `reviewed` gate refuses to merge an
    # unreviewed head. A stale review is worth seeing here anyway: it means the PR
    # looks reviewed and is not.
    try:
        state, review_detail = review_state(pr)
    except (RuntimeError, ValueError, KeyError) as exc:
        state, review_detail = "unknown", f"could not determine ({exc})"

    checks = [
        (not bad_merge, "mergeable", merge_detail),
        (ci_check[0], "ci-gate", ci_check[1]),
        (True, "review", f"{state}: {review_detail}"),
        (
            unresolved == 0,
            "threads-resolved",
            "all resolved"
            if unresolved == 0
            else f"{unresolved} unresolved (use MCP pull_request_read to inspect threads)",
        ),
        (True, "ready-label", label_detail),
    ]

    all_ok = all(ok for ok, _, _ in checks)
    print(f"Readiness audit for PR #{pr}: {'PASS' if all_ok else 'FAIL'}")
    for ok, label, detail in checks:
        print(f"  {'✓' if ok else '✗'} {label}: {detail}")
    return all_ok


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

    This lookup happens only after the aggregate CI Gate is red. The ordinary
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
    review_state: str = "not reviewed"
    unresolved_threads: int = 0
    merge_state: str = "UNKNOWN"
    detail_url: str | None = None
    failure_artifact: str | None = None


def _verdict(outcome: str, detail: str, **fields) -> Verdict:
    emit(detail)
    return Verdict(outcome, **fields)


def _current_phase_ci_snapshot(pr: int) -> tuple[str, dict | None, str]:
    """Fetch head, authoritative CI Gate, and merge state in one API query.

    Keeping them in one response is the exact-head boundary: a push cannot
    interleave between separate head and check reads. GitHub reports
    mergeStateStatus UNKNOWN while it recomputes mergeability (after any push
    to main); that is "no conflict seen yet", not an error — the merge gate
    re-checks conflicts before merging.
    """
    raw = gh(
        "pr",
        "view",
        str(pr),
        "--json",
        "headRefOid,statusCheckRollup,mergeStateStatus",
    )
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("GitHub returned invalid PR metadata")
    head_sha = str(data.get("headRefOid") or "")
    gate = _select_ci_gate(data.get("statusCheckRollup") or [])
    merge_state = str(data.get("mergeStateStatus") or "UNKNOWN")
    return head_sha, gate, merge_state


def _current_head_merge_snapshot(pr: int) -> tuple[str, str]:
    """Fetch head and merge state atomically (UNKNOWN means not yet computed)."""
    raw = gh("pr", "view", str(pr), "--json", "headRefOid,mergeStateStatus")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("GitHub returned invalid PR metadata")
    head_sha = str(data.get("headRefOid") or "")
    merge_state = str(data.get("mergeStateStatus") or "UNKNOWN")
    return head_sha, merge_state


def _head_problem(
    head_sha: str, merge_state: str, expected_head: str, watch: str
) -> Verdict | None:
    """End a watch whose pinned head is unknown, moved, or conflicted."""
    if not head_sha:
        return _verdict(
            "undetermined", f"⚠  Could not determine {watch} state — PR head was empty."
        )
    if head_sha != expected_head:
        return _verdict(
            "stale",
            f"PR head moved {expected_head[:7]} → {head_sha[:7]} — {watch} watch is stale",
            observed_head=head_sha,
            merge_state=merge_state,
        )
    if merge_state in CONFLICT_STATES:
        return _verdict(
            "conflicting",
            f"PR merge state is {merge_state} — conflict must be resolved",
            observed_head=head_sha,
            merge_state=merge_state,
        )
    return None


def _watch_phase_ci(
    pr: int,
    expected_head: str,
    *,
    timeout_sec: float = WATCH_TIMEOUT_SECONDS,
    poll_sec: float = WATCH_POLL_SECONDS,
) -> Verdict:
    """Watch the CI Gate for one pinned head, one GitHub query per interval."""
    deadline = time.monotonic() + timeout_sec
    superseded_deadline: float | None = None
    last_signature: tuple[str, str] | None = None
    seen: dict = {}

    while time.monotonic() < deadline:
        try:
            head_sha, gate, merge_state = _current_phase_ci_snapshot(pr)
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
        seen = {
            "observed_head": head_sha,
            "ci_gate": conclusion or status or "UNKNOWN",
            "merge_state": merge_state,
            "detail_url": details_url or None,
        }
        if (status, conclusion) != last_signature:
            emit(
                f"CI Gate {status.lower() or 'not yet posted'} on {head_sha[:7]}"
                + (f" ({conclusion})" if conclusion else "")
            )
            last_signature = (status, conclusion)

        if status == "COMPLETED":
            if _is_passing(conclusion):
                return _verdict(
                    "passed",
                    f"CI Gate passed on {head_sha[:7]} (conclusion={conclusion}) ✓",
                    **seen,
                )
            if not _is_superseded(conclusion):
                emit(
                    f"CI Gate failed on {head_sha[:7]} "
                    f"(conclusion={conclusion or 'unknown'})"
                )
                artifact: str | None = None
                try:
                    run_id = _failed_ci_run_id(head_sha, details_url)
                    if run_id is not None:
                        artifact = write_failure_artifact(run_id)
                        emit(f"Failure details: {artifact}")
                except (RuntimeError, json.JSONDecodeError, OSError, ValueError) as exc:
                    emit(f"Failure logs unavailable: {exc}")
                return Verdict("failed", failure_artifact=artifact, **seen)
            if superseded_deadline is None:
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


def _watch_phase_review(
    pr: int,
    expected_head: str,
    *,
    timeout_sec: float = WATCH_TIMEOUT_SECONDS,
    poll_sec: float = WATCH_POLL_SECONDS,
) -> Verdict:
    """Watch review coverage and threads for one pinned head.

    passed: the gate label is `approved` with 0 unresolved threads.
    action_required: `approved` with unresolved threads, or `changes requested`.
    `not reviewed` and `stale review` keep waiting until the deadline.
    """
    deadline = time.monotonic() + timeout_sec
    last_label: str | None = None
    seen: dict = {}

    def pinned_problem() -> Verdict | None:
        head_sha, merge_state = _current_head_merge_snapshot(pr)
        seen["merge_state"] = merge_state
        return _head_problem(head_sha, merge_state, expected_head, "review")

    def read_evidence() -> dict:
        # One gate call answers coverage, label, and unresolved threads together,
        # bounded by whatever is left of the watch deadline.
        return review_summary(pr, timeout=max(1.0, deadline - time.monotonic()))

    while time.monotonic() < deadline:
        summary: dict = {}
        try:
            # `_review_summary` reads the live head itself, so each evidence read
            # is bracketed by pinned-head checks.
            problem = pinned_problem()
            if problem is None:
                summary = read_evidence()
                problem = pinned_problem()
            if problem is None and summary.get("label") in (
                "approved",
                "changes requested",
            ):
                # Revalidate before a terminal verdict: a thread can open
                # between the first read and the verdict.
                summary = read_evidence()
                problem = pinned_problem()
        except (RuntimeError, json.JSONDecodeError) as exc:
            return _verdict(
                "undetermined", f"⚠  Could not determine review state — {exc}", **seen
            )
        if problem is not None:
            return problem

        label = str(summary.get("label") or "not reviewed")
        unresolved = int(summary.get("unresolved_threads") or 0)
        seen.update(
            observed_head=expected_head,
            review_state=label,
            unresolved_threads=unresolved,
        )
        head = expected_head[:7]
        if label == "approved" and unresolved == 0:
            return _verdict(
                "passed",
                f"Review coverage complete on {head} ({label}) with 0 unresolved threads ✓",
                **seen,
            )
        if label == "approved":
            return _verdict(
                "action_required",
                f"Review coverage present on {head} ({label}), "
                f"but {unresolved} unresolved thread(s) require action",
                **seen,
            )
        if label == "changes requested":
            return _verdict(
                "action_required",
                f"Changes requested on {head} ({_checker_lines(summary)})",
                **seen,
            )
        if label != last_label:
            emit(f"Review pending on {head}: {label}")
            last_label = label

        time.sleep(poll_sec)

    return _verdict(
        "timed_out",
        f"⚠  Could not determine review state — no terminal verdict within {timeout_sec}s.",
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
    parser.add_argument("--phase", choices=("ci", "review"), help="phase to wait on")
    parser.add_argument(
        "--expected-head",
        type=_full_sha,
        metavar="SHA",
        help="full head SHA the watch is pinned to",
    )
    parser.add_argument(
        "--check-ready",
        action="store_true",
        help="print a review-readiness snapshot and exit",
    )
    args = parser.parse_args(argv)
    if args.check_ready and (args.phase or args.expected_head):
        parser.error("--check-ready does not take --phase or --expected-head")
    if not args.check_ready and not (args.phase and args.expected_head):
        parser.error("a watch needs both --phase and --expected-head")
    return args


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.check_ready:
        return 0 if run_audit(args.pr) else 1

    watch = _watch_phase_ci if args.phase == "ci" else _watch_phase_review
    verdict = watch(args.pr, args.expected_head)
    artifact = verdict.failure_artifact
    payload = {
        "schema_version": 1,
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
