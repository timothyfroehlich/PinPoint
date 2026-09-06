"""Tests for the bounded validation-command output wrapper (PP-sec4)."""

import json
import os
import signal
import stat
import subprocess
import sys
import time
from pathlib import Path

QUIET_RUN = Path(__file__).parent.parent / "quiet-run.py"
REPO_ROOT = Path(__file__).parents[2]


def _run_quiet(
    tmp_path: Path, label: str, code: str
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    return subprocess.run(
        [
            sys.executable,
            str(QUIET_RUN),
            "--label",
            label,
            "--",
            sys.executable,
            "-c",
            code,
        ],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _artifact_from(output: str) -> Path:
    artifact_line = next(line for line in output.splitlines() if "full log:" in line)
    return Path(artifact_line.split("full log:", 1)[1].strip())


def test_success_emits_one_line_and_deletes_log(tmp_path: Path) -> None:
    result = _run_quiet(tmp_path, "test", "print('17 passed')")

    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout.count("\n") == 1
    assert result.stdout.startswith("test: PASS (")
    assert "17 passed" in result.stdout
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_warning_emits_bounded_index_and_retains_private_log(tmp_path: Path) -> None:
    result = _run_quiet(
        tmp_path,
        "check",
        "print('warning: first')\nprint('warning: second')\nprint('4 passed')",
    )

    assert result.returncode == 0
    assert "check: PASS_WITH_WARNINGS" in result.stdout
    assert "warning: first" in result.stdout
    assert "warning: second" in result.stdout
    assert "4 passed" in result.stdout
    artifact = _artifact_from(result.stdout)
    assert artifact.read_text() == "warning: first\nwarning: second\n4 passed\n"
    assert stat.S_IMODE(artifact.stat().st_mode) == 0o600


def test_failure_preserves_exit_and_bounded_head_and_tail(tmp_path: Path) -> None:
    code = "\n".join(
        [
            "print('early root cause')",
            "for number in range(40):",
            "    print(f'filler {number}')",
            "print('late cleanup failure')",
            "raise SystemExit(7)",
        ]
    )
    result = _run_quiet(tmp_path, "check", code)

    assert result.returncode == 7
    assert result.stdout == ""
    assert "check: FAIL exit 7" in result.stderr
    assert "early root cause" in result.stderr
    assert "lines omitted" in result.stderr
    assert "late cleanup failure" in result.stderr
    assert result.stderr.count("filler") < 40
    artifact = _artifact_from(result.stderr)
    raw = artifact.read_text()
    assert "filler 0" in raw
    assert "filler 39" in raw
    assert stat.S_IMODE(artifact.stat().st_mode) == 0o600


def test_failure_excerpt_redacts_secret_shaped_values(tmp_path: Path) -> None:
    result = _run_quiet(
        tmp_path,
        "check",
        "print('SERVICE_API_TOKEN=synthetic-secret')\nraise SystemExit(1)",
    )

    assert result.returncode == 1
    assert "synthetic-secret" not in result.stderr
    assert "SERVICE_API_TOKEN=[REDACTED]" in result.stderr
    assert "synthetic-secret" in _artifact_from(result.stderr).read_text()


def test_missing_command_is_no_verdict_without_artifact(tmp_path: Path) -> None:
    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    result = subprocess.run(
        [
            sys.executable,
            str(QUIET_RUN),
            "--label",
            "check",
            "--",
            str(tmp_path / "missing-command"),
        ],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 127
    assert "check: NO_VERDICT" in result.stderr
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_interrupt_is_forwarded_and_reported(tmp_path: Path) -> None:
    ready_file = tmp_path / "ready"
    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    process = subprocess.Popen(
        [
            sys.executable,
            str(QUIET_RUN),
            "--label",
            "test",
            "--",
            sys.executable,
            "-c",
            (
                "from pathlib import Path; import time; "
                f"Path({str(ready_file)!r}).write_text('ready'); time.sleep(30)"
            ),
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    deadline = time.monotonic() + 5
    while not ready_file.exists() and time.monotonic() < deadline:
        time.sleep(0.01)
    assert ready_file.exists()

    process.send_signal(signal.SIGINT)
    stdout, stderr = process.communicate(timeout=5)

    assert process.returncode == 128 + signal.SIGINT
    assert stdout == ""
    assert "test: INTERRUPTED by SIGINT" in stderr
    assert _artifact_from(stderr).exists()


def test_success_prunes_logs_older_than_retention(tmp_path: Path) -> None:
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    old_log = log_dir / "old.log"
    old_log.write_text("old")
    old_timestamp = time.time() - 8 * 24 * 60 * 60
    os.utime(old_log, (old_timestamp, old_timestamp))

    result = _run_quiet(tmp_path, "test", "pass")

    assert result.returncode == 0
    assert not old_log.exists()


def test_package_scripts_share_canonical_gate_graphs() -> None:
    scripts = json.loads((REPO_ROOT / "package.json").read_text())["scripts"]

    assert scripts["check"].endswith("-- pnpm run check:_run")
    assert scripts["check:human"] == "pnpm run check:_run"
    assert scripts["test"].startswith(
        "python3 scripts/quiet-run.py --label test -- pnpm run test:_run"
    )
    assert scripts["test:human"].startswith("pnpm run test:_run")
    assert scripts["preflight:unlocked"].endswith("-- pnpm run preflight:_run")
    assert scripts["preflight:unlocked:human"] == "pnpm run preflight:_run"

    locked = (REPO_ROOT / "scripts/workflow/preflight-locked.sh").read_text()
    assert "pnpm run preflight:_run" in locked
    assert "scripts/quiet-run.py --label preflight" in locked


def test_locked_preflight_only_changes_presentation_mode(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_sem = fake_bin / "sem"
    fake_sem.write_text(
        """#!/usr/bin/env bash
if [[ ${1:-} == --version ]]; then
  echo 'GNU parallel fake'
  exit 0
fi
printf '%s\\n' "$@"
"""
    )
    fake_sem.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    script = REPO_ROOT / "scripts" / "workflow" / "preflight-locked.sh"

    compact = subprocess.run(
        ["bash", str(script)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    human = subprocess.run(
        ["bash", str(script), "--human"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert compact.returncode == 0
    assert human.returncode == 0
    assert "pnpm run preflight:_run" in compact.stdout
    assert "scripts/quiet-run.py" in compact.stdout
    assert "pnpm run preflight:_run" in human.stdout
    assert "scripts/quiet-run.py" not in human.stdout
