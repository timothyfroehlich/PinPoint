#!/usr/bin/env python3
"""agent-budget.py — host-wide memory reservations for expensive local commands.

Several agent sessions share one 16 GB Mac. Each expensive command reserves its
measured footprint from one host-wide agent budget before it starts; a command
that does not fit waits in a FIFO queue and gives up after a timeout with a
message pointing at crabbox or CI. (PP-p2ts.5)

    agent-budget.py run <kind> -- <command> [args...]
        Reserve <kind>'s size, then exec <command>. The command keeps this PID,
        so the reservation lasts exactly as long as the command does. A dev
        server therefore holds its reservation for its lifetime.
    agent-budget.py acquire <kind> --pid <pid>
        Reserve on behalf of an already running process (pr-screenshots.mjs
        calls this for itself) and exit 0 once admitted.
    agent-budget.py status
        `pnpm run agent-load`: holders, waiters, and remaining budget.

There is no release step. A reservation counts only while its holder PID is
alive and still has the start time recorded at admission, so a normal exit, a
crash, and a reboot all free it the next time anyone reads the ledger.

Transparent passthrough (the command runs immediately, nothing is recorded):
  - $CI is set;
  - PINPOINT_AGENT_BUDGET=off;
  - the host is not macOS, unless PINPOINT_AGENT_BUDGET=on. The budget exists
    for this 16 GB laptop; the Bazzite runner and CI have their own isolation;
  - PINPOINT_AGENT_BUDGET_HELD is set: an ancestor already holds a reservation
    whose size covers this nested command (smoke's Playwright starts
    `pnpm run dev` as its web server).

Configuration:
  PINPOINT_AGENT_BUDGET_MB          total budget in MB (else the budget-mb file)
  <state>/budget-mb                 one integer, host-wide, read on every call
  PINPOINT_AGENT_BUDGET_TIMEOUT_S   queue timeout in seconds (default 300)
  PINPOINT_AGENT_BUDGET_POLL_S      queue poll interval in seconds (default 2)

State lives in ${XDG_STATE_HOME:-~/.local/state}/pinpoint/agent-budget/:
ledger.json (holders and queue) guarded by an fcntl lock on ledger.lock.
"""

from __future__ import annotations

import argparse
import contextlib
import fcntl
import json
import os
import subprocess
import sys
import time
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

# 8 GB of the Mac's 16: macOS, Tim's apps and the agent sessions themselves
# take most of the rest. It is the smallest budget that admits one `check`
# beside one dev server (5 + 3 GB, measured below); at 6 GB an agent with its
# own dev server up could never run `check`.
DEFAULT_BUDGET_MB = 8192
DEFAULT_TIMEOUT_S = 300
DEFAULT_POLL_S = 2.0
WAIT_NOTICE_EVERY_S = 60
EX_TEMPFAIL = 75

# Reserved size per kind, in MB of phys_footprint (`footprint`, not RSS: RSS
# counts shared frameworks once per process). "measured" means one run on Tim's
# 16 GB M5 Air, sampling the summed footprint of the command's process tree.
# Each value is that run's peak, rounded up.
KINDS: dict[str, dict[str, Any]] = {
    "check": {
        "mb": 5120,
        "source": "measured 2026-11-20: peak 5.0 GB for ~4 s (two tsgo "
        "typechecks 1.8 + 1.6 GB, tsgolint 1.1 GB), then ~0.5 GB",
        "offload": "`crabbox-slot job run check`, or push and let CI's static jobs judge",
    },
    "dev": {
        "mb": 3072,
        "source": "measured 2026-11-20 (remote Supabase backend, so Next.js "
        "only): 1.0 GB idle, 2.5 GB after 19 routes compiled, 2.9 GB compile "
        "spike; one 3.5 GB sample just before dev:stop",
        "offload": "stop a dev server nobody is using (`pnpm run dev:stop` in its worktree)",
    },
    "screenshots": {
        "mb": 1024,
        "source": "measured 2026-11-20: pr-screenshots.mjs, all 19 pages x 3 "
        "viewports, peak 0.7 GB (node + headless Chromium); the dev server it "
        "drives holds its own reservation",
        "offload": "stop a dev server nobody is using (`pnpm run dev:stop` in its worktree), then run it once more",
    },
    "unit": {
        "mb": 3277,
        "source": "2026-06 report: full unit suite ~3.2 GB (before the --max-workers=4 cap)",
        "offload": "`crabbox-slot job run unit`",
    },
    "coverage": {
        "mb": 3584,
        "source": "estimate: unit suite plus v8 coverage collection; not measured",
        "offload": "push and let CI run coverage",
    },
    "integration": {
        "mb": 3380,
        "source": "2026-06 report: --max-workers=2 peaks ~3.3 GB (PGlite forks)",
        "offload": "`crabbox-slot job run integration`",
    },
    "integration-supabase": {
        "mb": 2048,
        "source": "estimate: 2 Vitest workers against a real Postgres; not measured",
        "offload": "`crabbox-slot job run integration-supabase`",
    },
    "build": {
        "mb": 3072,
        "source": "estimate: next build; not measured (agents do not build locally)",
        "offload": "push and let CI build",
    },
    "smoke": {
        "mb": 4096,
        "source": "estimate: its own next dev server plus 4 Playwright browser "
        "projects; not measured (agents do not run E2E locally)",
        "offload": "`crabbox-slot job run smoke`",
    },
}

HELD_ENV = "PINPOINT_AGENT_BUDGET_HELD"


# ── configuration ────────────────────────────────────────────────────────────


def state_dir() -> Path:
    base = os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
    return Path(base) / "pinpoint" / "agent-budget"


def passthrough_reason() -> str | None:
    """Why this call skips the budget, or None when the budget applies."""
    if os.environ.get("CI"):
        return "CI"
    mode = os.environ.get("PINPOINT_AGENT_BUDGET", "").strip().lower()
    if mode == "off":
        return "PINPOINT_AGENT_BUDGET=off"
    if mode != "on" and sys.platform != "darwin":
        return "not macOS (set PINPOINT_AGENT_BUDGET=on to enforce)"
    if os.environ.get(HELD_ENV):
        return "an ancestor command already holds a reservation"
    return None


def budget_mb() -> int:
    raw = os.environ.get("PINPOINT_AGENT_BUDGET_MB")
    if raw is None:
        with contextlib.suppress(OSError):
            raw = (state_dir() / "budget-mb").read_text().strip()
    if raw:
        try:
            value = int(raw)
        except ValueError:
            print(f"agent-budget: ignoring non-integer budget {raw!r}", file=sys.stderr)
        else:
            if value > 0:
                return value
    return DEFAULT_BUDGET_MB


def timeout_s() -> float:
    raw = os.environ.get("PINPOINT_AGENT_BUDGET_TIMEOUT_S")
    try:
        return float(raw) if raw else DEFAULT_TIMEOUT_S
    except ValueError:
        return DEFAULT_TIMEOUT_S


def poll_s() -> float:
    raw = os.environ.get("PINPOINT_AGENT_BUDGET_POLL_S")
    try:
        return float(raw) if raw else DEFAULT_POLL_S
    except ValueError:
        return DEFAULT_POLL_S


# ── ledger ───────────────────────────────────────────────────────────────────


@contextlib.contextmanager
def locked_ledger() -> Iterator[dict[str, Any]]:
    """Yield the ledger under an exclusive lock; write it back on exit."""
    directory = state_dir()
    directory.mkdir(parents=True, exist_ok=True)
    with open(directory / "ledger.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = directory / "ledger.json"
        try:
            ledger = json.loads(path.read_text())
        except (OSError, ValueError):
            ledger = {}
        if not isinstance(ledger, dict):
            ledger = {}
        ledger.setdefault("holders", [])
        ledger.setdefault("queue", [])
        yield ledger
        tmp = path.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(ledger, indent=2) + "\n")
        tmp.replace(path)


def start_times(pids: list[int]) -> dict[int, str] | None:
    """Map PID → process start time from ps; None if ps could not run."""
    if not pids:
        return {}
    try:
        result = subprocess.run(
            ["ps", "-o", "pid=,lstart=", "-p", ",".join(str(p) for p in pids)],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    starts: dict[int, str] = {}
    for line in result.stdout.splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            starts[int(parts[0])] = " ".join(parts[1].split())
    return starts


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def prune(ledger: dict[str, Any]) -> None:
    """Drop holders and waiters whose process is gone (or is a reused PID)."""
    entries = ledger["holders"] + ledger["queue"]
    starts = start_times(sorted({e["pid"] for e in entries}))

    def live(entry: dict[str, Any]) -> bool:
        if not pid_alive(entry["pid"]):
            return False
        if starts is None or not entry.get("start"):
            return True  # cannot prove reuse; count it (conservative)
        return starts.get(entry["pid"]) == entry["start"]

    ledger["holders"] = [e for e in ledger["holders"] if live(e)]
    ledger["queue"] = [e for e in ledger["queue"] if live(e)]


def used_mb(ledger: dict[str, Any]) -> int:
    return sum(int(e["size_mb"]) for e in ledger["holders"])


# ── admission ────────────────────────────────────────────────────────────────


def describe(entry: dict[str, Any], now: float) -> str:
    age = int(now - entry.get("since", now))
    return (
        f"{entry['kind']:<20} {entry['size_mb']:>6} MB  pid {entry['pid']:<7} "
        f"{_age(age):>7}  {entry.get('worktree', '?')}"
    )


def _age(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m{seconds % 60:02d}s"
    return f"{seconds // 3600}h{(seconds % 3600) // 60:02d}m"


def _worktree() -> str:
    cwd = os.getcwd()
    home = str(Path.home())
    return "~" + cwd[len(home) :] if cwd.startswith(home) else cwd


def acquire(kind: str, pid: int) -> bool:
    """Wait for <kind>'s reservation on behalf of <pid>. True once admitted."""
    spec = KINDS[kind]
    size = int(spec["mb"])
    budget = budget_mb()
    starts = start_times([pid]) or {}
    entry = {
        "id": uuid.uuid4().hex,
        "kind": kind,
        "size_mb": size,
        "pid": pid,
        "start": starts.get(pid, ""),
        "worktree": _worktree(),
        "since": time.time(),
    }
    deadline = time.monotonic() + timeout_s()
    last_notice = -float("inf")
    queued = False
    try:
        while True:
            with locked_ledger() as ledger:
                prune(ledger)
                if not queued:
                    ledger["queue"].append(entry)
                    queued = True
                ids = [e["id"] for e in ledger["queue"]]
                used = used_mb(ledger)
                at_head = ids and ids[0] == entry["id"]
                # Strict FIFO: a later, smaller request never overtakes the
                # head, so a large request cannot starve. A request larger
                # than the whole budget is admitted onto an empty ledger.
                if at_head and (used + size <= budget or not ledger["holders"]):
                    ledger["queue"].pop(0)
                    queued = False
                    entry["since"] = time.time()
                    ledger["holders"].append(entry)
                    os.environ[HELD_ENV] = entry["id"]
                    return True
                if time.monotonic() >= deadline:
                    ledger["queue"] = [
                        e for e in ledger["queue"] if e["id"] != entry["id"]
                    ]
                    queued = False
                    _print_timeout(kind, size, budget, ledger)
                    return False
                if time.monotonic() - last_notice >= WAIT_NOTICE_EVERY_S:
                    ahead = ids.index(entry["id"]) if entry["id"] in ids else 0
                    print(
                        f"agent-budget: {kind} needs {size} MB; {budget - used} of "
                        f"{budget} MB free, {ahead} ahead in queue. Waiting up to "
                        f"{int(timeout_s())} s (pnpm run agent-load shows holders).",
                        file=sys.stderr,
                    )
                    last_notice = time.monotonic()
            time.sleep(poll_s())
    finally:
        if queued:
            with locked_ledger() as ledger:
                ledger["queue"] = [e for e in ledger["queue"] if e["id"] != entry["id"]]


def _print_timeout(kind: str, size: int, budget: int, ledger: dict[str, Any]) -> None:
    now = time.time()
    free = budget - used_mb(ledger)
    lines = [
        f"agent-budget: gave up after {int(timeout_s())} s: {kind} needs {size} MB "
        f"and only {free} of the {budget} MB agent budget is free.",
        "This Mac is at its agent memory budget. Do not retry in a loop.",
        f"Instead: {KINDS[kind]['offload']}.",
        "Holders:",
    ]
    lines += [f"  {describe(e, now)}" for e in ledger["holders"]] or ["  (none)"]
    print("\n".join(lines), file=sys.stderr)


# ── commands ─────────────────────────────────────────────────────────────────


def cmd_run(kind: str, command: list[str]) -> int:
    if not command:
        print("agent-budget: run needs a command after --", file=sys.stderr)
        return 64
    if passthrough_reason() is None and not acquire(kind, os.getpid()):
        return EX_TEMPFAIL
    sys.stdout.flush()
    sys.stderr.flush()
    try:
        os.execvp(command[0], command)
    except OSError as error:
        print(f"agent-budget: cannot run {command[0]}: {error}", file=sys.stderr)
        return 127


def cmd_acquire(kind: str, pid: int) -> int:
    if passthrough_reason() is not None:
        return 0
    return 0 if acquire(kind, pid) else EX_TEMPFAIL


def cmd_status() -> int:
    reason = passthrough_reason()
    if (
        reason is not None
        and reason != "an ancestor command already holds a reservation"
    ):
        print(f"agent budget: off ({reason}); commands run without reservations.")
        return 0
    budget = budget_mb()
    with locked_ledger() as ledger:
        prune(ledger)
        holders = list(ledger["holders"])
        queue = list(ledger["queue"])
    now = time.time()
    used = sum(int(e["size_mb"]) for e in holders)
    print(f"agent budget: {used} of {budget} MB reserved, {budget - used} MB free")
    print(f"holders ({len(holders)}):")
    for e in holders:
        print(f"  {describe(e, now)}")
    print(f"waiting ({len(queue)}):")
    for e in queue:
        print(f"  {describe(e, now)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="action", required=True)
    run = sub.add_parser("run", help="reserve, then exec the command")
    run.add_argument("kind", choices=sorted(KINDS))
    run.add_argument("command", nargs=argparse.REMAINDER)
    acq = sub.add_parser("acquire", help="reserve for a running process")
    acq.add_argument("kind", choices=sorted(KINDS))
    acq.add_argument("--pid", type=int, required=True)
    sub.add_parser("status", help="show holders and remaining budget")
    args = parser.parse_args(argv)

    if args.action == "run":
        command = args.command[1:] if args.command[:1] == ["--"] else args.command
        return cmd_run(args.kind, command)
    if args.action == "acquire":
        return cmd_acquire(args.kind, args.pid)
    return cmd_status()


if __name__ == "__main__":
    sys.exit(main())
