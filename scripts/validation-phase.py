#!/usr/bin/env python3
"""Run one validation phase and emit optional quiet-run progress events."""

from __future__ import annotations

import argparse
import os
import re
import signal
import socket
import subprocess
import sys

PROGRESS_SOCKET_ENV = "PINPOINT_QUIET_PROGRESS_SOCKET"
PHASE_ID_RE = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\Z")


def _phase_id(value: str) -> str:
    if PHASE_ID_RE.fullmatch(value) is None:
        raise argparse.ArgumentTypeError(
            "phase must be 1-64 lowercase letters, digits, or hyphens"
        )
    return value


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase",
        required=True,
        type=_phase_id,
        help="stable lowercase phase identifier",
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ["--"]:
        args.command = args.command[1:]
    if not args.command:
        parser.error("a command is required after --")
    return args


def _emit(event: str, phase: str) -> None:
    socket_path = os.environ.get(PROGRESS_SOCKET_ENV)
    if socket_path is None:
        return

    payload = f"1\t{event}\t{phase}".encode()
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as progress_socket:
            progress_socket.sendto(payload, socket_path)
    except OSError:
        # Progress reporting is observational. It must never change the gate result.
        return


def _preserve_returncode(returncode: int) -> int:
    if returncode >= 0:
        return returncode

    signum = abs(returncode)
    signal.signal(signum, signal.SIG_DFL)
    os.kill(os.getpid(), signum)
    return 128 + signum


def main() -> int:
    args = _parse_args()
    _emit("start", args.phase)
    try:
        process = subprocess.Popen(args.command)
    except OSError as error:
        print(
            f"unable to start validation phase {args.phase}: {error}", file=sys.stderr
        )
        _emit("complete", args.phase)
        return 127

    try:
        returncode = process.wait()
    except KeyboardInterrupt:
        # The child shares this process group and receives the same SIGINT.
        # Suppress Python's wrapper traceback while retaining shell-compatible 130.
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        return 130

    _emit("complete", args.phase)
    return _preserve_returncode(returncode)


if __name__ == "__main__":
    raise SystemExit(main())
