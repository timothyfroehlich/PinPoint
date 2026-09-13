#!/usr/bin/env python3
"""Run a validation command with bounded model-visible output.

Successful logs are deleted. Warning and failure logs are retained for seven days
under ``tmp/validation-logs`` with mode 0600 so an agent can inspect the complete
evidence only when the bounded summary is insufficient. Callers may declare
explicit validation phases; those emit one start/completion transition and, after
60 seconds by default, a configurable heartbeat containing only the phase label and
elapsed time. Child output never shares the progress channel.
"""

from __future__ import annotations

import argparse
import os
import re
import select
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from types import FrameType
from typing import BinaryIO

REPO_ROOT = Path(__file__).parent.parent
DEFAULT_LOG_DIR = REPO_ROOT / "tmp" / "validation-logs"
RETENTION_SECONDS = 7 * 24 * 60 * 60
WARNING_LIMIT = 8
HEAD_LINES = 8
TAIL_LINES = 16
LINE_LIMIT = 240
DEFAULT_HEARTBEAT_SECONDS = 60.0
PROGRESS_SOCKET_ENV = "PINPOINT_QUIET_PROGRESS_SOCKET"
PHASE_ID_RE = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\Z")
PHASE_SETS = {
    "preflight": (
        "database-readiness",
        "static-checks",
        "unit-tests",
        "database-reset",
        "build",
        "integration",
        "supabase-integration",
        "smoke",
    )
}
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
WARNING_RE = re.compile(r"\bwarn(?:ing)?\b", re.IGNORECASE)
PASSED_RE = re.compile(r"\b(\d[\d,]*)\s+passed\b", re.IGNORECASE)
SENSITIVE_VALUE_RE = re.compile(
    r"(?i)(\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|CREDENTIAL|AUTH)[A-Z0-9_]*)"
    r"(?:['\"]?\s*[:=]\s*['\"]?))([^'\"\s,}]+)"
)


def _phase_id(value: str) -> str:
    if PHASE_ID_RE.fullmatch(value) is None:
        raise argparse.ArgumentTypeError(
            "phase must be 1-64 lowercase letters, digits, or hyphens"
        )
    return value


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
    parser.add_argument("--label", required=True, help="name shown in the verdict")
    parser.add_argument(
        "--phase",
        action="append",
        default=[],
        type=_phase_id,
        help="allowed progress phase ID; repeat for each phase",
    )
    parser.add_argument(
        "--phase-set",
        choices=sorted(PHASE_SETS),
        help="declare a maintained phase allowlist",
    )
    parser.add_argument(
        "--heartbeat-seconds",
        default=DEFAULT_HEARTBEAT_SECONDS,
        type=_positive_seconds,
        help=f"heartbeat interval for active phases (default: {DEFAULT_HEARTBEAT_SECONDS:g})",
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ["--"]:
        args.command = args.command[1:]
    if not args.command:
        parser.error("a command is required after --")
    if args.phase_set is not None:
        args.phase = list(dict.fromkeys((*PHASE_SETS[args.phase_set], *args.phase)))
    return args


def _log_dir() -> Path:
    configured = os.environ.get("PINPOINT_QUIET_LOG_DIR")
    return Path(configured).resolve() if configured else DEFAULT_LOG_DIR.resolve()


def _prune_old_logs(log_dir: Path, now: float) -> None:
    for path in log_dir.glob("*.log"):
        try:
            if now - path.stat().st_mtime > RETENTION_SECONDS:
                path.unlink()
        except FileNotFoundError:
            continue


def _new_log(label: str, log_dir: Path) -> tuple[Path, BinaryIO]:
    safe_label = re.sub(r"[^A-Za-z0-9_.-]+", "-", label).strip("-") or "command"
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = log_dir / f"{safe_label}-{timestamp}-{os.getpid()}.log"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    return path, os.fdopen(descriptor, "wb")


def _clean_line(line: str) -> str:
    clean = ANSI_ESCAPE_RE.sub("", line).strip()
    clean = SENSITIVE_VALUE_RE.sub(r"\1[REDACTED]", clean)
    if len(clean) > LINE_LIMIT:
        return f"{clean[: LINE_LIMIT - 1]}…"
    return clean


def _warning_lines(lines: list[str]) -> tuple[int, list[str]]:
    warnings: list[str] = []
    seen: set[str] = set()
    for line in lines:
        clean = _clean_line(line)
        if not clean or not WARNING_RE.search(clean) or clean in seen:
            continue
        seen.add(clean)
        if len(warnings) < WARNING_LIMIT:
            warnings.append(clean)
    return len(seen), warnings


def _passed_count(lines: list[str]) -> int | None:
    counts = [
        int(match.group(1).replace(",", ""))
        for line in lines
        for match in PASSED_RE.finditer(ANSI_ESCAPE_RE.sub("", line))
    ]
    return max(counts, default=None)


def _failure_excerpt(lines: list[str]) -> list[str]:
    nonempty = [_clean_line(line) for line in lines if line.strip()]
    if len(nonempty) <= HEAD_LINES + TAIL_LINES:
        return nonempty
    return [
        *nonempty[:HEAD_LINES],
        f"… {len(nonempty) - HEAD_LINES - TAIL_LINES} lines omitted …",
        *nonempty[-TAIL_LINES:],
    ]


def _exit_for_returncode(returncode: int) -> int:
    return returncode if returncode >= 0 else 128 + abs(returncode)


def _open_progress_socket() -> tuple[socket.socket, Path]:
    progress_dir = Path(tempfile.mkdtemp(prefix="pinpoint-quiet-", dir="/tmp"))
    socket_path = progress_dir / "events.sock"
    progress_socket = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        progress_socket.bind(str(socket_path))
        os.chmod(socket_path, 0o600)
        progress_socket.setblocking(False)
    except OSError:
        progress_socket.close()
        shutil.rmtree(progress_dir, ignore_errors=True)
        raise
    return progress_socket, progress_dir


def _drain_progress_events(
    progress_socket: socket.socket,
    *,
    allowed_phases: set[str],
    active_phases: dict[str, float],
    completed_phases: set[str],
    label: str,
) -> None:
    while True:
        try:
            payload = progress_socket.recv(256)
        except BlockingIOError:
            return

        try:
            version, event, phase = payload.decode("ascii").split("\t")
        except (UnicodeDecodeError, ValueError):
            continue
        if version != "1" or phase not in allowed_phases:
            continue

        now = time.monotonic()
        if (
            event == "start"
            and phase not in active_phases
            and phase not in completed_phases
        ):
            active_phases[phase] = now
            print(f"{label}: PHASE {phase} START", file=sys.stderr, flush=True)
        elif event == "complete" and phase in active_phases:
            elapsed = now - active_phases.pop(phase)
            completed_phases.add(phase)
            print(
                f"{label}: PHASE {phase} COMPLETE ({elapsed:.1f}s)",
                file=sys.stderr,
                flush=True,
            )


def _wait_with_progress(
    process: subprocess.Popen[bytes],
    progress_socket: socket.socket,
    *,
    phases: list[str],
    heartbeat_seconds: float,
    label: str,
) -> int:
    allowed_phases = set(phases)
    active_phases: dict[str, float] = {}
    completed_phases: set[str] = set()
    last_heartbeats: dict[str, float] = {}

    while process.poll() is None:
        readable, _, _ = select.select([progress_socket], [], [], 0.1)
        if readable:
            _drain_progress_events(
                progress_socket,
                allowed_phases=allowed_phases,
                active_phases=active_phases,
                completed_phases=completed_phases,
                label=label,
            )

        now = time.monotonic()
        for phase, phase_started in active_phases.items():
            last_heartbeat = last_heartbeats.get(phase, phase_started)
            if now - last_heartbeat < heartbeat_seconds:
                continue
            print(
                f"{label}: HEARTBEAT {phase} ({now - phase_started:.1f}s elapsed)",
                file=sys.stderr,
                flush=True,
            )
            last_heartbeats[phase] = now

    _drain_progress_events(
        progress_socket,
        allowed_phases=allowed_phases,
        active_phases=active_phases,
        completed_phases=completed_phases,
        label=label,
    )
    return process.wait()


def main() -> int:
    args = _parse_args()
    log_dir = _log_dir()
    log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prune_old_logs(log_dir, time.time())
    log_path, log_handle = _new_log(args.label, log_dir)

    started = time.monotonic()
    process: subprocess.Popen[bytes] | None = None
    received_signal: int | None = None
    progress_socket: socket.socket | None = None
    progress_dir: Path | None = None
    child_env = os.environ.copy()
    if args.phase:
        progress_socket, progress_dir = _open_progress_socket()
        child_env[PROGRESS_SOCKET_ENV] = str(progress_dir / "events.sock")

    def forward_signal(signum: int, _frame: FrameType | None) -> None:
        nonlocal received_signal
        received_signal = signum
        if process is not None:
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass

    previous_handlers = {
        signum: signal.signal(signum, forward_signal)
        for signum in (signal.SIGINT, signal.SIGTERM)
    }
    try:
        try:
            process = subprocess.Popen(
                args.command,
                env=child_env,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        except OSError as error:
            log_handle.close()
            log_path.unlink(missing_ok=True)
            print(
                f"{args.label}: NO_VERDICT unable to start command: {_clean_line(str(error))}",
                file=sys.stderr,
            )
            return 127
        if progress_socket is None:
            returncode = process.wait()
        else:
            returncode = _wait_with_progress(
                process,
                progress_socket,
                phases=args.phase,
                heartbeat_seconds=args.heartbeat_seconds,
                label=args.label,
            )
    finally:
        log_handle.close()
        if progress_socket is not None:
            progress_socket.close()
        if progress_dir is not None:
            shutil.rmtree(progress_dir, ignore_errors=True)
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)

    elapsed = time.monotonic() - started
    byte_count = log_path.stat().st_size
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    warning_count, warnings = _warning_lines(lines)
    passed = _passed_count(lines)
    count_text = f", {passed} passed" if passed is not None else ""

    if received_signal is not None or returncode < 0:
        signum = received_signal or abs(returncode)
        signal_name = signal.Signals(signum).name
        print(
            f"{args.label}: INTERRUPTED by {signal_name} "
            f"({elapsed:.1f}s, {byte_count} bytes)",
            file=sys.stderr,
        )
        print(f"full log: {log_path}", file=sys.stderr)
        return 128 + signum

    if returncode != 0:
        print(
            f"{args.label}: FAIL exit {returncode} "
            f"({elapsed:.1f}s, {byte_count} bytes)",
            file=sys.stderr,
        )
        for line in _failure_excerpt(lines):
            print(f"  {line}", file=sys.stderr)
        print(f"full log: {log_path}", file=sys.stderr)
        return _exit_for_returncode(returncode)

    if warning_count:
        print(
            f"{args.label}: PASS_WITH_WARNINGS "
            f"({warning_count} unique warnings, {len(warnings)} shown{count_text}, "
            f"{elapsed:.1f}s, {byte_count} bytes)"
        )
        for line in warnings:
            print(f"  {line}")
        print(f"full log: {log_path}")
        return 0

    log_path.unlink()
    print(f"{args.label}: PASS ({elapsed:.1f}s{count_text}, {byte_count} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
