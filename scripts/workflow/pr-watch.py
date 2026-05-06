#!/usr/bin/env python3
"""PR CI + review watcher for the Claude Code Monitor tool.

Streams timestamped events to stdout as GitHub Actions runs complete
and polls for new Copilot reviews. One Monitor call handles both.

Usage: ./scripts/workflow/pr-watch.py [--audit | --force] <PR_NUMBER>
  (no flag) Run the readiness audit, then watch CI + reviews.
  --audit   Run only the readiness audit and exit (no watch loop).
  --force   Skip the audit and watch unconditionally.

Exit 0: all checks passed, or stopped for new Copilot review,
        or (with --audit) the PR is ready for human review.
Exit 1: one or more checks failed, no matching runs found,
        or (with --audit) the PR is not ready.
"""

from __future__ import annotations

import json
import os
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

REVIEW_POLL_INTERVAL = 60  # seconds — GitHub rate limit friendly
STARTUP_RETRIES = 6  # attempts to find runs for current SHA
STARTUP_WAIT = 10  # seconds between startup retries
LOG_DIR = "tmp/gh-monitor"

_lock = threading.Lock()


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def emit(msg: str) -> None:
    with _lock:
        print(f"[{ts()}] {msg}", flush=True)


def gh(*args: str) -> str:
    """Run a gh CLI command, returning stdout. Raises RuntimeError on failure."""
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"gh {args[0]} failed")
    return result.stdout.strip()


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
    """Return (status, conclusion) for the CI Gate check, or ("", "") if absent."""
    raw = gh("pr", "view", str(pr), "--json", "statusCheckRollup")
    rollup = json.loads(raw).get("statusCheckRollup", [])
    for check in rollup:
        if check.get("name") == CI_GATE_NAME:
            return check.get("status", ""), check.get("conclusion", "")
    return "", ""


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
    unresolved = _unresolved_copilot(get_review_threads(pr))

    bad_merge = merge_state in ("DIRTY", "CONFLICTING", "BEHIND")
    merge_detail = f"mergeStateStatus={merge_state}"
    if bad_merge:
        merge_detail += " (resolve via `git fetch origin && git merge origin/main`)"

    if not ci_status:
        ci_check = (False, "CI Gate check not found")
    elif ci_status != "COMPLETED":
        ci_check = (False, f"in progress (status={ci_status})")
    else:
        ci_check = (
            ci_conclusion in ("SUCCESS", "NEUTRAL", "SKIPPED"),
            f"conclusion={ci_conclusion or 'unknown'}",
        )

    # ready-for-review is informational — orchestrator applies it after the
    # audit passes, so its absence isn't a failure.
    label_detail = (
        "applied" if READY_LABEL in labels else "not applied (orchestrator applies)"
    )

    checks = [
        (not bad_merge, "mergeable", merge_detail),
        (ci_check[0], "ci-gate", ci_check[1]),
        (
            unresolved == 0,
            "copilot-resolved",
            "all resolved"
            if unresolved == 0
            else f"{unresolved} unresolved (run ./scripts/workflow/copilot-comments.sh {pr})",
        ),
        (True, "ready-label", label_detail),
    ]

    all_ok = all(ok for ok, _, _ in checks)
    emit(f"Readiness audit for PR #{pr}: {'PASS' if all_ok else 'FAIL'}")
    for ok, label, detail in checks:
        emit(f"  {'✓' if ok else '✗'} {label}: {detail}")
    if not all_ok:
        emit("Use --force to watch anyway, or fix the items above.")
    return all_ok


# ---------------------------------------------------------------------------
# CI run watcher
# ---------------------------------------------------------------------------

_PASSING_CONCLUSIONS = {"success", "skipped", "neutral"}


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
            if conclusion in _PASSING_CONCLUSIONS:
                emit(f"✓  {name} — passed")
                return
            # Exited 0 but API says non-passing — fall through to failure handling.

        # gh run watch exited non-zero — verify via API before declaring failure.
        # It can crash or disconnect while the run is still in progress.

        if status in ("queued", "in_progress"):
            # Watcher crashed prematurely — restart it.
            emit(f"↻  {name} — watcher restarted (run still in progress)")
            continue

        if conclusion in _PASSING_CONCLUSIONS:
            emit(f"✓  {name} — passed")
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
            emit(f"Run: ./scripts/workflow/copilot-comments.sh {pr}")
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


def _parse_args(argv: list[str]) -> tuple[int, bool, bool] | None:
    """Return (pr, audit_only, force) or None on usage error."""
    audit_only = "--audit" in argv
    force = "--force" in argv
    rest = [a for a in argv[1:] if a not in ("--audit", "--force")]
    if audit_only and force:
        print("Error: --audit and --force are mutually exclusive.", file=sys.stderr)
        return None
    if len(rest) != 1 or not rest[0].isdigit():
        print(
            f"Usage: {argv[0]} [--audit | --force] <PR_NUMBER>",
            file=sys.stderr,
        )
        return None
    return int(rest[0]), audit_only, force


def main() -> int:
    parsed = _parse_args(sys.argv)
    if parsed is None:
        return 1
    pr, audit_only, force = parsed

    if audit_only:
        return 0 if run_audit(pr) else 1

    if not force and not run_audit(pr):
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
    for attempt in range(STARTUP_RETRIES):
        runs: list[dict] = json.loads(
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
        sha_runs = [r for r in runs if r["headSha"] == head_sha]
        active = [r for r in sha_runs if r["status"] in ("queued", "in_progress")]

        # Fail fast if any run for this SHA already completed with a non-passing
        # conclusion (e.g., a fast lint job failed before we started watching).
        completed = [r for r in sha_runs if r["status"] == "completed"]
        early_failures = [
            r for r in completed if r.get("conclusion") not in _PASSING_CONCLUSIONS
        ]
        if early_failures:
            for r in early_failures:
                path = write_failure_artifact(r["databaseId"])
                emit(f"Failure details: {path}")
            emit(f"{len(early_failures)} failure(s) detected before watching started")
            return 1

        if active:
            break
        if attempt < STARTUP_RETRIES - 1:
            emit(f"Waiting for CI to start... ({attempt + 1}/{STARTUP_RETRIES})")
            time.sleep(STARTUP_WAIT)

    if not active:
        # Fall back to recently completed runs for the same SHA — they may have
        # finished before we started watching (e.g., fast lint jobs).
        all_runs: list[dict] = json.loads(
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
        completed = [
            r
            for r in all_runs
            if r["headSha"] == head_sha and r["status"] == "completed"
        ]
        if completed:
            failures = [
                r["databaseId"]
                for r in completed
                if r.get("conclusion") not in ("success", "skipped", "neutral")
            ]
            if failures:
                for run_id in failures:
                    path = write_failure_artifact(run_id)
                    emit(f"Failure details: {path}")
                emit(f"{len(failures)} failure(s) detected — check artifact for logs")
                return 1
            emit("All checks passed ✓")
            return 0
        emit(f"No runs found for current commit on PR #{pr}.")
        return 1

    emit(f"Watching PR #{pr} — branch: {branch} — {len(active)} run(s)")
    for run in active:
        icon = "▶ " if run["status"] == "in_progress" else "⏳"
        emit(f"{icon} {run['name']}")

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

    emit("All checks passed ✓")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[interrupted]", file=sys.stderr)
        sys.exit(130)
    except (RuntimeError, json.JSONDecodeError) as err:
        print(f"[error] {err}", file=sys.stderr)
        sys.exit(1)
