"""Behavior coverage for heavy-run.sh's host-wide sem slots and agent-load.sh.

Wrapper logic (class selection, passthrough, timeout detection, the held flag)
runs against a fake `sem` that re-parses its command string through bash the
way GNU sem does. Admission itself (wait, timeout, dead-holder reclaim) runs
against the real GNU sem, skipped where it is not installed (CI's runners).
Every test uses a private XDG_STATE_HOME, so its semaphores are its own.
(PP-yso5, PP-p2ts.5)
"""

import os
import shutil
import signal
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
HEAVY_RUN = REPO_ROOT / "scripts" / "workflow" / "heavy-run.sh"
AGENT_LOAD = REPO_ROOT / "scripts" / "workflow" / "agent-load.sh"
PRINT_ARGV = (
    "import json, os, sys; "
    "print(json.dumps([os.environ.get('PINPOINT_HOST_SLOT_HELD')] + sys.argv[1:])); "
    "sys.exit(7)"
)
TRICKY_ARGS = ["--project=Mobile Chrome", "it's", "$HOME"]
EXPECTED_STDOUT = '["heavy", "--project=Mobile Chrome", "it\'s", "$HOME"]\n'
EX_TEMPFAIL = 75


def _gnu_sem() -> str | None:
    sem = shutil.which("sem")
    if sem is None:
        return None
    version = subprocess.run(
        [sem, "--version"], capture_output=True, text=True, check=False
    )
    return sem if version.stdout.startswith("GNU parallel") else None


requires_gnu_sem = pytest.mark.skipif(
    _gnu_sem() is None, reason="GNU parallel sem not installed"
)


@pytest.fixture
def env(tmp_path: Path) -> dict[str, str]:
    env = os.environ.copy()
    for name in (
        "CI",
        "PINPOINT_HOST_SLOT_HELD",
        "PINPOINT_HEAVY_SLOTS",
        "PINPOINT_DEV_SLOTS",
    ):
        env.pop(name, None)
    env.update(PINPOINT_HOST_SLOTS="on", XDG_STATE_HOME=str(tmp_path / "state"))
    return env


def _fake_sem(tmp_path: Path, env: dict[str, str], body: str) -> Path:
    """Put a fake GNU sem first on PATH; it logs its argv to sem.log."""
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    log = tmp_path / "sem.log"
    sem = fake_bin / "sem"
    sem.write_text(
        "#!/bin/bash\n"
        '[[ $1 == --version ]] && { echo "GNU parallel fake"; exit 0; }\n'
        f'printf "%s\\n" "$@" > {log}\n' + body
    )
    sem.chmod(0o755)
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    return log


SEM_RUNS_COMMAND = 'exec bash -c "${@: -1}"\n'
SEM_TIMES_OUT = 'echo "parallel: Warning: Semaphore timed out. Exiting." >&2; exit 1\n'


def _run(
    env: dict[str, str], *args: str, timeout: float = 30
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["/bin/bash", str(HEAVY_RUN), *args],
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )


# ── wrapper logic (fake sem) ─────────────────────────────────────────────────


def test_arguments_exit_code_and_held_flag_survive_sem_shell_reparse(
    tmp_path, env
) -> None:
    log = _fake_sem(tmp_path, env, SEM_RUNS_COMMAND)

    result = _run(env, "heavy", sys.executable, "-c", PRINT_ARGV, *TRICKY_ARGS)

    assert result.returncode == 7, result.stderr
    assert result.stdout == EXPECTED_STDOUT
    sem_args = log.read_text().splitlines()
    assert sem_args[:6] == [
        "--id",
        "pinpoint-heavy",
        "--jobs",
        "1",
        "--semaphore-timeout",
        "-300",
    ]
    assert (tmp_path / "state" / "pinpoint" / "parallel").is_dir()


@pytest.mark.parametrize(
    ("extra_env", "jobs"),
    [({}, "2"), ({"PINPOINT_DEV_SLOTS": "3"}, "3")],
    ids=["default", "override"],
)
def test_dev_class_uses_its_own_semaphore(tmp_path, env, extra_env, jobs) -> None:
    log = _fake_sem(tmp_path, env, SEM_RUNS_COMMAND)

    result = _run({**env, **extra_env}, "dev", "true")

    assert result.returncode == 0, result.stderr
    assert log.read_text().splitlines()[:4] == ["--id", "pinpoint-dev", "--jobs", jobs]


def test_timeout_without_running_exits_75_with_offload_guidance(tmp_path, env) -> None:
    _fake_sem(tmp_path, env, SEM_TIMES_OUT)

    result = _run(env, "heavy", "true")

    assert result.returncode == EX_TEMPFAIL
    assert "nothing was run" in result.stderr
    assert "Do not retry in a loop" in result.stderr
    assert "crabbox-slot job run" in result.stderr
    assert "pnpm run agent-load" in result.stderr


def test_dev_timeout_points_at_dev_stop(tmp_path, env) -> None:
    _fake_sem(tmp_path, env, SEM_TIMES_OUT)

    result = _run(env, "dev", "true")

    assert result.returncode == EX_TEMPFAIL
    assert "pnpm run dev:stop" in result.stderr


def test_a_command_that_ran_and_failed_keeps_its_own_exit_code(tmp_path, env) -> None:
    _fake_sem(tmp_path, env, SEM_RUNS_COMMAND)

    result = _run(env, "heavy", sys.executable, "-c", "import sys; sys.exit(1)")

    assert result.returncode == 1
    assert "nothing was run" not in result.stderr


@pytest.mark.parametrize(
    "bypass",
    [{"CI": "1"}, {"PINPOINT_HOST_SLOTS": "off"}, {"PINPOINT_HOST_SLOT_HELD": "heavy"}],
    ids=["ci", "opt-out", "nested-inside-a-held-slot"],
)
def test_passthrough_never_calls_sem(tmp_path, env, bypass) -> None:
    log = _fake_sem(tmp_path, env, SEM_TIMES_OUT)

    result = _run(
        {**env, **bypass}, "heavy", sys.executable, "-c", PRINT_ARGV, *TRICKY_ARGS
    )

    assert result.returncode == 7, result.stderr
    assert result.stdout.endswith('"--project=Mobile Chrome", "it\'s", "$HOME"]\n')
    assert not log.exists()


def test_runs_command_directly_when_sem_is_absent(tmp_path, env) -> None:
    empty_bin = tmp_path / "bin"
    empty_bin.mkdir()

    result = _run(
        {**env, "PATH": f"{empty_bin}{os.pathsep}/usr/bin:/bin"},
        "heavy",
        sys.executable,
        "-c",
        PRINT_ARGV,
        *TRICKY_ARGS,
    )

    assert result.returncode == 7, result.stderr
    assert result.stdout == EXPECTED_STDOUT


@pytest.mark.parametrize(
    "args", [["true"], ["bogus", "true"]], ids=["no-class", "unknown-class"]
)
def test_a_known_class_is_required(env, args) -> None:
    result = _run(env, *args)

    assert result.returncode == 64
    assert "Usage" in result.stderr


# ── admission (real GNU sem) ─────────────────────────────────────────────────

HOLD = """
import pathlib, sys, time
pathlib.Path(sys.argv[1]).touch()
while not pathlib.Path(sys.argv[2]).exists():
    time.sleep(0.05)
"""


@pytest.fixture
def hold(tmp_path: Path, env: dict[str, str]) -> Iterator[Callable[..., tuple]]:
    script = tmp_path / "hold.py"
    script.write_text(HOLD)
    procs: list[tuple[subprocess.Popen[str], Path]] = []

    def _hold(name: str, **extra_env: str) -> tuple[subprocess.Popen[str], Path, Path]:
        started, release = tmp_path / f"{name}.started", tmp_path / f"{name}.release"
        proc = subprocess.Popen(
            [
                "/bin/bash",
                str(HEAVY_RUN),
                "heavy",
                sys.executable,
                str(script),
                str(started),
                str(release),
            ],
            env={**env, **extra_env},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        procs.append((proc, release))
        return proc, started, release

    yield _hold
    for proc, release in procs:
        release.touch()
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
        proc.wait(timeout=30)
        assert proc.stderr is not None
        proc.stderr.close()


def _wait_for(predicate: Callable[[], bool], timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise AssertionError("condition not met in time")
        time.sleep(0.05)


@requires_gnu_sem
def test_second_command_waits_then_runs_when_the_first_exits(hold) -> None:
    first, first_started, first_release = hold("first")
    _wait_for(first_started.exists)
    second, second_started, _ = hold("second")

    time.sleep(1.5)
    assert not second_started.exists()

    first_release.touch()
    assert first.wait(timeout=30) == 0
    _wait_for(second_started.exists)


@requires_gnu_sem
def test_real_sem_timeout_exits_75(hold, env) -> None:
    _, started, _ = hold("holder")
    _wait_for(started.exists)

    result = _run({**env, "PINPOINT_HOST_SLOT_TIMEOUT_S": "2"}, "heavy", "true")

    assert result.returncode == EX_TEMPFAIL, result.stderr
    assert "nothing was run" in result.stderr


@requires_gnu_sem
def test_killed_holders_slot_is_reclaimed(hold, env) -> None:
    holder, started, _ = hold("holder")
    _wait_for(started.exists)
    os.killpg(holder.pid, signal.SIGKILL)
    holder.wait(timeout=30)

    result = _run({**env, "PINPOINT_HOST_SLOT_TIMEOUT_S": "20"}, "heavy", "true")

    assert result.returncode == 0, result.stderr


@requires_gnu_sem
def test_agent_load_lists_the_holder_and_free_slots(hold, env) -> None:
    holder, started, _ = hold("holder")
    _wait_for(started.exists)

    out = subprocess.run(
        ["/bin/bash", str(AGENT_LOAD)],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    ).stdout

    assert "heavy: 1 of 1 slot(s) in use" in out
    assert "dev: 0 of 2 slot(s) in use" in out
    assert "pid " in out and "python" in out


def test_agent_load_reports_off_in_ci(env) -> None:
    out = subprocess.run(
        ["/bin/bash", str(AGENT_LOAD)],
        env={**env, "CI": "1"},
        capture_output=True,
        text=True,
        check=True,
    ).stdout

    assert "off on this host" in out
