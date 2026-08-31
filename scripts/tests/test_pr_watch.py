"""Regression tests for the compact aggregate PR watcher.

The ordinary watch path performs one exact-head ``CI Gate`` query per interval,
follows replacement heads, and remains quiet for unchanged state. Cancellation
is supersession rather than failure, while an API outage is undetermined rather
than a fabricated red result. Detailed run logs are fetched only after the
aggregate gate has conclusively failed. (PP-r63o, PP-qkl8)

Review state: `--check-ready` reports which automatic Codex-review state a PR is
in without gating on it — "reviewed", "reviewed then pushed past", and "not yet
reviewed" need different actions, and flattening a stale approval into "reviewed"
is how a commit nobody read reaches the merge command.

Everything is mocked at the `gh` CLI seam (`pr_watch.gh`) — these tests never
reach GitHub (CORE-TEST-006).
"""

import importlib.util
import json
import re
import subprocess
import sys
import time
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

# The stderr `gh` produced on 2026-07-26 when the shared user-level quota ran
# out mid-watch on PR #1748 — the live evidence behind PP-qkl8. The real message
# named the account whose quota it was; the numeric id is dropped here because
# nothing under test reads it.
RATE_LIMIT_403 = "HTTP 403: API rate limit exceeded for user ID"


def _gate(
    conclusion: str,
    status: str = "COMPLETED",
    completed_at: str = "",
    started_at: str | None = None,
) -> dict:
    return {
        "name": pr_watch.CI_GATE_NAME,
        "status": status,
        "conclusion": conclusion,
        "completedAt": completed_at,
        "startedAt": completed_at if started_at is None else started_at,
    }


def _run(run_id: int, status: str, conclusion: str, sha=HEAD_SHA) -> dict:
    return {
        "databaseId": run_id,
        "status": status,
        "conclusion": conclusion,
        "headSha": sha,
    }


def _ago(seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - seconds))


def codex_review(sha=HEAD_SHA, state="APPROVED", submitted_at="2026-08-22T12:00:00Z"):
    return {
        "user": {"login": pr_watch.CODEX_REVIEW_BOT},
        "state": state,
        "commit_id": sha,
        "submitted_at": submitted_at,
    }


def manual_marker(sha=HEAD_SHA):
    return {
        "body": f"<!-- pinpoint-review: {sha} -->\nreviewed",
        "updated_at": "2026-08-22T12:00:00Z",
    }


def clean_codex_comment(
    sha=HEAD_SHA[:10],
    *,
    login=pr_watch.CODEX_REVIEW_BOT,
    app=pr_watch.CODEX_REVIEW_APP_SLUG,
    updated_at="2026-08-22T12:00:00Z",
):
    return {
        "user": {"login": login},
        "performed_via_github_app": {"slug": app},
        "body": (
            "Codex Review: Didn't find any major issues. Keep it up!\n\n"
            f"**Reviewed commit:** `{sha}`"
        ),
        "updated_at": updated_at,
    }


def clean_codex_reaction_witness(
    sha=HEAD_SHA,
    *,
    login=pr_watch.GITHUB_ACTIONS_BOT,
    app=pr_watch.GITHUB_ACTIONS_APP_SLUG,
    updated_at="2026-08-22T12:02:00Z",
):
    return {
        "user": {"login": login},
        "performed_via_github_app": {"slug": app},
        "body": f"<!-- pinpoint-codex-reaction-witness: {sha} -->\nwitnessed",
        "created_at": updated_at,
        "updated_at": updated_at,
    }


def make_gh(
    *,
    rollup=(),
    merge_state="CLEAN",
    threads=(),
    labels=(),
    reviews=(),
    comments=(),
):
    """Build a fake `gh` that answers every call pr-watch makes.

    Records each invocation on `.calls` so tests can assert what was queried.

    `reviews` is what `review_state` reads. It defaults to empty — the
    `unreviewed` state — which is deliberate: `unreviewed` is reported but does
    NOT gate readiness, so tests that don't care about the review stay unaffected.
    """

    def fake_gh(*args: str) -> str:
        fake_gh.calls.append(args)
        if args[:2] == ("pr", "view"):
            fields = args[4]
            if fields == "headRefOid,statusCheckRollup":
                return json.dumps(
                    {
                        "headRefOid": HEAD_SHA,
                        "statusCheckRollup": list(rollup),
                    }
                )
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
            if fields == "headRefOid":
                return json.dumps({"headRefOid": HEAD_SHA})
        if args[:2] == ("api", "--paginate"):
            path = args[2]
            if "/reviews" in path:
                return json.dumps(list(reviews))
            if "/comments" in path:
                return json.dumps(list(comments))
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
        if args[0] == "api":  # unmodelled api probe
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
def test_completed_with_empty_conclusion_fails_safe(conclusion):
    """A COMPLETED run whose conclusion hasn't populated must not read as green.

    Callers gate on status first, so an empty conclusion reaching _is_failing
    means GitHub called the run complete without saying how it went. Shrugging
    at that would let the watcher report green on an unobserved outcome.
    """
    assert pr_watch._is_failing(conclusion)
    assert not pr_watch._is_passing(conclusion)
    assert not pr_watch._is_superseded(conclusion)


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
def test_ci_gate_state_prefers_replacement_that_started_after_late_cancellation(
    monkeypatch,
):
    rollup = [
        _gate(
            "CANCELLED",
            completed_at="2026-07-24T23:35:00Z",
            started_at="2026-07-24T23:25:00Z",
        ),
        _gate(
            "SUCCESS",
            completed_at="2026-07-24T23:34:00Z",
            started_at="2026-07-24T23:30:00Z",
        ),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("COMPLETED", "SUCCESS")


@pytest.mark.unit
def test_ci_gate_state_reports_newer_cancellation_over_older_failure(monkeypatch):
    """The latest rerun is authoritative even when both outcomes are non-green."""
    rollup = [
        _gate("FAILURE", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_ci_gate_state_does_not_expose_older_green_after_cancellation(monkeypatch):
    rollup = [
        _gate("SUCCESS", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_ci_gate_state_reports_cancelled_when_every_gate_is_superseded(monkeypatch):
    rollup = [
        _gate("CANCELLED", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("COMPLETED", "CANCELLED")


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
    ok, reason, _action_item = pr_watch._pre_check_blocking(PR)
    assert ok, reason


@pytest.mark.unit
def test_pre_check_still_blocks_on_failed_ci_gate(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("FAILURE")]))
    ok, reason, _action_item = pr_watch._pre_check_blocking(PR)
    assert not ok
    assert "CI Gate already failed" in reason


@pytest.mark.unit
def test_pre_check_passes_on_green_ci_gate(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("SUCCESS")]))
    assert pr_watch._pre_check_blocking(PR) == (True, "", "")


@pytest.mark.unit
def test_pre_check_reports_unresolved_threads_without_blocking(monkeypatch, capsys):
    """Watching CI is a step INSIDE the address-the-findings loop, not after it.

    Threads became author-agnostic in PP-4ric, so they are now the reviewer's
    `/codex:review` findings. The documented loop is fix → push → watch CI →
    resolve once green; blocking here would refuse to watch the very push that
    addresses them, leaving --force (which also drops the merge-state and
    already-failed-CI pre-checks) as the only way through.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(rollup=[_gate("SUCCESS")], threads=[{"isResolved": False}]),
    )
    ok, reason, action_item = pr_watch._pre_check_blocking(PR)
    assert (ok, reason) == (True, "")
    assert action_item == "1 unresolved review thread(s) — resolve before merge"
    assert "1 unresolved review thread(s)" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# Aggregate CI Gate watcher — one exact-head query per interval
# ---------------------------------------------------------------------------


def snapshot_gh(snapshots):
    """Return snapshots in sequence and record every remote call."""
    remaining = list(snapshots)

    def fake_gh(*args: str) -> str:
        fake_gh.calls.append(args)
        assert args[:2] == ("pr", "view"), args
        assert args[4] == "headRefOid,statusCheckRollup", args
        snapshot = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        return json.dumps(snapshot)

    fake_gh.calls = []
    return fake_gh


def ci_snapshot(head=HEAD_SHA, gate=None):
    return {
        "headRefOid": head,
        "statusCheckRollup": [] if gate is None else [gate],
    }


def spawn_live_monitor(lock_path: Path, state_path: Path, ready_path: Path):
    """Hold the real process lock while publishing a terminal local snapshot."""
    code = r"""
import fcntl
import json
import os
import sys
import time
from pathlib import Path

lock_path, state_path, ready_path, repository, pr, head = sys.argv[1:]
with open(lock_path, "a+", encoding="utf-8") as lock_handle:
    fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
    lock_handle.seek(0)
    lock_handle.truncate()
    lock_handle.write(f"{os.getpid()}\n")
    lock_handle.flush()
    os.fsync(lock_handle.fileno())
    state = {
        "schema_version": 1,
        "repository": repository,
        "pr": int(pr),
        "head_sha": head,
        "leader_pid": os.getpid(),
        "status": "pending",
        "timestamp": "2026-08-30T12:00:00Z",
        "detail": f"CI Gate in_progress on {head[:7]}",
        "action_item": "1 unresolved review thread(s) — resolve before merge",
    }
    def publish():
        temp = state_path + ".tmp"
        Path(temp).write_text(json.dumps(state), encoding="utf-8")
        os.replace(temp, state_path)
    publish()
    Path(ready_path).touch()
    time.sleep(0.1)
    state["status"] = "passed"
    state["detail"] = f"CI Gate passed on {head[:7]} (conclusion=SUCCESS) ✓"
    publish()
"""
    return subprocess.Popen(
        [
            sys.executable,
            "-c",
            code,
            str(lock_path),
            str(state_path),
            str(ready_path),
            pr_watch.MONITOR_REPOSITORY,
            str(PR),
            HEAD_SHA,
        ]
    )


@pytest.mark.unit
def test_watch_polls_one_aggregate_snapshot_per_interval(monkeypatch):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _seconds: None)

    assert pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=60, poll_sec=0) == 0
    assert len(fake.calls) == 2
    assert all(call[4] == "headRefOid,statusCheckRollup" for call in fake.calls)


@pytest.mark.unit
def test_live_follower_makes_zero_github_requests(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    lock_path, state_path = pr_watch._monitor_paths(PR)
    lock_path.parent.mkdir(parents=True)
    ready_path = tmp_path / "leader-ready"
    process = spawn_live_monitor(lock_path, state_path, ready_path)
    try:
        deadline = time.monotonic() + 2
        while not ready_path.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert ready_path.exists()
        gh_calls = []

        def forbidden_gh(*args):
            gh_calls.append(args)
            pytest.fail("a follower must not call GitHub")

        monkeypatch.setattr(pr_watch, "gh", forbidden_gh)
        assert (
            pr_watch._run_coordinated_watch(
                PR,
                lambda _sink, _action: pytest.fail("follower must not become leader"),
                follower_poll_sec=0.25,
            )
            == 0
        )
        assert gh_calls == []
        output = capsys.readouterr().out
        assert "CI Gate passed" in output
        assert "1 unresolved review thread(s)" in output
    finally:
        process.terminate()
        process.wait(timeout=2)


@pytest.mark.unit
def test_force_and_prechecked_watches_use_separate_owners(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    normal_paths = pr_watch._monitor_paths(PR)
    force_paths = pr_watch._monitor_paths(PR, force=True)
    assert normal_paths != force_paths

    force_lock_path, force_state_path = force_paths
    force_lock_path.parent.mkdir(parents=True)
    ready_path = tmp_path / "force-leader-ready"
    process = spawn_live_monitor(force_lock_path, force_state_path, ready_path)
    try:
        deadline = time.monotonic() + 2
        while not ready_path.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert ready_path.exists()
        owned_calls = []

        def normal_owner(state_sink, _action_item_sink):
            owned_calls.append(True)
            state_sink(HEAD_SHA, "passed", "normal prechecked owner passed", None)
            return 0

        assert (
            pr_watch._run_coordinated_watch(
                PR,
                normal_owner,
                force=False,
                follower_poll_sec=0,
            )
            == 0
        )
        assert owned_calls == [True]
    finally:
        process.terminate()
        process.wait(timeout=2)


@pytest.mark.unit
def test_terminal_cache_without_live_lock_is_remotely_revalidated(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    lock_path, state_path = pr_watch._monitor_paths(PR)
    lock_path.parent.mkdir(parents=True)
    lock_path.write_text("999999\n", encoding="utf-8")
    pr_watch._write_monitor_state(
        state_path,
        pr=PR,
        head_sha=OLD_SHA,
        leader_pid=999999,
        status="passed",
        detail="stale green",
    )
    fake = snapshot_gh([ci_snapshot(gate=_gate("SUCCESS"))])
    monkeypatch.setattr(pr_watch, "gh", fake)

    assert (
        pr_watch._run_coordinated_watch(
            PR,
            lambda sink, _action: pr_watch._watch_ci_gate(
                PR, "", timeout_sec=60, poll_sec=0, state_sink=sink
            ),
            follower_poll_sec=0,
        )
        == 0
    )
    assert len(fake.calls) == 1
    state = pr_watch._read_monitor_state(state_path, PR)
    assert state is not None
    assert state["head_sha"] == HEAD_SHA
    assert state["leader_pid"] == pr_watch.os.getpid()


@pytest.mark.unit
def test_monitor_state_rejects_malformed_and_foreign_snapshots(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    _lock_path, state_path = pr_watch._monitor_paths(PR)
    state_path.parent.mkdir(parents=True)
    state_path.write_text("{", encoding="utf-8")
    assert pr_watch._read_monitor_state(state_path, PR) is None

    pr_watch._write_monitor_state(
        state_path,
        pr=PR,
        head_sha=HEAD_SHA,
        leader_pid=123,
        status="pending",
        detail="waiting",
    )
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["repository"] = "someone/else"
    state_path.write_text(json.dumps(state), encoding="utf-8")
    assert pr_watch._read_monitor_state(state_path, PR) is None


@pytest.mark.unit
def test_monitor_state_schema_includes_failure_artifact(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    _lock_path, state_path = pr_watch._monitor_paths(PR)
    pr_watch._write_monitor_state(
        state_path,
        pr=PR,
        head_sha=HEAD_SHA,
        leader_pid=321,
        status="failed",
        detail="CI Gate failed",
        failure_artifact="tmp/gh-monitor/failure-42.md",
        action_item="1 unresolved review thread(s) — resolve before merge",
    )

    state = pr_watch._read_monitor_state(state_path, PR)
    assert state is not None
    expected_artifact = str(Path("tmp/gh-monitor/failure-42.md").resolve())
    assert state == {
        "schema_version": 1,
        "repository": "timothyfroehlich/PinPoint",
        "pr": PR,
        "head_sha": HEAD_SHA,
        "leader_pid": 321,
        "status": "failed",
        "timestamp": state["timestamp"],
        "detail": "CI Gate failed",
        "failure_artifact": expected_artifact,
        "action_item": "1 unresolved review thread(s) — resolve before merge",
    }
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", state["timestamp"])


@pytest.mark.unit
def test_watch_follows_head_movement_before_reporting_green(monkeypatch, capsys):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(head=OLD_SHA, gate=_gate("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(pr_watch, "VERBOSE_MODE", True)
    states = []

    assert (
        pr_watch._watch_ci_gate(
            PR,
            HEAD_SHA,
            timeout_sec=60,
            poll_sec=0,
            state_sink=lambda *state: states.append(state),
        )
        == 0
    )
    out = capsys.readouterr().out
    assert f"{HEAD_SHA[:7]} → {OLD_SHA[:7]}" in out
    assert f"passed on {OLD_SHA[:7]}" in out
    assert states[-1][:2] == (OLD_SHA, "passed")


@pytest.mark.unit
def test_malformed_snapshot_is_published_as_undetermined(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", lambda *_args: "{")
    states = []

    assert (
        pr_watch._watch_ci_gate(
            PR,
            HEAD_SHA,
            timeout_sec=60,
            poll_sec=0,
            state_sink=lambda *state: states.append(state),
        )
        == pr_watch.EXIT_UNDETERMINED
    )
    assert states[-1][1] == "undetermined"
    assert "unreachable" in states[-1][2]
    assert "failed" not in capsys.readouterr().out.lower()


@pytest.mark.unit
def test_watch_fetches_failure_artifact_only_after_red(monkeypatch, capsys):
    fake = snapshot_gh([ci_snapshot(gate=_gate("FAILURE"))])
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch, "_failed_ci_run_id", lambda _head: 555)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda run_id: f"tmp/gh-monitor/failure-{run_id}.md",
    )

    assert pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=60, poll_sec=0) == 1
    out = capsys.readouterr().out
    assert "CI Gate failed" in out
    assert "failure-555.md" in out
    assert len(fake.calls) == 1


@pytest.mark.unit
def test_watch_reports_api_outage_as_undetermined_without_retry(monkeypatch, capsys):
    calls = []

    def unavailable(*args):
        calls.append(args)
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", unavailable)

    assert (
        pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
        == pr_watch.EXIT_UNDETERMINED
    )
    assert len(calls) == 1
    out = capsys.readouterr().out
    assert RATE_LIMIT_403 in out
    assert "failed" not in out.lower()


@pytest.mark.unit
def test_watch_timeout_is_undetermined_not_failure(monkeypatch, capsys):
    calls = []

    def unexpected_gh(*args):
        calls.append(args)
        pytest.fail("an already-expired bounded watch must not query GitHub")

    monkeypatch.setattr(pr_watch, "gh", unexpected_gh)

    assert (
        pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=0, poll_sec=0)
        == pr_watch.EXIT_UNDETERMINED
    )
    assert calls == []
    out = capsys.readouterr().out
    assert "no terminal verdict" in out
    assert "failed" not in out.lower()


@pytest.mark.unit
def test_watch_emits_unchanged_pending_state_only_once(monkeypatch, capsys):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(pr_watch, "VERBOSE_MODE", True)

    assert pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=60, poll_sec=0) == 0
    assert capsys.readouterr().out.count("CI Gate in_progress") == 1


@pytest.mark.unit
def test_watch_bounds_a_superseded_gate_without_failure_artifact(monkeypatch, capsys):
    fake = snapshot_gh([ci_snapshot(gate=_gate("CANCELLED"))])
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(pr_watch, "SUPERSEDED_GATE_GRACE", 0)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda _run_id: pytest.fail("superseded gates have no failure artifact"),
    )

    assert pr_watch._watch_ci_gate(PR, HEAD_SHA, timeout_sec=60, poll_sec=0) == 1
    out = capsys.readouterr().out
    assert "superseded" in out
    assert "CI Gate failed" not in out


@pytest.mark.unit
def test_failure_run_lookup_is_terminal_only_and_head_scoped(monkeypatch):
    calls = []

    def fake_gh(*args):
        calls.append(args)
        return json.dumps(
            [
                _run(41, "completed", "failure", sha=OLD_SHA),
                _run(42, "completed", "cancelled"),
                _run(43, "completed", "failure"),
            ]
        )

    monkeypatch.setattr(pr_watch, "gh", fake_gh)

    assert pr_watch._failed_ci_run_id(HEAD_SHA) == 43
    assert len(calls) == 1
    assert calls[0][:2] == ("run", "list")


# ---------------------------------------------------------------------------
# run_audit — a cancelled gate is "not ready", but not described as a failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_run_audit_reports_cancelled_gate_as_superseded(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("CANCELLED")]))
    assert pr_watch.run_audit(PR) is False
    assert "cancelled (superseded)" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# review_state — native Codex review states, pinned to the reviewed SHA (PP-4ric)
# ---------------------------------------------------------------------------
#
# ---------------------------------------------------------------------------
# review_state — trusted Codex GitHub reviews
# ---------------------------------------------------------------------------

GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"


@pytest.mark.unit
def test_codex_login_is_identical_to_the_bash_gate():
    gates = GATES_PATH.read_text()
    match = re.search(r'^readonly CODEX_REVIEW_BOT="(.+)"$', gates, re.M)
    assert match, "CODEX_REVIEW_BOT not found in _pr-gates.sh"
    assert match.group(1) == pr_watch.CODEX_REVIEW_BOT

    app_match = re.search(r'^readonly CODEX_REVIEW_APP_SLUG="(.+)"$', gates, re.M)
    assert app_match, "CODEX_REVIEW_APP_SLUG not found in _pr-gates.sh"
    assert app_match.group(1) == pr_watch.CODEX_REVIEW_APP_SLUG


@pytest.mark.unit
@pytest.mark.parametrize(
    "state",
    [
        "approval",
        "clean_comment",
        "clean_reaction",
        "reviewed",
        "marker",
        "stale_approval",
        "stale_clean_comment",
        "stale_clean_reaction",
        "stale_marker",
        "not_approved",
        "unreviewed",
    ],
)
def test_state_vocabulary_is_shared_with_the_bash_gate(state):
    arms = re.findall(r"^    (\w+)\)$", GATES_PATH.read_text(), re.M)
    assert state in arms, arms


@pytest.mark.unit
def test_review_state_unreviewed(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(reviews=()))
    state, detail = pr_watch.review_state(PR)
    assert state == "unreviewed"
    assert "automatic Codex review" in detail
    assert "only when Tim explicitly requests it" in detail


@pytest.mark.unit
def test_review_state_approval_pins_head(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(reviews=[codex_review()]))
    state, detail = pr_watch.review_state(PR)
    assert state == "approval"
    assert HEAD_SHA[:7] in detail


@pytest.mark.unit
def test_review_state_clean_comment_pins_head(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(comments=[clean_codex_comment()]))
    state, detail = pr_watch.review_state(PR)
    assert state == "clean_comment"
    assert HEAD_SHA[:10] in detail


@pytest.mark.unit
def test_review_state_clean_reaction_witness_pins_head(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            comments=[clean_codex_reaction_witness()],
        ),
    )
    state, detail = pr_watch.review_state(PR)
    assert state == "clean_reaction"
    assert HEAD_SHA[:7] in detail


@pytest.mark.unit
@pytest.mark.parametrize(
    "witness",
    [
        clean_codex_reaction_witness(login="other[bot]"),
        clean_codex_reaction_witness(app="other-app"),
        clean_codex_reaction_witness(OLD_SHA),
    ],
)
def test_review_state_rejects_untrusted_or_stale_reaction_witness(monkeypatch, witness):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            comments=[witness],
        ),
    )
    assert pr_watch.review_state(PR)[0] != "clean_reaction"


@pytest.mark.unit
@pytest.mark.parametrize(
    "comment",
    [
        clean_codex_comment(login="other[bot]"),
        clean_codex_comment(app="other-app"),
        clean_codex_comment(OLD_SHA[:10]),
    ],
)
def test_review_state_rejects_untrusted_or_stale_clean_comment(monkeypatch, comment):
    monkeypatch.setattr(pr_watch, "gh", make_gh(comments=[comment]))
    assert pr_watch.review_state(PR)[0] != "clean_comment"


@pytest.mark.unit
def test_review_state_later_native_finding_overrides_clean_comment(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(state="COMMENTED", submitted_at="2026-08-22T12:01:00Z")
            ],
            comments=[clean_codex_comment(updated_at="2026-08-22T12:00:00Z")],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "reviewed"


@pytest.mark.unit
def test_review_state_ignores_delayed_native_review_of_old_head(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(
                    OLD_SHA,
                    state="COMMENTED",
                    submitted_at="2026-08-22T12:01:00Z",
                )
            ],
            comments=[clean_codex_comment(updated_at="2026-08-22T12:00:00Z")],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "clean_comment"


@pytest.mark.unit
def test_review_state_later_clean_comment_supersedes_native_finding(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")
            ],
            comments=[clean_codex_comment(updated_at="2026-08-22T12:01:00Z")],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "clean_comment"


@pytest.mark.unit
def test_review_state_current_finding_outranks_delayed_stale_clean_comment(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")
            ],
            comments=[
                clean_codex_comment(OLD_SHA[:10], updated_at="2026-08-22T12:01:00Z")
            ],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "reviewed"


@pytest.mark.unit
def test_review_state_manual_marker_pins_head(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(comments=[manual_marker()]))
    assert pr_watch.review_state(PR)[0] == "marker"


@pytest.mark.unit
def test_review_state_manual_marker_survives_non_approval_codex_review(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[codex_review(state="CHANGES_REQUESTED")],
            comments=[manual_marker()],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "marker"


def test_review_state_reports_a_newer_stale_marker_over_an_older_codex_non_approval(
    monkeypatch,
):
    marker = manual_marker(OLD_SHA)
    marker["updated_at"] = "2026-08-22T12:01:00Z"
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[codex_review(OLD_SHA, state="CHANGES_REQUESTED")],
            comments=[marker],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "stale_marker"


@pytest.mark.unit
def test_review_state_skips_marker_lookup_after_current_codex_approval(monkeypatch):
    fake_gh = make_gh(reviews=[codex_review()])
    monkeypatch.setattr(pr_watch, "gh", fake_gh)
    assert pr_watch.review_state(PR)[0] == "approval"
    assert not any("/comments" in args[-1] for args in fake_gh.calls)


@pytest.mark.unit
def test_review_state_stale_approval(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(reviews=[codex_review(OLD_SHA)]))
    state, detail = pr_watch.review_state(PR)
    assert state == "stale_approval"
    assert OLD_SHA[:7] in detail
    assert HEAD_SHA[:7] in detail


@pytest.mark.unit
def test_review_state_current_head_finding_completes_review_coverage(monkeypatch):
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(reviews=[codex_review(state="COMMENTED")])
    )
    assert pr_watch.review_state(PR)[0] == "reviewed"


@pytest.mark.unit
@pytest.mark.parametrize("state", ["DISMISSED", "PENDING", "UNKNOWN"])
def test_review_state_unusable_current_head_state_fails_closed(monkeypatch, state):
    monkeypatch.setattr(pr_watch, "gh", make_gh(reviews=[codex_review(state=state)]))
    assert pr_watch.review_state(PR)[0] == "not_approved"


@pytest.mark.unit
def test_review_state_uses_the_latest_codex_review(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(submitted_at="2026-08-22T12:00:00Z"),
                codex_review(
                    state="CHANGES_REQUESTED",
                    submitted_at="2026-08-22T12:01:00Z",
                ),
            ]
        ),
    )
    assert pr_watch.review_state(PR)[0] == "reviewed"


@pytest.mark.unit
def test_review_state_ignores_delayed_old_head_native_review(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            reviews=[
                codex_review(submitted_at="2026-08-22T12:00:00Z"),
                codex_review(
                    OLD_SHA,
                    state="COMMENTED",
                    submitted_at="2026-08-22T12:01:00Z",
                ),
            ]
        ),
    )
    assert pr_watch.review_state(PR)[0] == "approval"


# ---------------------------------------------------------------------------
# run_audit — the review state is reported, but does not gate readiness
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "state,reviews,comments",
    [
        ("unreviewed", (), ()),
        ("stale_approval", (codex_review(OLD_SHA),), ()),
        ("approval", (codex_review(),), ()),
        ("clean_comment", (), (clean_codex_comment(),)),
        ("marker", (), (manual_marker(),)),
    ],
)
def test_run_audit_reports_the_review_state_without_gating_on_it(
    monkeypatch, capsys, state, reviews, comments
):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(rollup=[_gate("SUCCESS")], reviews=reviews, comments=comments),
    )
    assert pr_watch.run_audit(PR) is True
    assert f"✓ review: {state}:" in capsys.readouterr().out


@pytest.mark.unit
def test_run_audit_still_fails_on_unresolved_threads(monkeypatch, capsys):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            rollup=[_gate("SUCCESS")],
            threads=[{"isResolved": False}, {"isResolved": True}],
        ),
    )
    assert pr_watch.run_audit(PR) is False
    assert "✗ threads-resolved: 1 unresolved" in capsys.readouterr().out
