#!/usr/bin/env python3
"""PR CI watcher for the Claude Code Monitor tool.

Streams timestamped events to stdout as GitHub Actions runs complete.

Usage: ./scripts/workflow/pr-watch.py [--check-ready | --force] [--verbose] <PR_NUMBER>
  (no flag)      Run blocking pre-checks (mergeable, no failed CI Gate, no
                 unresolved review threads), then watch CI. CI Gate absent
                 or in-progress is NOT a blocking condition — the watch
                 loop handles those by waiting.
  --check-ready  Run the full readiness check (mergeable + CI Gate present
                 + review threads resolved + ready label) and exit. CI
                 Gate absent IS a fail here — this mode answers "is this
                 PR ready for human review right now?". The `review` line
                 is reported but is NOT part of the verdict: the whole
                 point of this mode is to decide whether the PR is worth
                 Tim's review, so requiring the review to have
                 already happened would be circular. `merge-pr.sh`'s
                 `reviewed` gate is what refuses to merge an unreviewed
                 head.
  --force        Skip the pre-check entirely and watch unconditionally.
  --verbose      Emit per-job progressive updates ("X passed", "CI Gate
                 in_progress — continuing to wait", "Watching PR #N — N
                 run(s)", per-run icon listing, startup retries). Default
                 behavior is quiet — only terminal verdicts (CI Gate
                 decided, check PASS/FAIL) and action items (failure
                 details) are emitted, so that running under Claude
                 Code's Monitor doesn't wake the agent on every job
                 transition.

Cancelled runs are neither a pass nor a failure — they are reported as
"superseded" (⊘) and never produce a failure artifact. Cancellation is routine
here: pushing a second commit cancels the in-flight run via concurrency groups,
and the Preview Auto-Resync workflow cancels itself the same way. (PP-r63o)

A gh API error while probing a run (rate-limit 403, network drop, auth failure)
is likewise not a failure — it means we could not find out. Those probes are
retried with bounded backoff and, if the API stays unreachable, reported as
"could not determine" (⚠) with the real cause, never as "✗ failed". (PP-qkl8)

Exit 0: all checks passed, or (with --check-ready) the PR is ready for
        human review.
Exit 1: one or more checks failed, no matching runs found,
        or (with --check-ready) the PR is not ready.
Exit 2: the outcome could not be determined — the GitHub API was unreachable.
        Nothing was observed, so this is neither a pass nor a failure.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

REPO_OWNER = "timothyfroehlich"
REPO_NAME = "PinPoint"
READY_LABEL = "ready-for-review"
CI_GATE_NAME = "CI Gate"
CODEX_REVIEW_BOT = "chatgpt-codex-connector[bot]"
CODEX_REVIEW_APP_SLUG = "chatgpt-codex-connector"
CODEX_CLEAN_REVIEW_PREFIX = "Codex Review: Didn't find any major issues."
GITHUB_ACTIONS_BOT = "github-actions[bot]"
GITHUB_ACTIONS_APP_SLUG = "github-actions"
CODEX_REACTION_WITNESS_PREFIX = "<!-- pinpoint-codex-reaction-witness:"
REVIEW_MARKER_PREFIX = "<!-- pinpoint-review:"
LEGACY_CLAUDE_MARKER_PREFIX = "<!-- pinpoint-claude-review:"

# --- Review state ---------------------------------------------------------------
# Kept deliberately in sync with scripts/workflow/_pr-gates.sh. This watcher only
# reports the state; merge-pr.sh is the enforcement point.
REVIEW_HINT = (
    "await automatic Codex review of PR #{pr} at the current head; use @codex review "
    "only when Tim explicitly requests it"
)

STARTUP_RETRIES = 6  # attempts to find runs for current SHA
STARTUP_WAIT = 10  # seconds between startup retries
LOG_DIR = "tmp/gh-monitor"

# How long to keep polling for a replacement CI Gate after the current one came
# back cancelled. A cancel almost always means a newer run is already queued;
# this bounds the wait so a genuinely abandoned run still terminates.
SUPERSEDED_GATE_GRACE = 180  # seconds

# How many times to re-probe a run's state when the gh call itself fails, and
# the first backoff (doubling each attempt: 5s, 10s, 20s → ~35s total). The
# retry is there to ride out a blip; a user-level rate limit resets on the hour,
# so retrying past this is pointless — better to stop and say why. (PP-qkl8)
RUN_STATE_ATTEMPTS = 4
RUN_STATE_BACKOFF = 5  # seconds
EXIT_UNDETERMINED = 2

_lock = threading.Lock()

# Set by main() from --verbose flag. When False (the default), emit_event() is
# a no-op so the script only emits terminal verdicts and action items. This
# keeps pr-watch quiet under Claude Code's Monitor — each emit line becomes a
# notification cycle, so progressive per-job updates wake the agent for events
# that don't change what the user would do next. Pass --verbose for full output
# when running interactively.
VERBOSE_MODE = False


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def emit(msg: str) -> None:
    with _lock:
        print(f"[{ts()}] {msg}", flush=True)


def emit_event(msg: str) -> None:
    """Emit a non-terminal progressive event. Suppressed unless --verbose.

    Use this for per-job transitions, startup announcements, and other
    informational lines that are useful interactively but noisy when the
    script is invoked under Monitor (each stdout line is a notification).
    Reserve emit() for terminal verdicts (CI Gate decided, audit PASS/FAIL)
    and action items (failure details).
    """
    if VERBOSE_MODE:
        emit(msg)


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
# it as a failure produced false "✗ CI — failed" alarms and, worse, hard-exited
# the watcher on every subsequent invocation at the same head SHA. (PP-r63o)
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


def _gh_api_list(path: str) -> list[dict]:
    """GET a paginated GitHub list endpoint, returning every item.

    `gh api --paginate` emits ONE JSON document per page, so json.loads on the
    whole stream fails from page 2 onward. Decode documents until the buffer is
    exhausted and flatten.
    """
    raw = gh("api", "--paginate", f"{path}?per_page=100")
    decoder = json.JSONDecoder()
    items: list[dict] = []
    idx = 0
    while idx < len(raw):
        while idx < len(raw) and raw[idx].isspace():
            idx += 1
        if idx >= len(raw):
            break
        doc, end = decoder.raw_decode(raw, idx)
        if isinstance(doc, list):
            items.extend(doc)
        idx = end
    return items


def _codex_reviews(pr: int) -> list[dict]:
    """Return trusted Codex reviews in submission order."""
    repo = f"repos/{REPO_OWNER}/{REPO_NAME}"
    reviews = [
        review
        for review in _gh_api_list(f"{repo}/pulls/{pr}/reviews")
        if review.get("user", {}).get("login") == CODEX_REVIEW_BOT
    ]
    return sorted(reviews, key=lambda review: review.get("submitted_at") or "")


def _comment_review_records(
    pr: int,
) -> tuple[list[tuple[str, str, str]], list[tuple[str, str]]]:
    """Return SHA-pinned automatic comments and independent manual markers."""
    repo = f"repos/{REPO_OWNER}/{REPO_NAME}"
    automatic: list[tuple[str, str, str]] = []
    markers: list[tuple[str, str]] = []
    for comment in _gh_api_list(f"{repo}/issues/{pr}/comments"):
        body = comment.get("body") or ""
        app = comment.get("performed_via_github_app") or {}
        first_line = body.splitlines()[0] if body else ""
        if (
            comment.get("user", {}).get("login") == CODEX_REVIEW_BOT
            and app.get("slug") == CODEX_REVIEW_APP_SLUG
            and first_line.startswith(CODEX_CLEAN_REVIEW_PREFIX)
            and (
                match := re.search(
                    r"^\*\*Reviewed commit:\*\* `([0-9a-f]{10}|[0-9a-f]{40})`$",
                    body,
                    re.MULTILINE,
                )
            )
        ):
            automatic.append(
                (
                    "clean_comment",
                    match.group(1),
                    comment.get("updated_at") or comment.get("created_at") or "",
                )
            )
        if (
            comment.get("user", {}).get("login") == GITHUB_ACTIONS_BOT
            and app.get("slug") == GITHUB_ACTIONS_APP_SLUG
            and body.startswith(CODEX_REACTION_WITNESS_PREFIX)
            and (
                match := re.match(
                    r"^<!-- pinpoint-codex-reaction-witness: ([0-9a-f]{40}) -->",
                    body,
                )
            )
        ):
            automatic.append(
                (
                    "clean_reaction",
                    match.group(1),
                    comment.get("updated_at") or comment.get("created_at") or "",
                )
            )
        if body.startswith(REVIEW_MARKER_PREFIX):
            markers.append(
                (
                    body[len(REVIEW_MARKER_PREFIX) :].split("-->", 1)[0].strip(),
                    comment.get("updated_at") or "",
                )
            )
        elif body.startswith(LEGACY_CLAUDE_MARKER_PREFIX):
            markers.append(
                (
                    body[len(LEGACY_CLAUDE_MARKER_PREFIX) :].split("-->", 1)[0].strip(),
                    comment.get("updated_at") or "",
                )
            )
    return automatic, markers


def review_state(pr: int) -> tuple[str, str]:
    """Return the current-head state across both valid review paths."""
    head_sha = json.loads(gh("pr", "view", str(pr), "--json", "headRefOid"))[
        "headRefOid"
    ]
    reviews = _codex_reviews(pr)
    if reviews:
        head_reviews = [
            review for review in reviews if (review.get("commit_id") or "") == head_sha
        ]
        latest = head_reviews[-1] if head_reviews else reviews[-1]
        review_sha = latest.get("commit_id") or ""
        state = (latest.get("state") or "UNKNOWN").upper()
        if state == "APPROVED" and review_sha == head_sha:
            return "approval", f"Codex approved head {head_sha[:7]}"

    # A current native approval is sufficient. Defer the paginated comments request
    # unless it is needed to find the independent manual-attestation fallback.
    automatic_comments, markers = _comment_review_records(pr)
    if any(marker_sha == head_sha for marker_sha, _at in markers):
        return "marker", f"manual review marker pins head {head_sha[:7]}"

    current_clean = max(
        (
            record
            for record in automatic_comments
            if (record[0] == "clean_comment" and head_sha.startswith(record[1]))
            or (record[0] == "clean_reaction" and record[1] == head_sha)
        ),
        key=lambda record: record[2],
        default=("", "", ""),
    )
    if current_clean[1]:
        clean_state, clean_sha, clean_at = current_clean
        if (
            not reviews
            or review_sha != head_sha
            or clean_at > (latest.get("submitted_at") or "")
        ):
            if clean_state == "clean_reaction":
                return (
                    clean_state,
                    f"Codex clean reaction witnessed on head {head_sha[:7]}",
                )
            return clean_state, f"Codex found no major issues on head {clean_sha}"

    if (
        reviews
        and review_sha == head_sha
        and state in {"COMMENTED", "CHANGES_REQUESTED"}
    ):
        return (
            "reviewed",
            f"Codex reviewed head {head_sha[:7]} with {state}; thread gate owns findings",
        )

    latest_marker_sha, latest_marker_at = max(
        markers, key=lambda marker: marker[1], default=("", "")
    )
    latest_clean_state, latest_clean_sha, latest_clean_at = max(
        automatic_comments, key=lambda record: record[2], default=("", "", "")
    )
    latest_comment_sha, latest_comment_at, latest_comment_state = (
        (latest_marker_sha, latest_marker_at, "stale_marker")
        if latest_marker_at > latest_clean_at
        else (
            latest_clean_sha,
            latest_clean_at,
            "stale_clean_reaction"
            if latest_clean_state == "clean_reaction"
            else "stale_clean_comment",
        )
    )
    if reviews:
        if latest_comment_sha and latest_comment_at > (
            latest.get("submitted_at") or ""
        ):
            return (
                latest_comment_state,
                f"review record pins {latest_comment_sha[:7]} but head is {head_sha[:7]}",
            )
        if state == "APPROVED":
            return (
                "stale_approval",
                f"Codex approved {review_sha[:7]} but head is {head_sha[:7]} — "
                f"{REVIEW_HINT.format(pr=pr)}",
            )
        return (
            "not_approved",
            f"Codex last reviewed {review_sha[:7]} with {state}, not APPROVED; "
            f"{REVIEW_HINT.format(pr=pr)}",
        )
    if latest_marker_sha:
        return (
            "stale_marker",
            f"manual review marker pins {latest_marker_sha[:7]} but head is {head_sha[:7]}",
        )
    if latest_clean_sha:
        return (
            "stale_clean_comment",
            f"Codex clean result covers {latest_clean_sha[:7]} but head is {head_sha[:7]}",
        )
    return (
        "unreviewed",
        f"no Codex review or manual attestation — head {head_sha[:7]} is unreviewed; "
        f"{REVIEW_HINT.format(pr=pr)}",
    )


def _unresolved_threads(threads: list[dict]) -> int:
    """Count unresolved review threads, from any author.

    Author-agnostic since PP-4ric: the old Copilot-login filter would match
    nothing now that Copilot is retired, silently turning every thread check
    into a pass. Threads come from Tim or another agent, and AGENTS.md "Review comments"
    requires each to be fixed or declined-and-resolved either way.
    """
    return sum(1 for t in threads if not t["isResolved"])


def _current_ci_gate(pr: int) -> dict | None:
    """Return the authoritative CI Gate check for GitHub's current PR head.

    GitHub scopes statusCheckRollup to the PR's current head commit, but that
    commit can still carry MORE THAN ONE `CI Gate` entry — a re-run, or a run
    cancelled by a concurrency group, leaves its superseded check behind next to
    the live one. Returning the first match let a cancelled leftover shadow the
    run we actually care about, so prefer a non-superseded entry and, among
    equals, the most recent one. (PP-r63o)
    """
    raw = gh("pr", "view", str(pr), "--json", "statusCheckRollup")
    rollup = json.loads(raw).get("statusCheckRollup", [])
    gates = [c for c in rollup if c.get("name") == CI_GATE_NAME]
    if not gates:
        return None

    def rank(check: dict) -> tuple[int, str]:
        not_superseded = 0 if _is_superseded(check.get("conclusion")) else 1
        when = check.get("completedAt") or check.get("startedAt") or ""
        return not_superseded, when

    return max(gates, key=rank)


def _ci_gate_completed_at(pr: int) -> str:
    """Return the passing current-head CI Gate completion time, if available."""
    gate = _current_ci_gate(pr)
    if (
        gate is None
        or (gate.get("status") or "").upper() != "COMPLETED"
        or not _is_passing(gate.get("conclusion"))
    ):
        return ""
    return gate.get("completedAt") or gate.get("startedAt") or ""


def _ci_gate_state(pr: int) -> tuple[str, str]:
    """Return (status, conclusion) for the CI Gate check, or ("", "") if absent."""
    gate = _current_ci_gate(pr)
    if gate is None:
        return "", ""
    return gate.get("status", ""), gate.get("conclusion", "")


def _finalize_via_ci_gate(pr: int, timeout_sec: int = 1200, poll_sec: int = 10) -> int:
    """Anchor exit status on the CI Gate aggregate check, not the visible workflow runs.

    The "any completed run with no failures" heuristic produces false greens when
    side workflows (e.g. the on-demand Preview Controller) finish before the main
    CI workflow has been queued. Wait for CI Gate to actually report a conclusion;
    only then return 0 (success/neutral) or 1 (anything else, or timeout).
    """
    deadline = time.monotonic() + timeout_sec
    last_status = ""
    superseded_deadline: float | None = None
    while time.monotonic() < deadline:
        status, conclusion = _ci_gate_state(pr)
        if status == "COMPLETED":
            # Match run_audit's pass criteria (SUCCESS / NEUTRAL / SKIPPED) so
            # the watcher and the audit can't disagree on the same CI Gate state.
            if _is_passing(conclusion):
                emit(f"CI Gate passed (conclusion={conclusion}) ✓")
                return 0
            if _is_superseded(conclusion):
                # Cancelled is neither pass nor fail. A replacement run is
                # normally already queued, so give it a bounded grace period to
                # post a fresh CI Gate rather than declaring failure. (PP-r63o)
                if superseded_deadline is None:
                    superseded_deadline = time.monotonic() + SUPERSEDED_GATE_GRACE
                    emit_event(
                        "CI Gate cancelled (superseded) — waiting for a replacement run"
                    )
                elif time.monotonic() >= superseded_deadline:
                    emit(
                        "⊘  CI Gate cancelled (superseded) — no replacement run appeared"
                    )
                    return 1
                time.sleep(poll_sec)
                continue
            emit(f"CI Gate failed (conclusion={conclusion or 'unknown'})")
            return 1
        # A fresh run posted a new gate — restart the supersession grace clock.
        superseded_deadline = None
        if status != last_status:
            emit_event(
                f"CI Gate {status.lower() or 'not yet posted'} — continuing to wait"
            )
            last_status = status
        time.sleep(poll_sec)
    emit(f"CI Gate did not report within {timeout_sec}s — treat as failure")
    return 1


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


def _pre_check_blocking(pr: int) -> tuple[bool, str]:
    """Return (True, "") if no blocking conditions are present, else (False, reason).

    Used by the default watch mode as a fail-fast pre-check BEFORE entering the
    watch loop. Distinguishes conditions that won't resolve by waiting (bad merge
    state, already-failed CI Gate) from conditions that the watch loop is
    designed to wait through (CI Gate not yet posted, CI Gate in progress). The
    latter MUST pass this pre-check so the watch loop can fire and
    `_finalize_via_ci_gate` can poll for completion.

    Unresolved review threads are reported but do NOT block — watching CI is a
    step *inside* the address-the-findings loop, not after it.

    Readiness-check mode (run_audit, --check-ready) keeps its stricter
    semantics — there, CI-Gate-absent IS correctly a "no, not ready right now".
    """
    merge_state, _labels = _fetch_merge_state(pr)
    if merge_state in ("DIRTY", "CONFLICTING", "BEHIND"):
        return False, f"merge state {merge_state} — resolve before watching"

    ci_status, ci_conclusion = _ci_gate_state(pr)
    if ci_status == "COMPLETED":
        if _is_superseded(ci_conclusion):
            # Cancelled is not failed. A newer commit — or a self-cancelling
            # side workflow like Preview Auto-Resync — superseded this gate;
            # the watch loop waits for the replacement instead of hard-exiting.
            # Before PP-r63o this forced --force as a workaround.
            emit_event("CI Gate cancelled (superseded) — watching for a fresh run")
        elif _is_failing(ci_conclusion):
            return (
                False,
                f"CI Gate already failed (conclusion={ci_conclusion or 'unknown'})",
            )

    unresolved = _unresolved_threads(get_review_threads(pr))
    if unresolved > 0:
        # A notice, not a block. Threads are author-agnostic since PP-4ric, so
        # these are Tim's /code-review findings, and the documented loop is
        # fix → push → watch CI → resolve once it is green. Blocking here would
        # refuse to watch the very push that addresses them, leaving --force as
        # the only way through — which also drops the merge-state and
        # already-failed-CI pre-checks that are worth keeping. `merge-pr.sh`'s
        # `threads` gate is what actually refuses to merge on an open thread,
        # and --check-ready still reports one as not-ready.
        # emit(), not emit_event(): this is an action item the agent still owes,
        # not per-job progress noise, so it must survive non-verbose runs.
        emit(f"{unresolved} unresolved review thread(s) — resolve before merge")

    return True, ""


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
    # draft and enter automatic review?"; gating on review here would make the check
    # circular and permanently red. merge-pr.sh's `reviewed` gate refuses to merge an
    # unreviewed head. A stale Codex approval is worth seeing here anyway: it means the
    # PR looks reviewed and is not.
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
    emit(f"Readiness audit for PR #{pr}: {'PASS' if all_ok else 'FAIL'}")
    for ok, label, detail in checks:
        emit(f"  {'✓' if ok else '✗'} {label}: {detail}")
    return all_ok


# ---------------------------------------------------------------------------
# CI run watcher
# ---------------------------------------------------------------------------


class RunStateUnavailable(RuntimeError):
    """The GitHub API could not be reached to determine a run's state.

    Distinct from "the run reported a bad conclusion". Before PP-qkl8 the two
    were collapsed: a failed `gh run view` returned ("", ""), which fell through
    to the fail-safe branch and emitted "✗ — failed" plus a failure artifact for
    a run that was, in the observed case, perfectly healthy and still pending.
    """


def _run_conclusion(run_id: int) -> tuple[str, str]:
    """Return (status, conclusion) for a run.

    Raises RunStateUnavailable if the gh call itself failed — a rate-limit 403,
    a network drop, an expired token. That is "we could not find out", which is
    not a verdict about the run and must never be reported as one.

    The two failure modes are decoded separately so the reason carried up is
    actionable: a bare "Expecting value: line 1 column 1" tells the reader
    nothing, so unparseable output is quoted back with the raw prefix.
    """
    try:
        raw = gh("run", "view", str(run_id), "--json", "status,conclusion")
    except RuntimeError as exc:
        raise RunStateUnavailable(str(exc) or "gh run view failed") from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RunStateUnavailable(
            f"gh run view returned unparseable output ({exc}): {raw[:120]!r}"
        ) from exc
    return data.get("status") or "", data.get("conclusion") or ""


def _run_conclusion_retrying(
    run_id: int, name: str, stop: threading.Event
) -> tuple[str, str]:
    """_run_conclusion with bounded exponential backoff on API errors.

    Re-raises RunStateUnavailable once the attempts are exhausted, so the caller
    still has to decide what an undeterminable run means — it just gets to make
    that decision after the API has had a fair chance to come back.
    """
    delay = RUN_STATE_BACKOFF
    for attempt in range(RUN_STATE_ATTEMPTS):
        try:
            return _run_conclusion(run_id)
        except RunStateUnavailable as exc:
            if attempt == RUN_STATE_ATTEMPTS - 1 or stop.is_set():
                raise
            emit_event(f"↻  {name} — gh API error ({exc}); retrying in {delay}s")
            if stop.wait(delay):
                raise
            delay *= 2
    raise AssertionError("unreachable")  # pragma: no cover — loop always exits


def watch_run(
    run_id: int,
    name: str,
    stop: threading.Event,
    failures: list[int],
    undetermined: list[tuple[str, str]],
) -> None:
    """Watch one CI run via gh run watch. Retries if watcher exits prematurely.

    Appends to `failures` only for an observed bad conclusion. When the run's
    state could not be read at all, appends (name, reason) to `undetermined`
    instead — the caller reports that as an inability to determine, not as a
    failure, and writes no failure artifact. (PP-qkl8)
    """
    while not stop.is_set():
        with subprocess.Popen(
            ["gh", "run", "watch", str(run_id), "--exit-status"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ) as proc:
            while proc.poll() is None:
                if stop.is_set():
                    proc.terminate()
                    try:
                        proc.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                    return
                time.sleep(0.5)

        if stop.is_set():
            return

        # Verify via API regardless of exit code — gh run watch can exit 0
        # prematurely if jobs haven't been assigned yet when the watcher starts.
        try:
            status, conclusion = _run_conclusion_retrying(run_id, name, stop)
        except RunStateUnavailable as exc:
            if stop.is_set():
                return
            emit_event(
                f"⚠  {name} — could not determine run state after "
                f"{RUN_STATE_ATTEMPTS} attempts: {exc}"
            )
            with _lock:
                undetermined.append((name, str(exc)))
            return

        if proc.returncode == 0 and status not in ("queued", "in_progress"):
            if _is_passing(conclusion):
                emit_event(f"✓  {name} — passed")
                return
            # Exited 0 but API says non-passing — fall through to failure handling.

        # gh run watch exited non-zero — verify via API before declaring failure.
        # It can crash or disconnect while the run is still in progress.

        if status in ("queued", "in_progress"):
            # Watcher crashed prematurely — restart it.
            emit_event(f"↻  {name} — watcher restarted (run still in progress)")
            continue

        if _is_passing(conclusion):
            emit_event(f"✓  {name} — passed")
            return

        if _is_superseded(conclusion):
            # Neither pass nor fail — a newer commit, or a self-cancelling side
            # workflow, superseded this run. There is no failed step to log, so
            # record no failure and write no artifact. (PP-r63o)
            emit_event(f"⊘  {name} — superseded (cancelled)")
            return

        # Confirmed failure (or unrecognised conclusion — fail safe).
        emit(f"✗  {name} — failed")
        with _lock:
            failures.append(run_id)
        return


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
        f.write(f"Run ID: {run_id}\nGenerated: {now}\n\n")
        f.write(f"## Failed Steps Log\n\n```text\n{log_tail}\n```\n\n")
        summary_text = summary.stdout or "(no summary available)"
        f.write(f"## Run Summary\n\n```text\n{summary_text}\n```\n")

    return path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str]) -> tuple[int, bool, bool, bool] | None:
    """Return (pr, check_ready, force, verbose) or None on usage error."""
    check_ready = "--check-ready" in argv
    force = "--force" in argv
    verbose = "--verbose" in argv
    rest = [a for a in argv[1:] if a not in ("--check-ready", "--force", "--verbose")]
    if check_ready and force:
        print(
            "Error: --check-ready and --force are mutually exclusive.", file=sys.stderr
        )
        return None
    if len(rest) != 1 or not rest[0].isdigit():
        print(
            f"Usage: {argv[0]} [--check-ready | --force] [--verbose] <PR_NUMBER>",
            file=sys.stderr,
        )
        return None
    return int(rest[0]), check_ready, force, verbose


def main() -> int:
    parsed = _parse_args(sys.argv)
    if parsed is None:
        return 1
    pr, check_ready, force, verbose = parsed

    global VERBOSE_MODE
    VERBOSE_MODE = verbose

    if check_ready:
        return 0 if run_audit(pr) else 1

    if not force:
        blocking_ok, reason = _pre_check_blocking(pr)
        if not blocking_ok:
            emit(f"Pre-check failed: {reason}")
            return 1

    try:
        pr_data = json.loads(
            gh("pr", "view", str(pr), "--json", "headRefName,headRefOid")
        )
    except (RuntimeError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    branch = pr_data["headRefName"]
    head_sha = pr_data["headRefOid"]

    active: list[dict] = []
    runs: list[dict] = []
    announced_superseded: set[int] = set()
    for attempt in range(STARTUP_RETRIES):
        runs = json.loads(
            gh(
                "run",
                "list",
                "--limit",
                "50",
                "--branch",
                branch,
                "--json",
                "databaseId,status,conclusion,name,headSha",
            )
        )
        # Every scan below is scoped to the CURRENT head SHA. `gh run list`
        # returns the branch's whole recent history, so an older commit's run —
        # in particular one cancelled when this commit superseded it — must
        # never influence the verdict for the commit we're watching. (PP-r63o)
        sha_runs = [r for r in runs if r["headSha"] == head_sha]
        active = [r for r in sha_runs if r["status"] in ("queued", "in_progress")]

        # Fail fast if any run for this SHA already completed with a real
        # failure (e.g., a fast lint job failed before we started watching).
        # Cancelled runs are excluded — they're superseded, not failed.
        completed = [r for r in sha_runs if r["status"] == "completed"]
        for r in completed:
            if _is_superseded(r.get("conclusion")) and r["databaseId"] not in (
                announced_superseded
            ):
                announced_superseded.add(r["databaseId"])
                emit_event(f"⊘  {r['name']} — superseded (cancelled)")
        early_failures = [r for r in completed if _is_failing(r.get("conclusion"))]
        if early_failures:
            for r in early_failures:
                path = write_failure_artifact(r["databaseId"])
                emit(f"Failure details: {path}")
            emit(f"{len(early_failures)} failure(s) detected before watching started")
            return 1

        if active:
            break
        if attempt < STARTUP_RETRIES - 1:
            emit_event(f"Waiting for CI to start... ({attempt + 1}/{STARTUP_RETRIES})")
            time.sleep(STARTUP_WAIT)

    if not active:
        # Fall back to recently completed runs for the same SHA — they may have
        # finished before we started watching (e.g., fast lint jobs).
        # Reuse the last fetched runs list; no second gh run list call needed.
        completed = [
            r for r in runs if r["headSha"] == head_sha and r["status"] == "completed"
        ]
        if completed:
            failures = [
                r["databaseId"] for r in completed if _is_failing(r.get("conclusion"))
            ]
            if failures:
                for run_id in failures:
                    path = write_failure_artifact(run_id)
                    emit(f"Failure details: {path}")
                emit(f"{len(failures)} failure(s) detected — check artifact for logs")
                return 1
            # No active runs and no failures among completed runs — but those
            # completed runs may just be side workflows (e.g. the Preview
            # Controller) that finished before the main CI was queued. Anchor on
            # CI Gate before exiting.
            return _finalize_via_ci_gate(pr)
        emit(f"No runs found for current commit on PR #{pr}.")
        return 1

    emit_event(f"Watching PR #{pr} — branch: {branch} — {len(active)} run(s)")
    for run in active:
        icon = "▶ " if run["status"] == "in_progress" else "⏳"
        emit_event(f"{icon} {run['name']}")

    stop = threading.Event()
    failures: list[int] = []
    undetermined: list[tuple[str, str]] = []

    ci_threads = [
        threading.Thread(
            target=watch_run,
            args=(run["databaseId"], run["name"], stop, failures, undetermined),
            daemon=True,
        )
        for run in active
    ]

    for t in ci_threads:
        t.start()

    for t in ci_threads:
        t.join()

    stop.set()

    if failures:
        for run_id in failures:
            path = write_failure_artifact(run_id)
            emit(f"Failure details: {path}")
        emit(f"{len(failures)} failure(s) detected — check artifact for logs")
        return 1

    if undetermined:
        # No observed failure, but at least one run's outcome was never read.
        # Say so and stop: claiming green here would be a guess, and claiming
        # red would be the false alarm this exists to prevent. Skipping the CI
        # Gate poll is deliberate — the same API is down, and under a rate-limit
        # 403 every extra call digs the shared quota deeper. (PP-qkl8)
        names = ", ".join(name for name, _ in undetermined)
        emit(
            f"⚠  Could not determine the outcome of {names} — "
            f"the GitHub API was unreachable ({undetermined[0][1]}). "
            "Nothing was observed, so this is neither a pass nor a failure."
        )
        return EXIT_UNDETERMINED

    # The watched workflow runs all finished without failures. CI Gate is the
    # aggregate that branch protection actually requires; verify it before
    # claiming success (it may still be pending if it's posted by a separate
    # workflow than the ones we watched).
    return _finalize_via_ci_gate(pr)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[interrupted]", file=sys.stderr)
        sys.exit(130)
    except (RuntimeError, json.JSONDecodeError) as err:
        print(f"[error] {err}", file=sys.stderr)
        sys.exit(1)
