"""Regression coverage for host-wide heavy-run admission (PP-3vdr.20)."""

import json
import os
import signal
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
HEAVY_RUN = REPO_ROOT / "scripts" / "workflow" / "heavy-run.sh"
PREFLIGHT_LOCKED = REPO_ROOT / "scripts" / "workflow" / "preflight-locked.sh"

FAKE_SEM = r"""#!/usr/bin/env bash
set -u

if [[ ${1:-} == --version ]]; then
  echo 'GNU parallel fake'
  exit 0
fi

jobs=''
semaphore_id=''
command_string=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --jobs)
      jobs=$2
      shift 2
      ;;
    --id)
      semaphore_id=$2
      shift 2
      ;;
    --fg)
      shift
      ;;
    *)
      command_string=$1
      shift
      ;;
  esac
done

state_dir=${PARALLEL_HOME:?}/semaphores/$semaphore_id
mkdir -p "$state_dir"
slot=''
while [[ -z $slot ]]; do
  for ((candidate = 1; candidate <= jobs; candidate++)); do
    candidate_path=$state_dir/slot-$candidate
    if mkdir "$candidate_path" 2>/dev/null; then
      slot=$candidate_path
      break
    fi
  done
  if [[ -z $slot ]]; then
    sleep 0.01
  fi
done

child_pid=''
cleanup() {
  if [[ -n $child_pid ]] && kill -0 "$child_pid" 2>/dev/null; then
    kill -TERM "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  rmdir "$slot" 2>/dev/null || true
}
interrupt() {
  cleanup
  exit 130
}
trap interrupt INT TERM

bash -c "exec $command_string" &
child_pid=$!
wait "$child_pid"
status=$?
child_pid=''
cleanup
exit "$status"
"""


def _fake_environment(tmp_path: Path) -> tuple[dict[str, str], Path]:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_sem = fake_bin / "sem"
    fake_sem.write_text(FAKE_SEM)
    fake_sem.chmod(0o755)

    xdg_state_home = tmp_path / "xdg-state"
    state_dir = xdg_state_home / "pinpoint" / "parallel" / "semaphores"
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env['PATH']}"
    env["XDG_STATE_HOME"] = str(xdg_state_home)
    env.pop("PARALLEL_HOME", None)
    env.pop("PINPOINT_PARALLEL_HOME", None)
    env.pop("CI", None)
    return env, state_dir


def _start_heavy(cwd: Path, env: dict[str, str], code: str) -> subprocess.Popen[str]:
    return subprocess.Popen(
        ["bash", str(HEAVY_RUN), sys.executable, "-c", code],
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def _wait_until(predicate: Callable[[], bool], timeout: float = 5) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    pytest.fail("timed out waiting for subprocess state")


def _slot_paths(state_dir: Path, semaphore_id: str) -> list[Path]:
    return list((state_dir / semaphore_id).glob("slot-*"))


def test_complete_unit_and_check_graphs_join_admission_pool() -> None:
    scripts = json.loads((REPO_ROOT / "package.json").read_text())["scripts"]

    assert "heavy-run.sh vitest run --project unit" in scripts["test:_run"]
    assert "heavy-run.sh npm-run-all" in scripts["check:_run"]
    assert scripts["test"].startswith("python3 scripts/quiet-run.py")
    assert scripts["test:human"].startswith("pnpm run test:_run")
    assert scripts["check"].startswith("python3 scripts/quiet-run.py")
    assert scripts["check:human"] == "pnpm run check:_run"
    assert "heavy-run.sh" not in scripts["test:changed:_run"]
    assert "heavy-run.sh" not in scripts["test:watch"]


def test_concurrent_worktrees_honor_capacity_and_release_success_slots(
    tmp_path: Path,
) -> None:
    env, state_dir = _fake_environment(tmp_path)
    worktrees = [tmp_path / f"worktree-{number}" for number in range(3)]
    starts = [tmp_path / f"started-{number}" for number in range(3)]
    releases = [tmp_path / f"release-{number}" for number in range(3)]
    for worktree in worktrees:
        worktree.mkdir()

    processes = [
        _start_heavy(
            worktree,
            env,
            (
                "from pathlib import Path; import time; "
                f"Path({str(start)!r}).touch(); "
                f"release = Path({str(release)!r}); "
                "\nwhile not release.exists(): time.sleep(0.01)"
            ),
        )
        for worktree, start, release in zip(worktrees, starts, releases, strict=True)
    ]

    try:
        _wait_until(lambda: sum(path.exists() for path in starts) == 2)
        time.sleep(0.1)
        assert sum(path.exists() for path in starts) == 2
        assert len(_slot_paths(state_dir, "pinpoint-heavy")) == 2

        first_started = next(
            index for index, path in enumerate(starts) if path.exists()
        )
        releases[first_started].touch()
        _wait_until(lambda: all(path.exists() for path in starts))
        for release in releases:
            release.touch()

        for process in processes:
            stdout, stderr = process.communicate(timeout=5)
            assert process.returncode == 0, (stdout, stderr)
        assert _slot_paths(state_dir, "pinpoint-heavy") == []
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)


def test_failure_releases_slot_and_preserves_exit_status(tmp_path: Path) -> None:
    env, state_dir = _fake_environment(tmp_path)
    worktree = tmp_path / "worktree"
    worktree.mkdir()

    failed = subprocess.run(
        ["bash", str(HEAVY_RUN), sys.executable, "-c", "raise SystemExit(7)"],
        cwd=worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    succeeded = subprocess.run(
        ["bash", str(HEAVY_RUN), sys.executable, "-c", "pass"],
        cwd=worktree,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert failed.returncode == 7
    assert succeeded.returncode == 0
    assert _slot_paths(state_dir, "pinpoint-heavy") == []


def test_interrupt_releases_slot_for_following_run(tmp_path: Path) -> None:
    env, state_dir = _fake_environment(tmp_path)
    worktree = tmp_path / "worktree"
    worktree.mkdir()
    started = tmp_path / "started"
    process = _start_heavy(
        worktree,
        env,
        (
            "from pathlib import Path; import time; "
            f"Path({str(started)!r}).touch(); "
            "\nwhile True: time.sleep(0.1)"
        ),
    )

    try:
        _wait_until(started.exists)
        process.send_signal(signal.SIGINT)
        process.communicate(timeout=5)
        assert process.returncode == 130
        assert _slot_paths(state_dir, "pinpoint-heavy") == []

        following = subprocess.run(
            ["bash", str(HEAVY_RUN), sys.executable, "-c", "pass"],
            cwd=worktree,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        assert following.returncode == 0
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)


def test_two_preflights_can_enter_distinct_inner_heavy_pool(tmp_path: Path) -> None:
    env, state_dir = _fake_environment(tmp_path)
    # PP-3vdr.17 owns making the outer preflight semaphore state writable.
    # Supply that resolved base here so this regression stays focused on the
    # distinct-id nesting contract owned by heavy-run.
    env["PARALLEL_HOME"] = str(state_dir.parent)
    fake_pnpm = tmp_path / "bin" / "pnpm"
    fake_pnpm.write_text(
        """#!/usr/bin/env bash
if [[ $* == 'run preflight:_run' ]]; then
  exec bash "$PINPOINT_REPO_ROOT/scripts/workflow/heavy-run.sh" \
    "$PINPOINT_TEST_PYTHON" -c 'import time; time.sleep(0.1)'
fi
exit 64
"""
    )
    fake_pnpm.chmod(0o755)
    env["PINPOINT_REPO_ROOT"] = str(REPO_ROOT)
    env["PINPOINT_TEST_PYTHON"] = sys.executable
    worktrees = [tmp_path / f"preflight-worktree-{number}" for number in range(2)]
    for worktree in worktrees:
        worktree.mkdir()

    processes = [
        subprocess.Popen(
            ["bash", str(PREFLIGHT_LOCKED), "--human"],
            cwd=worktree,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        for worktree in worktrees
    ]

    try:
        for process in processes:
            stdout, stderr = process.communicate(timeout=5)
            assert process.returncode == 0, (stdout, stderr)
        assert (state_dir / "pinpoint-preflight").is_dir()
        assert (state_dir / "pinpoint-heavy").is_dir()
        assert _slot_paths(state_dir, "pinpoint-preflight") == []
        assert _slot_paths(state_dir, "pinpoint-heavy") == []
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
