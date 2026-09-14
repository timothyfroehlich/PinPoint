"""Tests for preflight-runner phase transitions, heartbeats, and secret redaction."""

import json
import os
import signal
import stat
import subprocess
import sys
import time
from pathlib import Path

PREFLIGHT_RUNNER = Path(__file__).parent.parent / "workflow" / "preflight-runner.py"
REPO_ROOT = Path(__file__).parents[2]


def _run_preflight_runner(
    tmp_path: Path,
    phases: list[dict],
    runner_args: list[str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    env["PINPOINT_PREFLIGHT_PHASES_JSON"] = json.dumps(phases)
    return subprocess.run(
        [
            sys.executable,
            str(PREFLIGHT_RUNNER),
            *(runner_args or []),
        ],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _artifact_from(output: str) -> Path:
    artifact_line = next(line for line in output.splitlines() if "full log:" in line)
    return Path(artifact_line.split("full log:", 1)[1].strip())


def test_success_emits_phase_transitions_and_deletes_log(tmp_path: Path) -> None:
    phases = [
        {
            "name": "setup",
            "command": [sys.executable, "-c", "print('setup complete')"],
        },
        {
            "name": "check",
            "command": [sys.executable, "-c", "print('42 passed')"],
        },
    ]

    result = _run_preflight_runner(tmp_path, phases)

    assert result.returncode == 0
    assert result.stdout.count("\n") == 1
    assert result.stdout.startswith("preflight: PASS (")
    assert "42 passed" in result.stdout

    progress = result.stderr.splitlines()
    assert progress[0] == "preflight: PHASE setup START"
    assert progress[1].startswith("preflight: PHASE setup COMPLETE (")
    assert progress[2] == "preflight: PHASE check START"
    assert progress[3].startswith("preflight: PHASE check COMPLETE (")
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_heartbeat_emits_on_long_running_phase(tmp_path: Path) -> None:
    phases = [
        {
            "name": "static-checks",
            "command": [
                sys.executable,
                "-c",
                (
                    "import time; "
                    "print('SERVICE_API_TOKEN=synthetic-progress-secret'); "
                    "time.sleep(0.18); "
                    "print('17 passed')"
                ),
            ],
        }
    ]

    result = _run_preflight_runner(
        tmp_path,
        phases,
        runner_args=["--heartbeat-seconds", "0.05"],
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


def test_parallel_phases_emit_transitions_and_heartbeats(tmp_path: Path) -> None:
    phases = [
        {
            "parallel": [
                {
                    "name": "static-checks",
                    "command": [
                        sys.executable,
                        "-c",
                        "import time; time.sleep(0.15); print('static ok')",
                    ],
                },
                {
                    "name": "unit-tests",
                    "command": [
                        sys.executable,
                        "-c",
                        "import time; time.sleep(0.15); print('12 passed')",
                    ],
                },
            ]
        }
    ]

    result = _run_preflight_runner(
        tmp_path,
        phases,
        runner_args=["--heartbeat-seconds", "0.05"],
    )

    assert result.returncode == 0
    assert result.stdout.startswith("preflight: PASS (")
    assert "12 passed" in result.stdout

    progress = result.stderr.splitlines()
    assert "preflight: PHASE static-checks START" in progress
    assert "preflight: PHASE unit-tests START" in progress
    assert any(
        line.startswith("preflight: PHASE static-checks COMPLETE (")
        for line in progress
    )
    assert any(
        line.startswith("preflight: PHASE unit-tests COMPLETE (") for line in progress
    )
    assert any("HEARTBEAT static-checks" in line for line in progress)
    assert any("HEARTBEAT unit-tests" in line for line in progress)
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_failure_preserves_exit_code_and_retains_log(tmp_path: Path) -> None:
    phases = [
        {
            "name": "build",
            "command": [
                sys.executable,
                "-c",
                (
                    "print('build root cause'); "
                    "print('SERVICE_API_TOKEN=leak-secret'); "
                    "raise SystemExit(7)"
                ),
            ],
        }
    ]

    result = _run_preflight_runner(tmp_path, phases)

    assert result.returncode == 7
    assert result.stdout == ""
    assert "preflight: PHASE build START" in result.stderr
    assert "preflight: PHASE build COMPLETE" in result.stderr
    assert "preflight: FAIL exit 7" in result.stderr
    assert "build root cause" in result.stderr
    assert "SERVICE_API_TOKEN=[REDACTED]" in result.stderr
    assert "leak-secret" not in result.stderr
    artifact = _artifact_from(result.stderr)
    assert stat.S_IMODE(artifact.stat().st_mode) == 0o600
    assert "leak-secret" in artifact.read_text()


def test_interruption_forwarded_and_reported(tmp_path: Path) -> None:
    ready_file = tmp_path / "ready"
    phases = [
        {
            "name": "unit-tests",
            "command": [
                sys.executable,
                "-c",
                (
                    "from pathlib import Path; import time; "
                    f"Path({str(ready_file)!r}).write_text('ready'); time.sleep(30)"
                ),
            ],
        }
    ]

    env = os.environ.copy()
    env["PINPOINT_QUIET_LOG_DIR"] = str(tmp_path / "logs")
    env["PINPOINT_PREFLIGHT_PHASES_JSON"] = json.dumps(phases)

    process = subprocess.Popen(
        [sys.executable, str(PREFLIGHT_RUNNER)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    deadline = time.monotonic() + 15
    while not ready_file.exists() and time.monotonic() < deadline:
        time.sleep(0.01)
    assert ready_file.exists()

    process.send_signal(signal.SIGINT)
    stdout, stderr = process.communicate(timeout=15)

    assert process.returncode == 128 + signal.SIGINT
    assert stdout == ""
    assert "preflight: PHASE unit-tests START" in stderr
    assert "preflight: INTERRUPTED by SIGINT" in stderr
    assert _artifact_from(stderr).exists()


def test_child_signal_preserves_interrupted_verdict(tmp_path: Path) -> None:
    phases = [
        {
            "name": "build",
            "command": [
                sys.executable,
                "-c",
                "import os, signal; os.kill(os.getpid(), signal.SIGTERM)",
            ],
        }
    ]

    result = _run_preflight_runner(tmp_path, phases)

    assert result.returncode == 128 + signal.SIGTERM
    assert result.stdout == ""
    assert "preflight: PHASE build START" in result.stderr
    assert "preflight: INTERRUPTED by SIGTERM" in result.stderr
    assert _artifact_from(result.stderr).exists()


def test_warning_emits_pass_with_warnings_and_retains_log(tmp_path: Path) -> None:
    phases = [
        {
            "name": "lint",
            "command": [
                sys.executable,
                "-c",
                "print('warning: check warning'); print('5 passed')",
            ],
        }
    ]

    result = _run_preflight_runner(tmp_path, phases)

    assert result.returncode == 0
    assert "preflight: PASS_WITH_WARNINGS" in result.stdout
    assert "warning: check warning" in result.stdout
    assert "5 passed" in result.stdout
    artifact = _artifact_from(result.stdout)
    assert stat.S_IMODE(artifact.stat().st_mode) == 0o600


def test_human_mode_streams_directly_without_log_capture(tmp_path: Path) -> None:
    phases = [
        {
            "name": "setup",
            "command": [sys.executable, "-c", "print('human output stream')"],
        }
    ]

    result = _run_preflight_runner(tmp_path, phases, runner_args=["--human"])

    assert result.returncode == 0
    assert "human output stream" in result.stdout
    assert "preflight: PHASE setup START" in result.stderr
    assert "preflight: PHASE setup COMPLETE" in result.stderr
    assert list((tmp_path / "logs").glob("*.log")) == []


def test_default_phases_contain_canonical_order() -> None:
    import importlib.util

    spec = importlib.util.spec_from_file_location("preflight_runner", PREFLIGHT_RUNNER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    phases = module.DEFAULT_PHASES
    phase_names = []
    for item in phases:
        if "parallel" in item:
            for job in item["parallel"]:
                phase_names.append(job["name"])
        else:
            phase_names.append(item["name"])

    assert phase_names == [
        "database-readiness",
        "prototype-clean",
        "static-checks",
        "unit-tests",
        "database-reset",
        "build",
        "integration",
        "supabase-integration",
        "smoke",
    ]
