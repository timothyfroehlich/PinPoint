#!/usr/bin/env python3
"""Run a validation command with bounded model-visible output.

Successful logs are deleted. Warning and failure logs are retained for seven days
under ``tmp/validation-logs`` with mode 0600 so an agent can inspect the complete
evidence only when the bounded summary is insufficient.
"""

from __future__ import annotations

import argparse
import os
import re
import signal
import subprocess
import sys
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
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
WARNING_RE = re.compile(r"\bwarn(?:ing)?\b", re.IGNORECASE)
PASSED_RE = re.compile(r"\b(\d[\d,]*)\s+passed\b", re.IGNORECASE)
SENSITIVE_VALUE_RE = re.compile(
    r"(?i)(\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|CREDENTIAL|AUTH)[A-Z0-9_]*)"
    r"(?:['\"]?\s*[:=]\s*['\"]?))([^'\"\s,}]+)"
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", required=True, help="name shown in the verdict")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ["--"]:
        args.command = args.command[1:]
    if not args.command:
        parser.error("a command is required after --")
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


def main() -> int:
    args = _parse_args()
    log_dir = _log_dir()
    log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prune_old_logs(log_dir, time.time())
    log_path, log_handle = _new_log(args.label, log_dir)

    started = time.monotonic()
    process: subprocess.Popen[bytes] | None = None
    received_signal: int | None = None

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
        returncode = process.wait()
    finally:
        log_handle.close()
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
