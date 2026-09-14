#!/usr/bin/env python3
"""Run PinPoint preflight validation with phase progress and heartbeats.

Orchestrates each preflight gate in canonical order. In default compact mode,
detailed command output is captured in a private 0600 log file under
tmp/validation-logs, while stderr receives bounded phase transitions
(PHASE <name> START / COMPLETE) and periodic heartbeats for long phases.
On success, the log is deleted (unless warnings occurred); on failure,
an excerpt and log path are displayed.
In --human mode, commands stream directly to standard streams without capture.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import stat
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from types import FrameType

REPO_ROOT = Path(__file__).resolve().parents[2]
LOG_RETENTION_DAYS = 7
WARNING_LIMIT = 8
HEAD_LINES = 8
TAIL_LINES = 16
LINE_LIMIT = 240
DEFAULT_HEARTBEAT_SECONDS = 60.0

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
WARNING_RE = re.compile(r"\bwarn(?:ing)?\b", re.IGNORECASE)
PASSED_RE = re.compile(r"\b(\d[\d,]*)\s+passed\b", re.IGNORECASE)
SENSITIVE_VALUE_RE = re.compile(
    r"(?i)(\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|CREDENTIAL|AUTH)[A-Z0-9_]*)"
    r"(?:['\"]?\s*[:=]\s*['\"]?))([^'\"\s,}]+)"
)

# Canonical preflight phases: sequence of PhaseSpec items.
DEFAULT_PHASES = [
    {
        "name": "database-readiness",
        "command": ["bash", "scripts/workflow/preflight-readiness.sh"],
    },
    {
        "name": "prototype-clean",
        "command": ["bash", "scripts/hooks/prototype-clean-guard.sh"],
    },
    {
        "parallel": [
            {
                "name": "static-checks",
                "command": [
                    "pnpm",
                    "exec",
                    "npm-run-all",
                    "--silent",
                    "--parallel",
                    "typecheck",
                    "typecheck:tests",
                    "typecheck:e2e",
                    "fix:lint-format",
                    "check:config",
                ],
            },
            {
                "name": "unit-tests",
                "command": ["pnpm", "run", "test:human"],
            },
        ]
    },
    {
        "name": "database-reset",
        "command": ["pnpm", "run", "db:fast-reset"],
    },
    {
        "name": "build",
        "command": ["pnpm", "run", "build"],
    },
    {
        "name": "integration",
        "command": ["pnpm", "run", "test:integration"],
    },
    {
        "name": "supabase-integration",
        "command": ["pnpm", "run", "test:integration:supabase"],
    },
    {
        "name": "smoke",
        "command": ["pnpm", "run", "smoke"],
    },
]


def _positive_seconds(value: str) -> float:
    try:
        seconds = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            "heartbeat interval must be a number"
        ) from error
    if seconds <= 0:
        raise argparse.ArgumentTypeError("heartbeat interval must be greater than zero")
    return seconds


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--label",
        default="preflight",
        help="name shown in progress transitions and verdict (default: preflight)",
    )
    parser.add_argument(
        "--human",
        action="store_true",
        help="stream all phase outputs directly without log capture",
    )
    parser.add_argument(
        "--heartbeat-seconds",
        default=DEFAULT_HEARTBEAT_SECONDS,
        type=_positive_seconds,
        help=f"heartbeat interval for active phases (default: {DEFAULT_HEARTBEAT_SECONDS:g}s)",
    )
    return parser.parse_args()


def _log_dir() -> Path:
    override = os.environ.get("PINPOINT_QUIET_LOG_DIR")
    if override:
        path = Path(override)
    else:
        path = REPO_ROOT / "tmp" / "validation-logs"
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def _prune_old_logs(log_dir: Path) -> None:
    cutoff = time.time() - (LOG_RETENTION_DAYS * 24 * 60 * 60)
    for entry in log_dir.glob("*.log"):
        try:
            if entry.stat().st_mtime < cutoff:
                entry.unlink(missing_ok=True)
        except OSError:
            pass


def _clean_line(line: str) -> str:
    clean = ANSI_ESCAPE_RE.sub("", line).strip()
    clean = SENSITIVE_VALUE_RE.sub(r"\1[REDACTED]", clean)
    if len(clean) > LINE_LIMIT:
        return f"{clean[: LINE_LIMIT - 1]}…"
    return clean


def _inspect_log(path: Path) -> tuple[int, list[str], int | None]:
    warnings: list[str] = []
    seen_warnings: set[str] = set()
    total_passed = 0

    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for raw_line in handle:
                clean = ANSI_ESCAPE_RE.sub("", raw_line).strip()
                if not clean:
                    continue
                for match in PASSED_RE.finditer(clean):
                    total_passed += int(match.group(1).replace(",", ""))
                if WARNING_RE.search(clean):
                    formatted = _clean_line(clean)
                    if formatted not in seen_warnings:
                        seen_warnings.add(formatted)
                        if len(warnings) < WARNING_LIMIT:
                            warnings.append(formatted)
    except OSError:
        pass

    passed_count = total_passed if total_passed > 0 else None
    return len(seen_warnings), warnings, passed_count


def _format_summary(path: Path) -> list[str]:
    lines: list[str] = []
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            lines = [_clean_line(line) for line in handle if line.strip()]
    except OSError as error:
        return [f"unable to read log output: {error}"]

    if not lines:
        return ["command emitted no output"]
    if len(lines) <= HEAD_LINES + TAIL_LINES:
        return lines

    omitted = len(lines) - (HEAD_LINES + TAIL_LINES)
    return [
        *lines[:HEAD_LINES],
        f"… {omitted} lines omitted …",
        *lines[-TAIL_LINES:],
    ]


def _load_phases() -> list[dict]:
    phases_env = os.environ.get("PINPOINT_PREFLIGHT_PHASES_JSON")
    if phases_env:
        return json.loads(phases_env)
    return DEFAULT_PHASES


def _exit_for_returncode(returncode: int) -> int:
    return returncode if returncode >= 0 else 128 + abs(returncode)


def _reap_processes(
    procs: list[subprocess.Popen],
    active_processes: list[subprocess.Popen],
    signum: int | None = None,
) -> None:
    """Signal unfinished processes (if signum given) and wait for all started children to exit."""
    if signum is not None:
        for proc in procs:
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signum)
                except OSError:
                    try:
                        proc.send_signal(signum)
                    except OSError:
                        pass
    for proc in procs:
        if proc.poll() is None:
            try:
                proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except OSError:
                    try:
                        proc.kill()
                    except OSError:
                        pass
                try:
                    proc.wait(timeout=2.0)
                except (subprocess.TimeoutExpired, OSError):
                    pass
            except OSError:
                pass
        if proc in active_processes:
            active_processes.remove(proc)


def _run_human_mode(phases: list[dict], label: str = "preflight") -> int:
    active_processes: list[subprocess.Popen] = []
    received_signal: int | None = None

    def forward_signal(signum: int, _frame: FrameType | None) -> None:
        nonlocal received_signal
        received_signal = signum
        for proc in active_processes:
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signum)
                except OSError:
                    try:
                        proc.send_signal(signum)
                    except OSError:
                        pass

    previous_handlers = {
        signum: signal.signal(signum, forward_signal)
        for signum in (signal.SIGINT, signal.SIGTERM)
    }

    try:
        for item in phases:
            if received_signal is not None:
                break

            if "parallel" in item:
                group = item["parallel"]
                procs: list[dict] = []
                for job in group:
                    name = job["name"]
                    print(f"{label}: PHASE {name} START", file=sys.stderr, flush=True)
                    try:
                        proc = subprocess.Popen(
                            job["command"],
                            cwd=REPO_ROOT,
                            start_new_session=True,
                        )
                    except OSError as error:
                        print(
                            f"{label}: failed to start {name}: {error}", file=sys.stderr
                        )
                        _reap_processes(
                            [p["proc"] for p in procs],
                            active_processes,
                            signum=signal.SIGTERM,
                        )
                        return 127
                    procs.append(
                        {
                            "name": name,
                            "proc": proc,
                            "started": time.monotonic(),
                            "done": False,
                            "exit": None,
                        }
                    )
                    active_processes.append(proc)

                while any(not p["done"] for p in procs):
                    if received_signal is not None:
                        break
                    time.sleep(0.05)
                    for p in procs:
                        if p["done"]:
                            continue
                        ret = p["proc"].poll()
                        if ret is not None:
                            p["done"] = True
                            p["exit"] = ret
                            elapsed = time.monotonic() - p["started"]
                            print(
                                f"{label}: PHASE {p['name']} COMPLETE ({elapsed:.1f}s)",
                                file=sys.stderr,
                                flush=True,
                            )
                            if p["proc"] in active_processes:
                                active_processes.remove(p["proc"])

                if received_signal is not None:
                    _reap_processes(
                        [p["proc"] for p in procs],
                        active_processes,
                        signum=received_signal,
                    )
                    for p in procs:
                        p["done"] = True
                        p["exit"] = p["proc"].returncode

                interrupted = next(
                    (p for p in procs if p["exit"] is not None and p["exit"] < 0),
                    None,
                )
                if interrupted is not None:
                    _reap_processes(
                        [p["proc"] for p in procs],
                        active_processes,
                        signum=signal.SIGTERM,
                    )
                    return 128 + abs(interrupted["exit"])

                failed = next((p for p in procs if p["exit"] not in (0, None)), None)
                if failed is not None:
                    return _exit_for_returncode(failed["exit"])

            else:
                name = item["name"]
                cmd = item["command"]
                print(f"{label}: PHASE {name} START", file=sys.stderr, flush=True)
                started = time.monotonic()
                try:
                    proc = subprocess.Popen(
                        cmd,
                        cwd=REPO_ROOT,
                        start_new_session=True,
                    )
                except OSError as error:
                    print(f"{label}: failed to start {name}: {error}", file=sys.stderr)
                    return 127
                active_processes.append(proc)
                ret = proc.wait()
                if proc in active_processes:
                    active_processes.remove(proc)
                elapsed = time.monotonic() - started
                print(
                    f"{label}: PHASE {name} COMPLETE ({elapsed:.1f}s)",
                    file=sys.stderr,
                    flush=True,
                )
                if ret < 0:
                    return 128 + abs(ret)
                if ret != 0:
                    return _exit_for_returncode(ret)

    finally:
        _reap_processes(list(active_processes), active_processes, signum=signal.SIGTERM)
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)

    if received_signal is not None:
        signame = signal.Signals(received_signal).name
        print(f"{label}: INTERRUPTED by {signame}", file=sys.stderr, flush=True)
        return 128 + received_signal

    return 0


def main() -> int:
    args = _parse_args()
    phases = _load_phases()

    if args.human:
        return _run_human_mode(phases, label=args.label)

    log_dir = _log_dir()
    _prune_old_logs(log_dir)

    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    pid = os.getpid()
    log_path = log_dir / f"{args.label}-{timestamp}-{pid}.log"
    log_handle = log_path.open("w+", encoding="utf-8", buffering=1)
    os.chmod(log_path, stat.S_IRUSR | stat.S_IWUSR)

    overall_start = time.monotonic()
    active_processes: list[subprocess.Popen] = []
    received_signal: int | None = None

    def forward_signal(signum: int, _frame: FrameType | None) -> None:
        nonlocal received_signal
        received_signal = signum
        for proc in active_processes:
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signum)
                except OSError:
                    try:
                        proc.send_signal(signum)
                    except OSError:
                        pass

    previous_handlers = {
        signum: signal.signal(signum, forward_signal)
        for signum in (signal.SIGINT, signal.SIGTERM)
    }

    try:
        for item in phases:
            if received_signal is not None:
                break

            if "parallel" in item:
                group = item["parallel"]
                procs: list[dict] = []
                for job in group:
                    name = job["name"]
                    print(
                        f"{args.label}: PHASE {name} START", file=sys.stderr, flush=True
                    )
                    log_handle.write(f"\n--- PHASE {name} START ---\n")
                    try:
                        proc = subprocess.Popen(
                            job["command"],
                            cwd=REPO_ROOT,
                            stdout=log_handle,
                            stderr=subprocess.STDOUT,
                            start_new_session=True,
                        )
                    except OSError as error:
                        print(
                            f"{args.label}: failed to start {name}: {error}",
                            file=sys.stderr,
                        )
                        _reap_processes(
                            [p["proc"] for p in procs],
                            active_processes,
                            signum=signal.SIGTERM,
                        )
                        return 127
                    procs.append(
                        {
                            "name": name,
                            "proc": proc,
                            "started": time.monotonic(),
                            "last_heartbeat": time.monotonic(),
                            "done": False,
                            "exit": None,
                        }
                    )
                    active_processes.append(proc)

                while any(not p["done"] for p in procs):
                    if received_signal is not None:
                        break
                    time.sleep(0.05)
                    now = time.monotonic()
                    for p in procs:
                        if p["done"]:
                            continue
                        ret = p["proc"].poll()
                        if ret is not None:
                            p["done"] = True
                            p["exit"] = ret
                            elapsed = now - p["started"]
                            print(
                                f"{args.label}: PHASE {p['name']} COMPLETE ({elapsed:.1f}s)",
                                file=sys.stderr,
                                flush=True,
                            )
                            if p["proc"] in active_processes:
                                active_processes.remove(p["proc"])
                        else:
                            if now - p["last_heartbeat"] >= args.heartbeat_seconds:
                                elapsed = now - p["started"]
                                print(
                                    f"{args.label}: HEARTBEAT {p['name']} ({elapsed:.1f}s elapsed)",
                                    file=sys.stderr,
                                    flush=True,
                                )
                                p["last_heartbeat"] = now

                if received_signal is not None:
                    _reap_processes(
                        [p["proc"] for p in procs],
                        active_processes,
                        signum=received_signal,
                    )
                    for p in procs:
                        p["done"] = True
                        p["exit"] = p["proc"].returncode

                interrupted = next(
                    (p for p in procs if p["exit"] is not None and p["exit"] < 0),
                    None,
                )
                if interrupted is not None:
                    _reap_processes(
                        [p["proc"] for p in procs],
                        active_processes,
                        signum=signal.SIGTERM,
                    )
                    signum = abs(interrupted["exit"])
                    signame = signal.Signals(signum).name
                    total_elapsed = time.monotonic() - overall_start
                    log_handle.flush()
                    size = log_path.stat().st_size
                    print(
                        f"{args.label}: INTERRUPTED by {signame} ({total_elapsed:.1f}s, {size} bytes)",
                        file=sys.stderr,
                        flush=True,
                    )
                    print(f"full log: {log_path}", file=sys.stderr)
                    return 128 + signum

                failed = next((p for p in procs if p["exit"] not in (0, None)), None)
                if failed is not None:
                    exit_code = _exit_for_returncode(failed["exit"])
                    total_elapsed = time.monotonic() - overall_start
                    log_handle.flush()
                    size = log_path.stat().st_size
                    print(
                        f"{args.label}: FAIL exit {exit_code} ({total_elapsed:.1f}s, {size} bytes)",
                        file=sys.stderr,
                        flush=True,
                    )
                    for line in _format_summary(log_path):
                        print(f"  {line}", file=sys.stderr)
                    print(f"full log: {log_path}", file=sys.stderr)
                    return exit_code

            else:
                name = item["name"]
                cmd = item["command"]
                print(f"{args.label}: PHASE {name} START", file=sys.stderr, flush=True)
                log_handle.write(f"\n--- PHASE {name} START ---\n")
                started = time.monotonic()
                last_heartbeat = started
                try:
                    proc = subprocess.Popen(
                        cmd,
                        cwd=REPO_ROOT,
                        stdout=log_handle,
                        stderr=subprocess.STDOUT,
                        start_new_session=True,
                    )
                except OSError as error:
                    print(
                        f"{args.label}: failed to start {name}: {error}",
                        file=sys.stderr,
                    )
                    return 127
                active_processes.append(proc)

                while proc.poll() is None:
                    if received_signal is not None:
                        break
                    time.sleep(0.05)
                    now = time.monotonic()
                    if now - last_heartbeat >= args.heartbeat_seconds:
                        elapsed = now - started
                        print(
                            f"{args.label}: HEARTBEAT {name} ({elapsed:.1f}s elapsed)",
                            file=sys.stderr,
                            flush=True,
                        )
                        last_heartbeat = now

                ret = proc.wait()
                if proc in active_processes:
                    active_processes.remove(proc)
                elapsed = time.monotonic() - started
                print(
                    f"{args.label}: PHASE {name} COMPLETE ({elapsed:.1f}s)",
                    file=sys.stderr,
                    flush=True,
                )

                if ret < 0:
                    signum = abs(ret)
                    signame = signal.Signals(signum).name
                    total_elapsed = time.monotonic() - overall_start
                    log_handle.flush()
                    size = log_path.stat().st_size
                    print(
                        f"{args.label}: INTERRUPTED by {signame} ({total_elapsed:.1f}s, {size} bytes)",
                        file=sys.stderr,
                        flush=True,
                    )
                    print(f"full log: {log_path}", file=sys.stderr)
                    return 128 + signum
                elif ret != 0:
                    exit_code = _exit_for_returncode(ret)
                    total_elapsed = time.monotonic() - overall_start
                    log_handle.flush()
                    size = log_path.stat().st_size
                    print(
                        f"{args.label}: FAIL exit {exit_code} ({total_elapsed:.1f}s, {size} bytes)",
                        file=sys.stderr,
                        flush=True,
                    )
                    for line in _format_summary(log_path):
                        print(f"  {line}", file=sys.stderr)
                    print(f"full log: {log_path}", file=sys.stderr)
                    return exit_code

    finally:
        _reap_processes(list(active_processes), active_processes, signum=signal.SIGTERM)
        log_handle.close()
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)

    if received_signal is not None:
        signame = signal.Signals(received_signal).name
        total_elapsed = time.monotonic() - overall_start
        size = log_path.stat().st_size
        print(
            f"{args.label}: INTERRUPTED by {signame} ({total_elapsed:.1f}s, {size} bytes)",
            file=sys.stderr,
            flush=True,
        )
        print(f"full log: {log_path}", file=sys.stderr, flush=True)
        return 128 + received_signal

    total_elapsed = time.monotonic() - overall_start
    size = log_path.stat().st_size
    unique_warnings_count, sample_warnings, total_passed = _inspect_log(log_path)

    passed_suffix = f", {total_passed} passed" if total_passed else ""
    if unique_warnings_count > 0:
        print(
            f"{args.label}: PASS_WITH_WARNINGS ({unique_warnings_count} unique warnings, "
            f"{len(sample_warnings)} shown{passed_suffix}, {total_elapsed:.1f}s, {size} bytes)",
            flush=True,
        )
        for warning in sample_warnings:
            print(f"  {warning}")
        print(f"full log: {log_path}")
    else:
        log_path.unlink(missing_ok=True)
        print(
            f"{args.label}: PASS ({total_elapsed:.1f}s, {size} bytes{passed_suffix})",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
