"""Behavior coverage for agent-budget.py, the host-wide memory reservation ledger.

Every test runs the real script against a private XDG_STATE_HOME, with the
budget forced on (the tests also run on Linux CI, where it defaults to off) and
a short poll interval. Holders are real processes that stay admitted until the
test creates their release file. (PP-p2ts.5)
"""

import importlib.util
import json
import os
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
SCRIPT = REPO_ROOT / "scripts" / "workflow" / "agent-budget.py"
HOLD = """
import os, pathlib, sys, time
pathlib.Path(sys.argv[1]).write_text(str(os.getpid()))
release = pathlib.Path(sys.argv[2])
while not release.exists():
    time.sleep(0.02)
"""
EX_TEMPFAIL = 75


def _load_module():
    spec = importlib.util.spec_from_file_location("agent_budget", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["agent_budget"] = module
    spec.loader.exec_module(module)
    return module


agent_budget = _load_module()


class Holder:
    def __init__(self, proc: subprocess.Popen[str], admitted: Path, release: Path):
        self.proc = proc
        self.admitted = admitted
        self.release = release

    def is_admitted(self) -> bool:
        return self.admitted.exists()

    def finish(self) -> int:
        self.release.touch()
        return self.proc.wait(timeout=15)


@pytest.fixture
def env(tmp_path: Path) -> dict[str, str]:
    env = os.environ.copy()
    for name in ("CI", agent_budget.HELD_ENV, "PINPOINT_AGENT_BUDGET_TIMEOUT_S"):
        env.pop(name, None)
    env.update(
        PINPOINT_AGENT_BUDGET="on",
        PINPOINT_AGENT_BUDGET_MB="6000",
        PINPOINT_AGENT_BUDGET_POLL_S="0.05",
        XDG_STATE_HOME=str(tmp_path / "state"),
    )
    return env


@pytest.fixture
def start(tmp_path: Path, env: dict[str, str]) -> Iterator[Callable[..., Holder]]:
    hold_script = tmp_path / "hold.py"
    hold_script.write_text(HOLD)
    started: list[Holder] = []

    def _start(kind: str, name: str, **extra_env: str) -> Holder:
        admitted, release = tmp_path / f"{name}.admitted", tmp_path / f"{name}.release"
        proc = subprocess.Popen(
            [sys.executable, str(SCRIPT), "run", kind, "--"]
            + [sys.executable, str(hold_script), str(admitted), str(release)],
            env={**env, **extra_env},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        holder = Holder(proc, admitted, release)
        started.append(holder)
        return holder

    yield _start
    for holder in started:
        holder.release.touch()
        if holder.proc.poll() is None:
            holder.proc.kill()
        holder.proc.wait(timeout=15)
        assert holder.proc.stdout is not None and holder.proc.stderr is not None
        holder.proc.stdout.close()
        holder.proc.stderr.close()


def _wait_for(predicate: Callable[[], bool], timeout: float = 10) -> None:
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise AssertionError("condition not met in time")
        time.sleep(0.02)


def _ledger(env: dict[str, str]) -> dict:
    path = Path(env["XDG_STATE_HOME"]) / "pinpoint" / "agent-budget" / "ledger.json"
    return (
        json.loads(path.read_text()) if path.exists() else {"holders": [], "queue": []}
    )


def _write_ledger(env: dict[str, str], holders: list[dict]) -> None:
    directory = Path(env["XDG_STATE_HOME"]) / "pinpoint" / "agent-budget"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "ledger.json").write_text(
        json.dumps({"holders": holders, "queue": []})
    )


def _run(
    env: dict[str, str], *args: str, timeout: float = 15
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )


def _live_entry_for_this_process(size_mb: int) -> dict:
    pid = os.getpid()
    starts = agent_budget.start_times([pid])
    assert starts is not None and pid in starts
    return {
        "id": "live",
        "kind": "unit",
        "size_mb": size_mb,
        "pid": pid,
        "start": starts[pid],
        "worktree": "~/elsewhere",
        "since": time.time(),
    }


def test_admits_and_execs_the_command_in_place(start, env) -> None:
    holder = start("check", "first")
    _wait_for(holder.is_admitted)

    # The command kept the wrapper's PID, so the reservation lives exactly as
    # long as the command does.
    assert int(holder.admitted.read_text()) == holder.proc.pid
    [entry] = _ledger(env)["holders"]
    assert (entry["kind"], entry["size_mb"], entry["pid"]) == (
        "check",
        5120,
        holder.proc.pid,
    )

    assert holder.finish() == 0
    assert "0 of 6000 MB reserved" in _run(env, "status").stdout


def test_exit_code_and_arguments_pass_through(env) -> None:
    result = _run(
        env,
        "run",
        "check",
        "--",
        sys.executable,
        "-c",
        "import json, sys; print(json.dumps(sys.argv[1:])); sys.exit(7)",
        "--project=Mobile Chrome",
        "--silent",
    )

    assert result.returncode == 7, result.stderr
    assert json.loads(result.stdout) == ["--project=Mobile Chrome", "--silent"]


def test_second_request_waits_then_admits_when_the_first_exits(start, env) -> None:
    first = start("check", "first")
    _wait_for(first.is_admitted)
    second = start("check", "second")
    _wait_for(lambda: len(_ledger(env)["queue"]) == 1)

    time.sleep(0.3)
    assert not second.is_admitted()
    assert second.proc.poll() is None

    assert first.finish() == 0
    _wait_for(second.is_admitted)
    assert second.finish() == 0


def test_queue_is_fifo_so_a_small_request_cannot_overtake_a_large_one(
    start, env
) -> None:
    holder = start("unit", "holder")  # 3277 of 6000
    _wait_for(holder.is_admitted)
    large = start("check", "large")  # 5120: does not fit beside unit
    _wait_for(lambda: len(_ledger(env)["queue"]) == 1)
    small = start("screenshots", "small")  # 1024: would fit, but is behind
    _wait_for(lambda: len(_ledger(env)["queue"]) == 2)

    time.sleep(0.3)
    assert not small.is_admitted()

    holder.finish()
    _wait_for(large.is_admitted)
    time.sleep(0.3)
    assert not small.is_admitted()  # 5120 + 1024 > 6000

    large.finish()
    _wait_for(small.is_admitted)


def test_timeout_exits_nonzero_with_offload_guidance(start, env) -> None:
    holder = start("check", "holder")
    _wait_for(holder.is_admitted)

    result = _run(
        {**env, "PINPOINT_AGENT_BUDGET_TIMEOUT_S": "0.3"}, "run", "check", "--", "true"
    )

    assert result.returncode == EX_TEMPFAIL
    assert "gave up after" in result.stderr
    assert "Do not retry in a loop" in result.stderr
    assert "crabbox-slot job run check" in result.stderr
    assert f"pid {holder.proc.pid}" in result.stderr
    assert _ledger(env)["queue"] == []


def test_killed_holders_reservation_is_reclaimed(start, env) -> None:
    holder = start("check", "holder")
    _wait_for(holder.is_admitted)
    holder.proc.kill()
    holder.proc.wait(timeout=15)

    result = _run(
        {**env, "PINPOINT_AGENT_BUDGET_TIMEOUT_S": "5"}, "run", "check", "--", "true"
    )

    assert result.returncode == 0, result.stderr


def test_entry_whose_pid_was_reused_is_reclaimed(env) -> None:
    # After a reboot a recorded PID can belong to an unrelated live process;
    # the start time recorded at admission no longer matches it.
    stale = {**_live_entry_for_this_process(6000), "start": "Thu Jan  1 00:00:00 1970"}
    _write_ledger(env, [stale])

    result = _run(
        {**env, "PINPOINT_AGENT_BUDGET_TIMEOUT_S": "5"}, "run", "check", "--", "true"
    )

    assert result.returncode == 0, result.stderr


def test_live_holder_with_matching_start_time_is_counted(env) -> None:
    _write_ledger(env, [_live_entry_for_this_process(6000)])

    result = _run(
        {**env, "PINPOINT_AGENT_BUDGET_TIMEOUT_S": "0.3"}, "run", "check", "--", "true"
    )

    assert result.returncode == EX_TEMPFAIL


@pytest.mark.parametrize(
    "bypass",
    [{"CI": "1"}, {"PINPOINT_AGENT_BUDGET": "off"}, {agent_budget.HELD_ENV: "outer"}],
    ids=["ci", "opt-out", "nested-inside-a-reservation"],
)
def test_passthrough_runs_immediately_and_records_nothing(env, bypass) -> None:
    full = _live_entry_for_this_process(6000)
    _write_ledger(env, [full])

    result = _run(
        {**env, **bypass, "PINPOINT_AGENT_BUDGET_TIMEOUT_S": "0.3"},
        "run",
        "check",
        "--",
        "true",
    )

    assert result.returncode == 0, result.stderr
    assert _ledger(env)["holders"] == [full]


def test_budget_is_off_by_default_outside_macos(monkeypatch) -> None:
    for name in ("CI", "PINPOINT_AGENT_BUDGET", agent_budget.HELD_ENV):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(agent_budget.sys, "platform", "linux")
    assert agent_budget.passthrough_reason() is not None

    monkeypatch.setenv("PINPOINT_AGENT_BUDGET", "on")
    assert agent_budget.passthrough_reason() is None


def test_acquire_reserves_for_another_pid_until_it_exits(env) -> None:
    sleeper = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    try:
        result = _run(env, "acquire", "screenshots", "--pid", str(sleeper.pid))
        assert result.returncode == 0, result.stderr
        assert "1024 of 6000 MB reserved" in _run(env, "status").stdout
    finally:
        sleeper.kill()
        sleeper.wait(timeout=15)

    assert "0 of 6000 MB reserved" in _run(env, "status").stdout


def test_status_lists_holders_and_remaining_budget(start, env) -> None:
    holder = start("check", "holder")
    _wait_for(holder.is_admitted)

    out = _run(env, "status").stdout

    assert "5120 of 6000 MB reserved, 880 MB free" in out
    assert "holders (1):" in out
    assert f"pid {holder.proc.pid}" in out
    assert "check" in out


def test_budget_file_sets_the_host_wide_budget(env) -> None:
    env.pop("PINPOINT_AGENT_BUDGET_MB")
    directory = Path(env["XDG_STATE_HOME"]) / "pinpoint" / "agent-budget"
    directory.mkdir(parents=True)
    (directory / "budget-mb").write_text("5000\n")

    assert "0 of 5000 MB reserved" in _run(env, "status").stdout
