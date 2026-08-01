#!/usr/bin/env python3
"""PR CI + review watcher for the Claude Code Monitor tool.

Streams timestamped events to stdout as GitHub Actions runs complete
and polls for new Copilot reviews. One Monitor call handles both.

Usage: ./scripts/workflow/pr-watch.py [--check-ready | --force] [--verbose] <PR_NUMBER>
  (no flag)      Run blocking pre-checks (mergeable, no failed CI Gate, no
                 unresolved Copilot threads), then watch CI + reviews. CI
                 Gate absent or in-progress is NOT a blocking condition —
                 the watch loop handles those by waiting.
  --check-ready  Run the full readiness check (mergeable + CI Gate present
                 + a review covering head + Copilot threads resolved +
                 ready label) and exit. CI Gate absent IS a fail here —
                 this mode answers "is this PR ready for human review
                 right now?". The `copilot-review` line names one of six
                 states rather than a bare yes/no: Copilot review is
                 request-only on this repo, so "nobody asked yet",
                 "asked, still waiting" and "you pushed past the request"
                 need three different actions and only the middle one
                 resolves by waiting (PP-lzaw).
  --force        Skip the pre-check entirely and watch unconditionally.
  --verbose      Emit per-job progressive updates ("X passed", "CI Gate
                 in_progress — continuing to wait", "Watching PR #N — N
                 run(s)", per-run icon listing, startup retries). Default
                 behavior is quiet — only terminal verdicts (CI Gate
                 decided, check PASS/FAIL) and action items (failure
                 details, new Copilot review) are emitted, so that
                 running under Claude Code's Monitor doesn't wake the
                 agent on every job transition.

Cancelled runs are neither a pass nor a failure — they are reported as
"superseded" (⊘) and never produce a failure artifact. Cancellation is routine
here: pushing a second commit cancels the in-flight run via concurrency groups,
and the Preview Auto-Resync workflow cancels itself the same way. (PP-r63o)

Exit 0: all checks passed, or stopped for new Copilot review,
        or (with --check-ready) the PR is ready for human review.
Exit 1: one or more checks failed, no matching runs found,
        or (with --check-ready) the PR is not ready.
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
COPILOT_LOGINS = (
    "copilot-pull-request-reviewer",
    "copilot-pull-request-reviewer[bot]",
)
READY_LABEL = "ready-for-review"
CI_GATE_NAME = "CI Gate"

# --- Review-request state (PP-lzaw) -----------------------------------------
# Kept deliberately in sync with scripts/workflow/_pr-gates.sh, which is the
# canonical implementation. Duplicated rather than shelled out to because this
# script is the read-only reporter and _pr-gates.sh is sourced by merge-pr.sh,
# which agents may not invoke at all. scripts/tests/test_pr_watch.py pins the
# two vocabularies together.

# Copilot posts a review OBJECT even when it reviewed nothing (quota exhausted,
# no analyzable files). Those must be treated as absent — see the long rationale
# in _pr-gates.sh (PP-jw0s). This pattern is a CHARACTER-FOR-CHARACTER copy of
# COPILOT_NON_REVIEW_BODY_RE there; two hand-written variants would silently
# diverge on the next wording added, and a body the bash eats but the Python
# keeps (or vice versa) is exactly the kind of disagreement that makes the
# gates untrustworthy. Change one, change both.
COPILOT_NON_REVIEW_BODY_RE = re.compile(
    "reached their quota limit"
    "|unable to review this pull request"
    "|not able to review any files"
    "|wasn.t able to review any files",
    re.IGNORECASE,
)
CLAUDE_MARKER_PREFIX = "<!-- pinpoint-claude-review:"

# Seconds to wait for Copilot to answer a REQUEST before the wait stops being
# legitimate. Measured from the request, not the head push.
COPILOT_REVIEW_WAIT_THRESHOLD = 600

REQUEST_REVIEW_HINT = 'gh pr edit {pr} --add-reviewer "@copilot"'

REVIEW_POLL_INTERVAL = 60  # seconds — GitHub rate limit friendly
STARTUP_RETRIES = 6  # attempts to find runs for current SHA
STARTUP_WAIT = 10  # seconds between startup retries
LOG_DIR = "tmp/gh-monitor"

# How long to keep polling for a replacement CI Gate after the current one came
# back cancelled. A cancel almost always means a newer run is already queued;
# this bounds the wait so a genuinely abandoned run still terminates.
SUPERSEDED_GATE_GRACE = 180  # seconds

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
    and action items (failure details, new Copilot review).
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
                nodes {{
                  isResolved
                  comments(first: 1) {{ nodes {{ author {{ login }} }} }}
                }}
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


def _is_substantive(review: dict) -> bool:
    return not COPILOT_NON_REVIEW_BODY_RE.search(review.get("body") or "")


def _iso_to_epoch(value: str) -> float:
    return (
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .timestamp()
    )


def copilot_review_state(pr: int) -> tuple[str, str]:
    """Return (state, human-readable detail) for the PR's review situation.

    Mirrors `_compute_review_state` in scripts/workflow/_pr-gates.sh — same six
    states, same ordering, same clock. States: marker, covered, awaiting,
    overdue, pushed_after, never_requested.

    The distinction that matters: a request NEWER than the head commit means a
    wait is legitimate; a head newer than the newest request means nobody is
    coming, because nothing re-requests automatically. Collapsing those into one
    "not reviewed yet" is what turns a forgotten request into an overnight stall.

    "Newer than the head commit" is measured against the head commit's committer
    date, which stands in for when head arrived on the branch — GitHub exposes no
    push timestamp for a PR head. See the note at the comparison site in
    _pr-gates.sh for how the two can differ and why neither skew can open a merge
    path (coverage itself is decided by commit_id).
    """
    repo = f"repos/{REPO_OWNER}/{REPO_NAME}"
    head_sha = gh("pr", "view", str(pr), "--json", "headRefOid", "--jq", ".headRefOid")
    head_date = gh(
        "api", f"{repo}/commits/{head_sha}", "--jq", ".commit.committer.date"
    )
    head_epoch = _iso_to_epoch(head_date)

    # The review REQUEST clock lives on the issue timeline; the reviews endpoint
    # cannot tell "nobody asked" from "asked, still waiting". A request names the
    # reviewer as plain "Copilot" — not the bot login its reviews are authored
    # under — so match a case-insensitive "copilot" prefix.
    requests = [
        ev.get("created_at", "")
        for ev in _gh_api_list(f"{repo}/issues/{pr}/timeline")
        if ev.get("event") == "review_requested"
        and ((ev.get("requested_reviewer") or {}).get("login") or "")
        .lower()
        .startswith("copilot")
    ]
    latest_request = max(requests) if requests else ""
    request_epoch = _iso_to_epoch(latest_request) if latest_request else 0.0
    request_covers_head = bool(latest_request) and request_epoch >= head_epoch

    marker = f"{CLAUDE_MARKER_PREFIX} {head_sha} -->"
    if any(
        marker in (c.get("body") or "")
        for c in _gh_api_list(f"{repo}/issues/{pr}/comments")
    ):
        detail = f"Claude review marker pins head {head_sha[:7]}"
        if not request_covers_head:
            detail += " (standing in — no Copilot review was requested for this head)"
        return "marker", detail

    # Coverage is judged by commit_id, not by timestamp: a review submitted after
    # a later push can still have read an earlier tree.
    if any(
        r.get("commit_id") == head_sha
        and (r.get("user") or {}).get("login") in COPILOT_LOGINS
        and _is_substantive(r)
        for r in _gh_api_list(f"{repo}/pulls/{pr}/reviews")
    ):
        return "covered", f"Copilot review carries head SHA {head_sha[:7]}"

    hint = REQUEST_REVIEW_HINT.format(pr=pr)
    if not latest_request:
        return (
            "never_requested",
            f"no Copilot review has ever been requested — run: {hint}",
        )

    if not request_covers_head:
        behind = int(head_epoch - request_epoch)
        return (
            "pushed_after",
            f"head is {behind}s NEWER than the last request ({latest_request}) — "
            f"you pushed after requesting; nothing re-requests automatically. "
            f"When you stop iterating, run: {hint}",
        )

    waited = int(time.time() - request_epoch)
    if waited < COPILOT_REVIEW_WAIT_THRESHOLD:
        return (
            "awaiting",
            f"review requested {waited}s ago, Copilot has not answered yet",
        )
    return (
        "overdue",
        f"review requested {waited}s ago and still unanswered — re-request ({hint}) "
        f"or attest head with scripts/workflow/mark-claude-review.sh",
    )


def _unresolved_copilot(threads: list[dict]) -> int:
    count = 0
    for t in threads:
        if t["isResolved"]:
            continue
        nodes = t["comments"]["nodes"]
        if nodes and nodes[0]["author"]["login"] in COPILOT_LOGINS:
            count += 1
    return count


def _ci_gate_state(pr: int) -> tuple[str, str]:
    """Return (status, conclusion) for the CI Gate check, or ("", "") if absent.

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
        return "", ""

    def rank(check: dict) -> tuple[int, str]:
        not_superseded = 0 if _is_superseded(check.get("conclusion")) else 1
        when = check.get("completedAt") or check.get("startedAt") or ""
        return not_superseded, when

    newest = max(gates, key=rank)
    return newest.get("status", ""), newest.get("conclusion", "")


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
    state, already-failed CI Gate, unresolved Copilot threads) from conditions
    that the watch loop is designed to wait through (CI Gate not yet posted, CI
    Gate in progress). The latter MUST pass this pre-check so the watch loop can
    fire and `_finalize_via_ci_gate` can poll for completion.

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

    unresolved = _unresolved_copilot(get_review_threads(pr))
    if unresolved > 0:
        return False, f"{unresolved} unresolved Copilot thread(s)"

    return True, ""


def run_audit(pr: int) -> bool:
    """Print a pass/fail report for review-readiness. Return True if all pass."""
    merge_state, labels = _fetch_merge_state(pr)
    ci_status, ci_conclusion = _ci_gate_state(pr)
    unresolved = _unresolved_copilot(get_review_threads(pr))

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

    # A review covering head is part of an agent's terminal state on a PR, and
    # under request-only Copilot it does not happen unless someone asks. Report
    # WHICH state the PR is in — "nobody asked", "asked and waiting", and "you
    # pushed past the request" need three different actions, and only the middle
    # one resolves by waiting. `awaiting` is not a failure: the request is
    # outstanding and the answer is on its way.
    try:
        review_state, review_detail = copilot_review_state(pr)
    except (RuntimeError, ValueError, KeyError) as exc:
        review_state, review_detail = "unknown", f"could not determine ({exc})"
    review_ok = review_state in ("marker", "covered", "awaiting")

    checks = [
        (not bad_merge, "mergeable", merge_detail),
        (ci_check[0], "ci-gate", ci_check[1]),
        (review_ok, "copilot-review", f"{review_state}: {review_detail}"),
        (
            unresolved == 0,
            "copilot-resolved",
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


def _run_conclusion(run_id: int) -> tuple[str, str]:
    """Return (status, conclusion) for a run. Returns ("", "") on error."""
    try:
        data = json.loads(gh("run", "view", str(run_id), "--json", "status,conclusion"))
        return data.get("status", ""), data.get("conclusion", "")
    except (RuntimeError, json.JSONDecodeError):
        return "", ""


def watch_run(
    run_id: int,
    name: str,
    stop: threading.Event,
    failures: list[int],
) -> None:
    """Watch one CI run via gh run watch. Retries if watcher exits prematurely."""
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
        status, conclusion = _run_conclusion(run_id)

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


_COPILOT_JQ = (
    '[.[] | select(.user.login == "copilot-pull-request-reviewer"'
    ' or .user.login == "copilot-pull-request-reviewer[bot]")] | length'
)


def watch_reviews(
    pr: int,
    baseline: int | None,
    stop: threading.Event,
    review_seen: threading.Event,
) -> None:
    """Poll for new Copilot-only reviews every REVIEW_POLL_INTERVAL seconds.

    baseline=None means the initial fetch failed; the first successful poll
    establishes the baseline instead of comparing against zero.
    """
    while not stop.wait(REVIEW_POLL_INTERVAL):
        try:
            count = int(
                gh(
                    "api",
                    f"repos/{{owner}}/{{repo}}/pulls/{pr}/reviews?per_page=100",
                    "--jq",
                    _COPILOT_JQ,
                )
            )
        except Exception:  # noqa: BLE001
            continue  # transient API failure — skip cycle
        if baseline is None:
            baseline = count  # establish baseline on first successful poll
            continue
        if count > baseline:
            emit("📝 New Copilot review posted")
            review_seen.set()
            stop.set()
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

    baseline: int | None
    try:
        baseline = int(
            gh(
                "api",
                f"repos/{{owner}}/{{repo}}/pulls/{pr}/reviews?per_page=100",
                "--jq",
                _COPILOT_JQ,
            )
        )
    except Exception:  # noqa: BLE001
        baseline = None  # established on first successful poll in watch_reviews

    stop = threading.Event()
    review_seen = threading.Event()
    failures: list[int] = []

    ci_threads = [
        threading.Thread(
            target=watch_run,
            args=(run["databaseId"], run["name"], stop, failures),
            daemon=True,
        )
        for run in active
    ]
    review_thread = threading.Thread(
        target=watch_reviews,
        args=(pr, baseline, stop, review_seen),
        daemon=True,
    )

    for t in ci_threads:
        t.start()
    review_thread.start()

    for t in ci_threads:
        t.join()

    stop.set()
    review_thread.join(timeout=5)

    if review_seen.is_set():
        return 0

    if failures:
        for run_id in failures:
            path = write_failure_artifact(run_id)
            emit(f"Failure details: {path}")
        emit(f"{len(failures)} failure(s) detected — check artifact for logs")
        return 1

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
