"""Regression tests for scripts/workflow/pr-watch.py cancellation handling (PP-r63o).

Two bugs are covered:

1. A `cancelled` run was classified as a failure — cancellation is routine
   (a newer commit cancels the in-flight run via concurrency groups, and the
   Preview Auto-Resync workflow cancels itself), so a normal push-twice cycle
   emitted a spurious "✗ CI — failed" plus a failure artifact whose log body
   read "(no log available)".
2. The completed-runs scan and the CI Gate pre-check must only consider the
   CURRENT head SHA, so a stale cancelled run from an older commit — or a
   superseded CI Gate check left behind at the same commit — can't hard-exit
   the watcher. `--force` was the workaround; it should no longer be needed.

Everything is mocked at the `gh` CLI seam (`pr_watch.gh`) — these tests never
reach GitHub (CORE-TEST-006).
"""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "workflow" / "pr-watch.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("pr_watch", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["pr_watch"] = module
    spec.loader.exec_module(module)
    return module


pr_watch = _load_module()

HEAD_SHA = "1c33d34bb30884376eaf066f0024551df5c58368"
OLD_SHA = "3ab14b1f0000000000000000000000000000aaaa"
BRANCH = "feat/example-branch"
PR = 1734


def _gate(conclusion: str, status: str = "COMPLETED", completed_at: str = "") -> dict:
    return {
        "name": pr_watch.CI_GATE_NAME,
        "status": status,
        "conclusion": conclusion,
        "completedAt": completed_at,
        "startedAt": completed_at,
    }


def _run(run_id: int, status: str, conclusion: str, name: str = "CI", sha=HEAD_SHA):
    return {
        "databaseId": run_id,
        "status": status,
        "conclusion": conclusion,
        "name": name,
        "headSha": sha,
    }


def make_gh(*, rollup=(), runs=(), merge_state="CLEAN", threads=(), labels=()):
    """Build a fake `gh` that answers every call pr-watch makes.

    Records each invocation on `.calls` so tests can assert what was queried.
    """

    def fake_gh(*args: str) -> str:
        fake_gh.calls.append(args)
        if args[:2] == ("pr", "view"):
            fields = args[4]
            if fields == "statusCheckRollup":
                return json.dumps({"statusCheckRollup": list(rollup)})
            if fields == "mergeStateStatus,labels":
                return json.dumps(
                    {
                        "mergeStateStatus": merge_state,
                        "labels": [{"name": n} for n in labels],
                    }
                )
            if fields == "headRefName,headRefOid":
                return json.dumps({"headRefName": BRANCH, "headRefOid": HEAD_SHA})
        if args[:2] == ("api", "graphql"):
            return json.dumps(
                {
                    "data": {
                        "repository": {
                            "pullRequest": {
                                "reviewThreads": {
                                    "pageInfo": {
                                        "hasNextPage": False,
                                        "endCursor": None,
                                    },
                                    "nodes": list(threads),
                                }
                            }
                        }
                    }
                }
            )
        if args[:2] == ("run", "list"):
            return json.dumps(list(runs))
        if args[0] == "api":  # Copilot review count
            return "0"
        raise AssertionError(f"unexpected gh call: {args}")

    fake_gh.calls = []
    return fake_gh


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("conclusion", ["cancelled", "CANCELLED", "Cancelled"])
def test_cancelled_is_neither_pass_nor_fail(conclusion):
    assert pr_watch._is_superseded(conclusion)
    assert not pr_watch._is_passing(conclusion)
    assert not pr_watch._is_failing(conclusion)


@pytest.mark.unit
@pytest.mark.parametrize("conclusion", ["success", "SUCCESS", "skipped", "neutral"])
def test_passing_conclusions(conclusion):
    assert pr_watch._is_passing(conclusion)
    assert not pr_watch._is_failing(conclusion)
    assert not pr_watch._is_superseded(conclusion)


@pytest.mark.unit
@pytest.mark.parametrize("conclusion", ["failure", "FAILURE", "timed_out", "weird"])
def test_failing_conclusions(conclusion):
    assert pr_watch._is_failing(conclusion)
    assert not pr_watch._is_passing(conclusion)


@pytest.mark.unit
@pytest.mark.parametrize("conclusion", ["", None])
def test_undecided_conclusion_is_not_a_failure(conclusion):
    """An empty conclusion means "not decided yet" — status carries that state."""
    assert not pr_watch._is_failing(conclusion)
    assert not pr_watch._is_passing(conclusion)


# ---------------------------------------------------------------------------
# watch_run — a cancelled run is reported as superseded, with no artifact
# ---------------------------------------------------------------------------


class _FakeProc:
    """Stand-in for the `gh run watch` subprocess: already exited non-zero."""

    returncode = 1

    def poll(self):
        return self.returncode

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False


@pytest.fixture
def stub_run_watch(monkeypatch):
    monkeypatch.setattr(pr_watch.subprocess, "Popen", lambda *a, **k: _FakeProc())
    monkeypatch.setattr(pr_watch, "VERBOSE_MODE", True)


@pytest.mark.unit
def test_watch_run_cancelled_records_no_failure(monkeypatch, stub_run_watch, capsys):
    monkeypatch.setattr(
        pr_watch, "_run_conclusion", lambda _id: ("completed", "cancelled")
    )
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda _id: pytest.fail("no artifact should be written for a cancelled run"),
    )

    failures: list[int] = []
    pr_watch.watch_run(
        30133783967, "Preview Auto-Resync", pr_watch.threading.Event(), failures
    )

    out = capsys.readouterr().out
    assert failures == []
    assert "superseded" in out
    assert "failed" not in out


@pytest.mark.unit
def test_watch_run_failure_still_records_failure(monkeypatch, stub_run_watch, capsys):
    monkeypatch.setattr(
        pr_watch, "_run_conclusion", lambda _id: ("completed", "failure")
    )

    failures: list[int] = []
    pr_watch.watch_run(999, "CI", pr_watch.threading.Event(), failures)

    assert failures == [999]
    assert "✗  CI — failed" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# _ci_gate_state — head-SHA-scoped, superseded leftovers don't shadow the live gate
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_ci_gate_state_prefers_live_gate_over_cancelled_leftover(monkeypatch):
    """A re-run leaves a cancelled CI Gate check next to the live one."""
    rollup = [
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
        _gate("", status="IN_PROGRESS", completed_at="2026-07-24T23:30:00Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("IN_PROGRESS", "")


@pytest.mark.unit
def test_ci_gate_state_picks_newest_when_all_superseded(monkeypatch):
    rollup = [
        _gate("CANCELLED", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    status, conclusion = pr_watch._ci_gate_state(PR)
    assert (status, conclusion) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_ci_gate_state_absent(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[]))
    assert pr_watch._ci_gate_state(PR) == ("", "")


# ---------------------------------------------------------------------------
# _pre_check_blocking — cancelled must not hard-exit the watcher
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_pre_check_does_not_block_on_cancelled_ci_gate(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("CANCELLED")]))
    ok, reason = pr_watch._pre_check_blocking(PR)
    assert ok, reason


@pytest.mark.unit
def test_pre_check_still_blocks_on_failed_ci_gate(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("FAILURE")]))
    ok, reason = pr_watch._pre_check_blocking(PR)
    assert not ok
    assert "CI Gate already failed" in reason


@pytest.mark.unit
def test_pre_check_passes_on_green_ci_gate(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("SUCCESS")]))
    assert pr_watch._pre_check_blocking(PR) == (True, "")


# ---------------------------------------------------------------------------
# _finalize_via_ci_gate — cancelled gets a bounded grace, not an instant failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_finalize_waits_for_replacement_after_cancelled_gate(monkeypatch, capsys):
    """Cancelled → a replacement run posts a green gate → success."""
    states = [("COMPLETED", "CANCELLED"), ("IN_PROGRESS", ""), ("COMPLETED", "SUCCESS")]
    monkeypatch.setattr(pr_watch, "_ci_gate_state", lambda _pr: states.pop(0))
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _s: None)

    assert pr_watch._finalize_via_ci_gate(PR, timeout_sec=60, poll_sec=0) == 0
    assert "CI Gate passed" in capsys.readouterr().out


@pytest.mark.unit
def test_finalize_gives_up_on_cancelled_gate_without_failure_wording(
    monkeypatch, capsys
):
    """No replacement ever appears — exit 1, but reported as superseded."""
    monkeypatch.setattr(
        pr_watch, "_ci_gate_state", lambda _pr: ("COMPLETED", "CANCELLED")
    )
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _s: None)
    monkeypatch.setattr(pr_watch, "SUPERSEDED_GATE_GRACE", 0)

    assert pr_watch._finalize_via_ci_gate(PR, timeout_sec=60, poll_sec=0) == 1
    out = capsys.readouterr().out
    assert "superseded" in out
    assert "CI Gate failed" not in out


@pytest.mark.unit
def test_finalize_fails_fast_on_real_failure(monkeypatch, capsys):
    monkeypatch.setattr(
        pr_watch, "_ci_gate_state", lambda _pr: ("COMPLETED", "FAILURE")
    )
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _s: None)

    assert pr_watch._finalize_via_ci_gate(PR, timeout_sec=60, poll_sec=0) == 1
    assert "CI Gate failed" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# main() — the completed-runs scan (the site that hard-exited the watcher)
# ---------------------------------------------------------------------------


@pytest.fixture
def stub_watch_loop(monkeypatch):
    """Neutralize the threaded watch loop so main()'s scan logic is what's tested."""
    monkeypatch.setattr(pr_watch, "watch_run", lambda *a, **k: None)
    monkeypatch.setattr(pr_watch, "watch_reviews", lambda *a, **k: None)
    monkeypatch.setattr(pr_watch, "_finalize_via_ci_gate", lambda *a, **k: 0)
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _s: None)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda run_id: f"tmp/gh-monitor/failure-{run_id}.md",
    )
    monkeypatch.setattr(sys, "argv", ["pr-watch.py", str(PR)])


@pytest.mark.unit
def test_main_does_not_exit_on_cancelled_run_at_head_sha(
    monkeypatch, stub_watch_loop, capsys
):
    """The exact PR #1734 shape: a self-cancelled Preview Auto-Resync at HEAD
    alongside a live CI run. Before PP-r63o this exited 1 on every invocation
    and --force did not help."""
    runs = [
        _run(30133783967, "completed", "cancelled", "Preview Auto-Resync"),
        _run(30133783968, "in_progress", "", "CI"),
    ]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )

    assert pr_watch.main() == 0
    out = capsys.readouterr().out
    assert "failure(s) detected" not in out


@pytest.mark.unit
def test_main_ignores_cancelled_run_from_an_older_commit(
    monkeypatch, stub_watch_loop, capsys
):
    """A run cancelled when THIS commit superseded it belongs to the old SHA."""
    runs = [
        _run(30132766363, "completed", "cancelled", "CI", sha=OLD_SHA),
        _run(30132766999, "completed", "failure", "CI", sha=OLD_SHA),
        _run(30133783968, "in_progress", "", "CI"),
    ]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )

    assert pr_watch.main() == 0
    assert "failure(s) detected" not in capsys.readouterr().out


@pytest.mark.unit
def test_main_still_fails_on_real_early_failure(monkeypatch, stub_watch_loop, capsys):
    runs = [
        _run(555, "completed", "failure", "CI"),
        _run(556, "in_progress", "", "CI"),
    ]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )

    assert pr_watch.main() == 1
    out = capsys.readouterr().out
    assert "1 failure(s) detected before watching started" in out
    assert "failure-555.md" in out


@pytest.mark.unit
def test_main_all_runs_cancelled_defers_to_ci_gate(
    monkeypatch, stub_watch_loop, capsys
):
    """No active runs and only cancelled completed runs — anchor on CI Gate
    rather than reporting failures."""
    runs = [_run(30133783967, "completed", "cancelled", "Preview Auto-Resync")]
    monkeypatch.setattr(pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("SUCCESS")]))
    monkeypatch.setattr(pr_watch, "STARTUP_RETRIES", 1)

    assert pr_watch.main() == 0
    assert "failure(s) detected" not in capsys.readouterr().out


# ---------------------------------------------------------------------------
# run_audit — a cancelled gate is "not ready", but not described as a failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_run_audit_reports_cancelled_gate_as_superseded(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("CANCELLED")]))
    assert pr_watch.run_audit(PR) is False
    assert "cancelled (superseded)" in capsys.readouterr().out
