#!/usr/bin/env python3
"""Compact PR CI watcher for agent harnesses.

Polls the authoritative current-head ``CI Gate`` once per interval. Harnesses
wait on this one quiet process instead of starting one ``gh run watch`` process
per active workflow.

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
  --verbose      Emit CI Gate state changes. Default behavior is quiet — only
                 terminal verdicts and action items are emitted, so harnesses
                 are not woken by unchanged polls.

Cancelled runs are neither a pass nor a failure — they are reported as
"superseded" (⊘) and never produce a failure artifact. Cancellation is routine
here: pushing a second commit cancels the in-flight run via concurrency groups,
and the Preview Auto-Resync workflow cancels itself the same way. (PP-r63o)

A gh API error (rate-limit 403, network drop, auth failure) is likewise not a
failure — it means we could not find out. The same is true when the bounded
watch expires without a terminal CI Gate. Both exit as undetermined with the
real cause and make no speculative follow-up calls. (PP-qkl8)

Exit 0: all checks passed, or (with --check-ready) the PR is ready for
        human review.
Exit 1: one or more checks failed, no matching runs found,
        or (with --check-ready) the PR is not ready.
Exit 2: the outcome could not be determined — the GitHub API was unreachable
        or the bounded watch expired without a terminal verdict. This is
        neither a pass nor a failure.
"""

from __future__ import annotations

import fcntl
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

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

LOG_DIR = "tmp/gh-monitor"
WATCH_POLL_SECONDS = 30
# PR CI currently has a 30-minute job backstop. Leave another 30 minutes for
# runner queueing while still bounding unattended harness waits.
WATCH_TIMEOUT_SECONDS = 3600

# How long to keep polling for a replacement CI Gate after the current one came
# back cancelled. A cancel almost always means a newer run is already queued;
# this bounds the wait so a genuinely abandoned run still terminates.
SUPERSEDED_GATE_GRACE = 180  # seconds

EXIT_UNDETERMINED = 2

MONITOR_SCHEMA_VERSION = 1
MONITOR_REPOSITORY = f"{REPO_OWNER}/{REPO_NAME}"
MONITOR_TERMINAL_STATUSES = {"passed", "failed", "superseded", "undetermined"}
MONITOR_STATUSES = MONITOR_TERMINAL_STATUSES | {"starting", "pending"}
FOLLOWER_POLL_SECONDS = 0.25
MonitorStateSink = Callable[[str, str, str, str | None], None]
MonitorActionSink = Callable[[str | None], None]

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
# Host-local monitor ownership
# ---------------------------------------------------------------------------


def _monitor_dir() -> Path:
    """Return the host-local state directory without consulting GitHub."""
    state_home = os.environ.get("XDG_STATE_HOME")
    root = Path(state_home) if state_home else Path.home() / ".local" / "state"
    return root / "pinpoint" / "pr-watch"


def _monitor_paths(pr: int, *, force: bool = False) -> tuple[Path, Path]:
    mode_suffix = "-force" if force else ""
    stem = f"{REPO_OWNER}-{REPO_NAME}-{pr}{mode_suffix}"
    root = _monitor_dir()
    return root / f"{stem}.lock", root / f"{stem}.json"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _write_monitor_state(
    path: Path,
    *,
    pr: int,
    head_sha: str,
    leader_pid: int,
    status: str,
    detail: str,
    failure_artifact: str | None = None,
    action_item: str | None = None,
) -> None:
    """Atomically publish one versioned monitor snapshot."""
    if status not in MONITOR_STATUSES:
        raise ValueError(f"unknown monitor status: {status}")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    state: dict[str, object] = {
        "schema_version": MONITOR_SCHEMA_VERSION,
        "repository": MONITOR_REPOSITORY,
        "pr": pr,
        "head_sha": head_sha,
        "leader_pid": leader_pid,
        "status": status,
        "timestamp": _utc_now(),
        "detail": detail[:240],
    }
    if failure_artifact is not None:
        state["failure_artifact"] = str(Path(failure_artifact).resolve())
    if action_item is not None:
        state["action_item"] = action_item[:240]

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            delete=False,
        ) as handle:
            temp_path = Path(handle.name)
            json.dump(state, handle, separators=(",", ":"), sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def _read_monitor_state(path: Path, pr: int) -> dict[str, object] | None:
    """Read one valid state snapshot; malformed or foreign data is unknown."""
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(state, dict):
        return None
    required_types = {
        "schema_version": int,
        "repository": str,
        "pr": int,
        "head_sha": str,
        "leader_pid": int,
        "status": str,
        "timestamp": str,
        "detail": str,
    }
    if any(
        not isinstance(state.get(key), kind) for key, kind in required_types.items()
    ):
        return None
    if (
        state["schema_version"] != MONITOR_SCHEMA_VERSION
        or state["repository"] != MONITOR_REPOSITORY
        or state["pr"] != pr
        or state["leader_pid"] <= 0
        or state["status"] not in MONITOR_STATUSES
    ):
        return None
    artifact = state.get("failure_artifact")
    if artifact is not None and not isinstance(artifact, str):
        return None
    action_item = state.get("action_item")
    if action_item is not None and not isinstance(action_item, str):
        return None
    return state


def _write_lock_owner(lock_handle, leader_pid: int) -> None:
    """Identify the process holding the advisory lock for follower validation."""
    lock_handle.seek(0)
    lock_handle.truncate()
    lock_handle.write(f"{leader_pid}\n")
    lock_handle.flush()
    os.fsync(lock_handle.fileno())


def _read_lock_owner(lock_handle) -> int | None:
    try:
        lock_handle.seek(0)
        value = lock_handle.read().strip()
        return int(value) if value.isdigit() and int(value) > 0 else None
    except OSError:
        return None


def _monitor_exit_code(status: str) -> int:
    if status == "passed":
        return 0
    if status in {"failed", "superseded"}:
        return 1
    return EXIT_UNDETERMINED


def _run_coordinated_watch(
    pr: int,
    owned_watch: Callable[[MonitorStateSink, MonitorActionSink], int],
    *,
    force: bool = False,
    follower_poll_sec: float = FOLLOWER_POLL_SECONDS,
) -> int:
    """Own the remote watch or follow a live owner's local atomic state.

    The lock, rather than the JSON file, proves liveness. A terminal file with
    no held lock is never trusted: the new invocation becomes leader and
    remotely revalidates it. The PID written into the locked file must match the
    state record before a follower accepts that state, closing the stale-file
    race between consecutive owners.
    """
    lock_path, state_path = _monitor_paths(pr, force=force)
    lock_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        attached_pid: int | None = None
        last_signature: tuple[str, str, str] | None = None
        last_action_item: str | None = None

        def surface_action_item(state: dict[str, object]) -> None:
            nonlocal last_action_item
            action_item = state.get("action_item")
            if isinstance(action_item, str) and action_item != last_action_item:
                emit(action_item)
                last_action_item = action_item

        while True:
            # An attached follower may observe the owner's atomic terminal
            # write just after the owner releases its lock. Trust that exact
            # PID's terminal record before contesting the now-free lock; the
            # follower already proved this owner was live. A pending record is
            # never trusted after unlock, so a dead leader still revalidates.
            if attached_pid is not None:
                attached_state = _read_monitor_state(state_path, pr)
                if (
                    attached_state is not None
                    and attached_state["leader_pid"] == attached_pid
                    and attached_state["status"] in MONITOR_TERMINAL_STATUSES
                ):
                    surface_action_item(attached_state)
                    detail = str(attached_state["detail"])
                    emit(detail)
                    artifact = attached_state.get("failure_artifact")
                    if artifact:
                        emit(f"Failure details: {artifact}")
                    return _monitor_exit_code(str(attached_state["status"]))
            try:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                lock_owner = _read_lock_owner(lock_handle)
                state = _read_monitor_state(state_path, pr)
                if (
                    state is not None
                    and lock_owner is not None
                    and state["leader_pid"] == lock_owner
                ):
                    if attached_pid != lock_owner:
                        attached_pid = lock_owner
                        last_signature = None
                        last_action_item = None
                        emit_event(
                            f"Following host-local PR #{pr} monitor pid={lock_owner}"
                        )
                    surface_action_item(state)
                    signature = (
                        str(state["head_sha"]),
                        str(state["status"]),
                        str(state["detail"]),
                    )
                    if signature != last_signature:
                        emit_event(str(state["detail"]))
                        last_signature = signature
                    if state["status"] in MONITOR_TERMINAL_STATUSES:
                        detail = str(state["detail"])
                        emit(detail)
                        artifact = state.get("failure_artifact")
                        if artifact:
                            emit(f"Failure details: {artifact}")
                        return _monitor_exit_code(str(state["status"]))
                time.sleep(follower_poll_sec)
                continue

            leader_pid = os.getpid()
            _write_lock_owner(lock_handle, leader_pid)
            action_item: str | None = None

            def set_action_item(value: str | None) -> None:
                nonlocal action_item
                action_item = value

            def publish(
                head_sha: str,
                status: str,
                detail: str,
                failure_artifact: str | None = None,
            ) -> None:
                _write_monitor_state(
                    state_path,
                    pr=pr,
                    head_sha=head_sha,
                    leader_pid=leader_pid,
                    status=status,
                    detail=detail,
                    failure_artifact=failure_artifact,
                    action_item=action_item,
                )

            publish("", "starting", f"PR #{pr} monitor is starting")
            try:
                return owned_watch(publish, set_action_item)
            finally:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


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
    into a pass. Threads come from Tim or another agent, and AGENTS.md §5
    requires each to be fixed or declined-and-resolved either way.
    """
    return sum(1 for t in threads if not t["isResolved"])


def _select_ci_gate(rollup: list[dict]) -> dict | None:
    """Select the authoritative CI Gate from one current-head rollup."""
    gates = [c for c in rollup if c.get("name") == CI_GATE_NAME]
    if not gates:
        return None

    def rank(check: dict) -> str:
        when = check.get("startedAt") or check.get("completedAt") or ""
        return when

    return max(gates, key=rank)


def _current_ci_snapshot(pr: int) -> tuple[str, dict | None]:
    """Fetch the current head and authoritative CI Gate in one API query.

    Keeping both values in one response is the exact-head boundary: a push
    cannot interleave between separate head and check reads.
    """
    raw = gh("pr", "view", str(pr), "--json", "headRefOid,statusCheckRollup")
    data = json.loads(raw)
    return data.get("headRefOid") or "", _select_ci_gate(
        data.get("statusCheckRollup") or []
    )


def _current_ci_gate(pr: int) -> dict | None:
    """Return the authoritative CI Gate check for GitHub's current PR head.

    GitHub scopes statusCheckRollup to the PR's current head commit, but that
    commit can still carry MORE THAN ONE `CI Gate` entry — a re-run, or a run
    cancelled by a concurrency group, leaves its superseded check behind next to
    the live one. Returning the first match let an older entry shadow the run we
    actually care about, so select the entry with the most recent start time.
    Completion is only a fallback because an older run can finish cancelling
    after its replacement has already completed. (PP-r63o)
    """
    _head, gate = _current_ci_snapshot(pr)
    return gate


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


def _pre_check_blocking(pr: int) -> tuple[bool, str, str]:
    """Return ``(allowed, reason, action_item)`` for the default watch precheck.

    Used by the default watch mode as a fail-fast pre-check BEFORE entering the
    watch loop. Distinguishes conditions that won't resolve by waiting (bad merge
    state, already-failed CI Gate) from conditions that the watch loop is
    designed to wait through (CI Gate not yet posted, CI Gate in progress). The
    latter MUST pass this pre-check so the watch loop can fire and
    the aggregate watcher can poll for completion.

    Unresolved review threads are reported but do NOT block — watching CI is a
    step *inside* the address-the-findings loop, not after it.

    Readiness-check mode (run_audit, --check-ready) keeps its stricter
    semantics — there, CI-Gate-absent IS correctly a "no, not ready right now".
    """
    merge_state, _labels = _fetch_merge_state(pr)
    if merge_state in ("DIRTY", "CONFLICTING", "BEHIND"):
        return False, f"merge state {merge_state} — resolve before watching", ""

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
                "",
            )

    unresolved = _unresolved_threads(get_review_threads(pr))
    action_item = ""
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
        action_item = f"{unresolved} unresolved review thread(s) — resolve before merge"
        emit(action_item)

    return True, "", action_item


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


def _failed_ci_run_id(head_sha: str) -> int | None:
    """Return the newest confirmed-failing CI workflow run for ``head_sha``.

    This lookup happens only after the aggregate CI Gate is red. The ordinary
    watch path never enumerates workflow runs.
    """
    raw = gh(
        "run",
        "list",
        "--commit",
        head_sha,
        "--workflow",
        "CI",
        "--limit",
        "10",
        "--json",
        "databaseId,status,conclusion,headSha",
    )
    runs = json.loads(raw)
    failed = [
        run
        for run in runs
        if run.get("headSha") == head_sha
        and run.get("status") == "completed"
        and _is_failing(run.get("conclusion"))
    ]
    if not failed:
        return None
    return int(
        max(failed, key=lambda run: int(run.get("databaseId") or 0))["databaseId"]
    )


def _watch_ci_gate(
    pr: int,
    expected_head: str,
    *,
    timeout_sec: int = WATCH_TIMEOUT_SECONDS,
    poll_sec: int = WATCH_POLL_SECONDS,
    state_sink: MonitorStateSink | None = None,
) -> int:
    """Watch one exact-head CI Gate snapshot per interval.

    A push moves ``expected_head`` forward and resets the observed state. A
    terminal verdict is therefore always paired with the head returned in the
    same GitHub response. Unchanged polls are silent.
    """
    deadline = time.monotonic() + timeout_sec
    superseded_deadline: float | None = None
    last_signature: tuple[str, str, str] | None = None

    while time.monotonic() < deadline:
        try:
            head_sha, gate = _current_ci_snapshot(pr)
        except (RuntimeError, json.JSONDecodeError) as exc:
            detail = (
                "⚠  Could not determine CI Gate state — "
                f"the GitHub API was unreachable ({exc})."
            )
            emit(detail)
            if state_sink is not None:
                state_sink(expected_head, "undetermined", detail, None)
            return EXIT_UNDETERMINED

        if not head_sha:
            detail = "⚠  Could not determine CI Gate state — PR head SHA was empty."
            emit(detail)
            if state_sink is not None:
                state_sink("", "undetermined", detail, None)
            return EXIT_UNDETERMINED

        if expected_head and head_sha != expected_head:
            emit_event(
                f"PR head moved {expected_head[:7]} → {head_sha[:7]}; "
                "following the replacement CI Gate"
            )
        if head_sha != expected_head:
            expected_head = head_sha
            superseded_deadline = None
            last_signature = None

        status = (gate or {}).get("status") or ""
        conclusion = (gate or {}).get("conclusion") or ""
        signature = (head_sha, status, conclusion)
        if signature != last_signature:
            detail = (
                f"CI Gate {status.lower() or 'not yet posted'} on {head_sha[:7]}"
                + (f" ({conclusion})" if conclusion else "")
            )
            emit_event(detail)
            if state_sink is not None:
                state_sink(head_sha, "pending", detail, None)
            last_signature = signature

        if status == "COMPLETED":
            if _is_passing(conclusion):
                detail = f"CI Gate passed on {head_sha[:7]} (conclusion={conclusion}) ✓"
                emit(detail)
                if state_sink is not None:
                    state_sink(head_sha, "passed", detail, None)
                return 0
            if _is_superseded(conclusion):
                if superseded_deadline is None:
                    superseded_deadline = time.monotonic() + SUPERSEDED_GATE_GRACE
                    emit_event(
                        "CI Gate cancelled (superseded) — waiting for a replacement run"
                    )
                elif time.monotonic() >= superseded_deadline:
                    detail = (
                        "⊘  CI Gate cancelled (superseded) — "
                        "no replacement run appeared"
                    )
                    emit(detail)
                    if state_sink is not None:
                        state_sink(head_sha, "superseded", detail, None)
                    return 1
            else:
                detail = (
                    f"CI Gate failed on {head_sha[:7]} "
                    f"(conclusion={conclusion or 'unknown'})"
                )
                emit(detail)
                artifact: str | None = None
                try:
                    run_id = _failed_ci_run_id(head_sha)
                    if run_id is not None:
                        artifact = write_failure_artifact(run_id)
                        emit(f"Failure details: {artifact}")
                except (RuntimeError, json.JSONDecodeError, OSError, ValueError) as exc:
                    emit(f"Failure logs unavailable: {exc}")
                if state_sink is not None:
                    state_sink(head_sha, "failed", detail, artifact)
                return 1
        else:
            superseded_deadline = None

        time.sleep(poll_sec)

    detail = (
        f"⚠  Could not determine CI Gate state — no terminal verdict "
        f"within {timeout_sec}s."
    )
    emit(detail)
    if state_sink is not None:
        state_sink(expected_head, "undetermined", detail, None)
    return EXIT_UNDETERMINED


def _run_owned_watch(
    pr: int,
    force: bool,
    state_sink: MonitorStateSink,
    action_item_sink: MonitorActionSink,
) -> int:
    """Run pre-checks and remote polling for the process holding the lock."""
    if not force:
        try:
            blocking_ok, reason, action_item = _pre_check_blocking(pr)
        except (RuntimeError, json.JSONDecodeError, KeyError, ValueError) as exc:
            detail = f"⚠  Could not complete pre-check — {exc}"
            emit(detail)
            state_sink("", "undetermined", detail, None)
            return EXIT_UNDETERMINED
        if not blocking_ok:
            detail = f"Pre-check failed: {reason}"
            emit(detail)
            state_sink("", "failed", detail, None)
            return 1
        action_item_sink(action_item or None)

    emit_event(f"Watching PR #{pr} — aggregate CI Gate")
    state_sink("", "pending", f"Watching PR #{pr} — aggregate CI Gate", None)
    return _watch_ci_gate(pr, "", state_sink=state_sink)


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

    return _run_coordinated_watch(
        pr,
        lambda state_sink, action_item_sink: _run_owned_watch(
            pr, force, state_sink, action_item_sink
        ),
        force=force,
    )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[interrupted]", file=sys.stderr)
        sys.exit(130)
    except (RuntimeError, json.JSONDecodeError) as err:
        print(f"[error] {err}", file=sys.stderr)
        sys.exit(1)
