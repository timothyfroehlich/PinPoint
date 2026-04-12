#!/usr/bin/env python3
"""PR CI + review watcher for the Claude Code Monitor tool.

Streams timestamped events to stdout as GitHub Actions runs complete
and polls for new Copilot reviews. One Monitor call handles both.

Usage: ./scripts/workflow/pr-watch.py <PR_NUMBER>
Exit 0: all checks passed, or stopped for new Copilot review
Exit 1: one or more checks failed
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

REVIEW_POLL_INTERVAL = 60  # seconds — GitHub rate limit friendly
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


def watch_run(
    run_id: int,
    name: str,
    stop: threading.Event,
    failures: list[int],
) -> None:
    """Watch one CI run via gh run watch. Blocks until done or stop is set."""
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

        if proc.returncode == 0:
            emit(f"✓  {name} — passed")
        else:
            emit(f"✗  {name} — failed")
            with _lock:
                failures.append(run_id)


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
                    f"repos/{{owner}}/{{repo}}/pulls/{pr}/reviews",
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

    with open(path, "w") as f:
        f.write("# GitHub Actions Failure Report\n")
        f.write(f"Run ID: {run_id}\nGenerated: {now}\n\n")
        f.write(f"## Failed Steps Log\n\n```text\n{log_tail}\n```\n\n")
        summary_text = summary.stdout or "(no summary available)"
        f.write(f"## Run Summary\n\n```text\n{summary_text}\n```\n")

    return path


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        print(f"Usage: {sys.argv[0]} <PR_NUMBER>", file=sys.stderr)
        return 1

    pr = int(sys.argv[1])

    try:
        branch = gh(
            "pr", "view", str(pr), "--json", "headRefName", "--jq", ".headRefName"
        )
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    runs: list[dict] = json.loads(
        gh(
            "run",
            "list",
            "--limit",
            "50",
            "--branch",
            branch,
            "--json",
            "databaseId,status,name",
        )
    )

    active = [r for r in runs if r["status"] in ("queued", "in_progress")]
    if not active:
        completed = [r for r in runs if r["status"] == "completed"]
        if completed:
            active = [completed[0]]

    if not active:
        emit(f"No workflow runs found for PR #{pr}.")
        return 0

    emit(f"Watching PR #{pr} — branch: {branch} — {len(active)} run(s)")
    for run in active:
        icon = "▶ " if run["status"] == "in_progress" else "⏳"
        emit(f"{icon} {run['name']}")

    baseline: int | None
    try:
        baseline = int(
            gh(
                "api",
                f"repos/{{owner}}/{{repo}}/pulls/{pr}/reviews",
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
