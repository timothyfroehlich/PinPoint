"""Tests for bounded validation output and phase progress (PP-sec4, PP-3vdr.19)."""

import json
import os
import signal
import stat
import subprocess
import sys
import time
from pathlib import Path

QUIET_RUN = Path(__file__).parent.parent / "quiet-run.py"
VALIDATION_PHASE = Path(__file__).parent.parent / "validation-phase.py"
REPO_ROOT = Path(__file__).parents[2]


def _run_quiet(
    tmp_path: Path, label: str, code: str
) -> subprocess.CompletedProcess[str]:
    return _run_quiet_command(
        tmp_path,
        label,
        [sys.executable, "-c", code],
    )


def _run_quiet_command(
    tmp_path: Path,
    label: str,
    command: list[str],
    *,
    quiet_args: list[str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    return subprocess.run(
        [
            sys.executable,
            str(QUIET_RUN),
            "--label",
            label,
            *(quiet_args or []),
            "--",
            *command,
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


def test_phase_progress_is_bounded_and_excludes_child_output(tmp_path: Path) -> None:
    result = _run_quiet_command(
        tmp_path,
        "preflight",
        [
            sys.executable,
            str(VALIDATION_PHASE),
            "--phase",
            "static-checks",
            "--",
            sys.executable,
            "-c",
            (
                "import time; "
                "print('SERVICE_API_TOKEN=synthetic-progress-secret'); "
                "time.sleep(0.18); "
                "print('17 passed')"
            ),
        ],
        quiet_args=[
            "--phase",
            "static-checks",
            "--heartbeat-seconds",
            "0.05",
        ],
    )

    assert result.returncode == 0
    assert result.stdout.count("\n") == 1
    assert result.stdout.startswith("preflight: PASS (")
    assert "17 passed" in result.stdout
    assert "synthetic-progress-secret" not in result.stderr

    progress = result.stderr.splitlines()
    assert progress[0] == "preflight: PHASE static-checks START"
    assert progress[-1].startswith("preflight: PHASE static-checks COMPLETE (")
    heartbeats = [line for line in progress if " HEARTBEAT " in line]
    assert heartbeats
    assert all(
        line.startswith("preflight: HEARTBEAT static-checks (")
        and line.endswith("s elapsed)")
        for line in heartbeats
    )
    assert len(progress) <= 6
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_phase_wrapper_streams_normally_without_quiet_progress(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(VALIDATION_PHASE),
            "--phase",
            "build",
            "--",
            sys.executable,
            "-c",
            "print('human output')",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert result.stdout == "human output\n"
    assert result.stderr == ""


def test_phase_failure_preserves_exit_and_terminal_verdict(tmp_path: Path) -> None:
    result = _run_quiet_command(
        tmp_path,
        "preflight",
        [
            sys.executable,
            str(VALIDATION_PHASE),
            "--phase",
            "build",
            "--",
            sys.executable,
            "-c",
            "print('build root cause'); raise SystemExit(7)",
        ],
        quiet_args=["--phase", "build"],
    )

    assert result.returncode == 7
    assert result.stdout == ""
    assert "preflight: PHASE build START" in result.stderr
    assert "preflight: PHASE build COMPLETE" in result.stderr
    assert "preflight: FAIL exit 7" in result.stderr
    assert "build root cause" in result.stderr
    assert stat.S_IMODE(_artifact_from(result.stderr).stat().st_mode) == 0o600


def test_phase_child_signal_preserves_interrupted_verdict(tmp_path: Path) -> None:
    result = _run_quiet_command(
        tmp_path,
        "preflight",
        [
            sys.executable,
            str(VALIDATION_PHASE),
            "--phase",
            "build",
            "--",
            sys.executable,
            "-c",
            "import os, signal; os.kill(os.getpid(), signal.SIGTERM)",
        ],
        quiet_args=["--phase", "build"],
    )

    assert result.returncode == 128 + signal.SIGTERM
    assert result.stdout == ""
    assert "preflight: PHASE build START" in result.stderr
    assert "preflight: INTERRUPTED by SIGTERM" in result.stderr


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
            "--phase",
            "unit-tests",
            "--heartbeat-seconds",
            "0.05",
            "--",
            sys.executable,
            str(VALIDATION_PHASE),
            "--phase",
            "unit-tests",
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
    assert "test: PHASE unit-tests START" in stderr
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
    assert scripts["test:changed"].endswith(
        "-- pnpm run test:changed:_run -- --silent --no-color --reporter=dot"
    )
    assert scripts["test:changed:human"] == (
        "pnpm run test:changed:_run -- --reporter=verbose"
    )
    assert scripts["e2e:all"].endswith("-- pnpm run e2e:all:_run")
    assert scripts["preflight:unlocked"].endswith(
        "--phase-set preflight -- pnpm run preflight:_run"
    )
    assert scripts["preflight:unlocked:human"] == "pnpm run preflight:_run"

    phase_commands = {
        "preflight:readiness": "database-readiness",
        "preflight:static": "static-checks",
        "preflight:unit": "unit-tests",
        "preflight:database-reset": "database-reset",
        "preflight:build": "build",
        "preflight:integration": "integration",
        "preflight:supabase-integration": "supabase-integration",
        "preflight:smoke": "smoke",
    }
    for command, phase in phase_commands.items():
        assert scripts[command].startswith(
            f"python3 scripts/validation-phase.py --phase {phase} -- "
        )

    preflight_graph = scripts["preflight:_run"]
    for command in phase_commands:
        assert preflight_graph.count(command) == 1

    locked = (REPO_ROOT / "scripts/workflow/preflight-locked.sh").read_text()
    assert "pnpm run preflight:_run" in locked
    assert "scripts/quiet-run.py --label preflight --phase-set preflight" in locked


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
    fake_pg_isready = fake_bin / "pg_isready"
    fake_pg_isready.write_text("#!/bin/bash\nexit 0\n")
    fake_pg_isready.chmod(0o755)
    fake_curl = fake_bin / "curl"
    fake_curl.write_text("#!/bin/bash\nexit 0\n")
    fake_curl.chmod(0o755)
    fake_psql = fake_bin / "psql"
    fake_psql.write_text(
        "#!/bin/bash\n"
        "[[ \"$*\" == *\"WITH expected\"* ]] && printf 'ready\\n' || printf 't\\n'\n"
    )
    fake_psql.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["POSTGRES_URL"] = "postgresql://postgres:postgres@localhost:61234/postgres"
    env["POSTGRES_URL_NON_POOLING"] = env["POSTGRES_URL"]
    env["NEXT_PUBLIC_SUPABASE_URL"] = "http://localhost:61233"
    env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
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
    assert "--phase-set preflight" in compact.stdout
    assert "pnpm run preflight:_run" in human.stdout
    assert "scripts/quiet-run.py" not in human.stdout
