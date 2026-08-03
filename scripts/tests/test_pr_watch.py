"""Regression tests for scripts/workflow/pr-watch.py.

Three false-alarm bugs are covered — all of the same family: the watcher
reporting a failure for something that was not one.

1. A `cancelled` run was classified as a failure — cancellation is routine
   (a newer commit cancels the in-flight run via concurrency groups, and the
   Preview Auto-Resync workflow cancels itself), so a normal push-twice cycle
   emitted a spurious "✗ CI — failed" plus a failure artifact whose log body
   read "(no log available)". (PP-r63o)
2. The completed-runs scan and the CI Gate pre-check must only consider the
   CURRENT head SHA, so a stale cancelled run from an older commit — or a
   superseded CI Gate check left behind at the same commit — can't hard-exit
   the watcher. `--force` was the workaround; it should no longer be needed.
   (PP-r63o)
3. A failed `gh run view` (rate-limit 403, network drop, auth failure) was
   swallowed into ("", ""), which is neither queued nor passing nor superseded
   and so landed in the fail-safe branch: "✗ CI — failed" plus an artifact, for
   a healthy run whose jobs were all still pending. "We could not find out" is
   not a verdict. (PP-qkl8)

Review state (PP-4ric, extended by PP-97tt): Copilot review was retired on
2026-08-02, so no bot reviews this repo. Two things now record that a head was
reviewed — the SHA-pinned marker, and the inline comments `/code-review
--comment` posts — and `--check-ready` reports which of the five resulting
states a PR is in without gating on it. "Reviewed", "reviewed then pushed past",
and "never reviewed" need different actions, and flattening a stale state into
"reviewed" is how a commit nobody read reaches the merge command.

Everything is mocked at the `gh` CLI seam (`pr_watch.gh`) — these tests never
reach GitHub (CORE-TEST-006).
"""

import importlib.util
import json
import re
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


def _ago(seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - seconds))


def marker_comment(sha=HEAD_SHA):
    """A comment in the exact shape mark-claude-review.sh posts."""
    return {"body": f"<!-- pinpoint-claude-review: {sha} -->\nClaude review of head"}


def review_comment(sha=HEAD_SHA, *, in_reply_to=None):
    """An inline finding, as `/code-review <depth> --comment <PR>` leaves it.

    `commit_id` deliberately differs from `original_commit_id`: GitHub re-anchors
    the former as the PR advances, so reading it would report every review
    comment as pinning head forever.
    """
    return {
        "original_commit_id": sha,
        "commit_id": "1" * 40,
        "in_reply_to_id": in_reply_to,
    }


def make_gh(
    *,
    rollup=(),
    runs=(),
    merge_state="CLEAN",
    threads=(),
    labels=(),
    issue_comments=(),
    review_comments=(),
):
    """Build a fake `gh` that answers every call pr-watch makes.

    Records each invocation on `.calls` so tests can assert what was queried.

    `issue_comments` and `review_comments` are the two evidence sources
    `review_state` reads (PP-97tt) — markers on the issues endpoint, inline
    findings on the pulls one. Both default to empty, the `unreviewed` state,
    which is deliberate: `unreviewed` is reported but does NOT gate readiness, so
    tests that don't care about the review stay unaffected.
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
            if fields == "headRefOid":
                return json.dumps({"headRefOid": HEAD_SHA})
        if args[:2] == ("api", "--paginate"):
            path = args[2]
            if "/pulls/" in path and "/comments" in path:
                return json.dumps(list(review_comments))
            if "/comments" in path:
                return json.dumps(list(issue_comments))
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
    undetermined: list[tuple[str, str]] = []
    pr_watch.watch_run(
        30133783967,
        "Preview Auto-Resync",
        pr_watch.threading.Event(),
        failures,
        undetermined,
    )

    out = capsys.readouterr().out
    assert failures == []
    assert undetermined == []
    assert "superseded" in out
    assert "failed" not in out


@pytest.mark.unit
def test_watch_run_failure_still_records_failure(monkeypatch, stub_run_watch, capsys):
    monkeypatch.setattr(
        pr_watch, "_run_conclusion", lambda _id: ("completed", "failure")
    )

    failures: list[int] = []
    undetermined: list[tuple[str, str]] = []
    pr_watch.watch_run(999, "CI", pr_watch.threading.Event(), failures, undetermined)

    assert failures == [999]
    assert undetermined == []
    assert "✗  CI — failed" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# _run_conclusion — a failed gh call is "unknown", not "no conclusion" (PP-qkl8)
# ---------------------------------------------------------------------------


@pytest.fixture
def no_backoff(monkeypatch):
    """Collapse the retry backoff so tests don't actually wait."""
    monkeypatch.setattr(pr_watch, "RUN_STATE_BACKOFF", 0)


@pytest.mark.unit
@pytest.mark.parametrize(
    "stderr",
    [
        RATE_LIMIT_403,
        "dial tcp: lookup api.github.com: no such host",
        "HTTP 401: Bad credentials",
    ],
)
def test_run_conclusion_raises_when_gh_fails(monkeypatch, stderr):
    """Rate limit, network, auth — every gh failure is an unknown, not a state."""

    def boom(*_args: str) -> str:
        raise RuntimeError(stderr)

    monkeypatch.setattr(pr_watch, "gh", boom)
    with pytest.raises(pr_watch.RunStateUnavailable, match=stderr[:20]):
        pr_watch._run_conclusion(30184323661)


@pytest.mark.unit
def test_run_conclusion_quotes_unparseable_output(monkeypatch):
    """ "Expecting value: line 1 column 1" alone is unactionable — show the body."""
    monkeypatch.setattr(pr_watch, "gh", lambda *_a: "<html>rate limited</html>")
    with pytest.raises(pr_watch.RunStateUnavailable, match="rate limited"):
        pr_watch._run_conclusion(30184323661)


@pytest.mark.unit
def test_run_conclusion_normalises_null_fields(monkeypatch):
    """`conclusion` is null on a run that hasn't finished — return "", not None."""
    monkeypatch.setattr(
        pr_watch, "gh", lambda *_a: json.dumps({"status": "in_progress"})
    )
    assert pr_watch._run_conclusion(30184323661) == ("in_progress", "")

    monkeypatch.setattr(
        pr_watch,
        "gh",
        lambda *_a: json.dumps({"status": "in_progress", "conclusion": None}),
    )
    assert pr_watch._run_conclusion(30184323661) == ("in_progress", "")


@pytest.mark.unit
def test_run_conclusion_retrying_is_bounded(monkeypatch, no_backoff):
    """A persistently unreachable API must terminate, not spin forever."""
    attempts: list[int] = []

    def boom(*_args: str) -> str:
        attempts.append(1)
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", boom)
    with pytest.raises(pr_watch.RunStateUnavailable, match="rate limit exceeded"):
        pr_watch._run_conclusion_retrying(30184323661, "CI", pr_watch.threading.Event())
    assert len(attempts) == pr_watch.RUN_STATE_ATTEMPTS


@pytest.mark.unit
def test_run_conclusion_retrying_recovers_after_a_blip(monkeypatch, no_backoff):
    calls: list[int] = []

    def flaky(*_args: str) -> str:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError(RATE_LIMIT_403)
        return json.dumps({"status": "completed", "conclusion": "success"})

    monkeypatch.setattr(pr_watch, "gh", flaky)
    assert pr_watch._run_conclusion_retrying(
        30184323661, "CI", pr_watch.threading.Event()
    ) == ("completed", "success")
    assert len(calls) == 2


@pytest.mark.unit
def test_run_conclusion_retrying_stops_when_asked_to_stop(monkeypatch, no_backoff):
    """A stop request (a sibling run finished the watch) ends the retries."""
    attempts: list[int] = []

    def boom(*_args: str) -> str:
        attempts.append(1)
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", boom)
    stop = pr_watch.threading.Event()
    stop.set()
    with pytest.raises(pr_watch.RunStateUnavailable):
        pr_watch._run_conclusion_retrying(30184323661, "CI", stop)
    assert len(attempts) == 1


# ---------------------------------------------------------------------------
# watch_run — an unreachable API is recorded as undetermined, never a failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_watch_run_rate_limit_403_is_not_a_failure(
    monkeypatch, stub_run_watch, no_backoff, capsys
):
    """The PR #1748 shape: gh 403s while every job in the run is still pending.

    Before PP-qkl8 this emitted "✗ CI — failed" and wrote
    tmp/gh-monitor/failure-30184323661.md for a healthy run.
    """

    def boom(*_args: str) -> str:
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", boom)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda _id: pytest.fail("no artifact should be written when gh itself failed"),
    )

    failures: list[int] = []
    undetermined: list[tuple[str, str]] = []
    pr_watch.watch_run(
        30184323661, "CI", pr_watch.threading.Event(), failures, undetermined
    )

    out = capsys.readouterr().out
    assert failures == []
    assert undetermined == [("CI", RATE_LIMIT_403)]
    assert "failed" not in out
    assert RATE_LIMIT_403 in out  # the message names the real cause


@pytest.mark.unit
def test_watch_run_silent_when_stopped_mid_outage(
    monkeypatch, stub_run_watch, no_backoff, capsys
):
    """A stop mid-outage is a shutdown, not a verdict — record nothing, say nothing.

    `stop` is set when the watch is being torn down, which can happen while a
    retry is in flight. Reporting "could not determine" then would be noise
    about a watch we deliberately ended.
    """
    stop = pr_watch.threading.Event()
    calls: list[int] = []

    def boom(*_args: str) -> str:
        calls.append(1)
        if len(calls) == 2:
            stop.set()
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", boom)

    failures: list[int] = []
    undetermined: list[tuple[str, str]] = []
    pr_watch.watch_run(30184323661, "CI", stop, failures, undetermined)

    assert failures == []
    assert undetermined == []
    assert "could not determine" not in capsys.readouterr().out.lower()


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
def test_ci_gate_state_prefers_older_failure_over_newer_cancellation(monkeypatch):
    """Supersession must never mask a real verdict, even a newer cancellation.

    Pins the FIRST key of the ranking (non-superseded wins) independently of
    the second (recency): here the cancelled entry is the more recent one, so
    a naive "newest wins" would hide the failure.
    """
    rollup = [
        _gate("FAILURE", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=rollup))
    assert pr_watch._ci_gate_state(PR) == ("COMPLETED", "FAILURE")


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


@pytest.mark.unit
def test_pre_check_reports_unresolved_threads_without_blocking(monkeypatch, capsys):
    """Watching CI is a step INSIDE the address-the-findings loop, not after it.

    Threads became author-agnostic in PP-4ric, so they are now the reviewer's
    `/code-review` findings. The documented loop is fix → push → watch CI →
    resolve once green; blocking here would refuse to watch the very push that
    addresses them, leaving --force (which also drops the merge-state and
    already-failed-CI pre-checks) as the only way through.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(rollup=[_gate("SUCCESS")], threads=[{"isResolved": False}]),
    )
    ok, reason = pr_watch._pre_check_blocking(PR)
    assert (ok, reason) == (True, "")
    assert "1 unresolved review thread(s)" in capsys.readouterr().out


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


@pytest.mark.unit
def test_main_fails_safe_on_completed_run_with_empty_conclusion(
    monkeypatch, stub_watch_loop, capsys
):
    """GitHub can report `completed` before the conclusion populates. That is
    not a supersession and must not be shrugged off as green."""
    runs = [
        _run(777, "completed", "", "CI"),
        _run(778, "in_progress", "", "CI"),
    ]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )

    assert pr_watch.main() == 1
    assert "1 failure(s) detected before watching started" in capsys.readouterr().out


@pytest.mark.unit
def test_main_announces_a_superseded_run_only_once(
    monkeypatch, stub_watch_loop, capsys
):
    """The startup loop re-lists runs on every retry — don't re-announce."""
    runs = [_run(30133783967, "completed", "cancelled", "Preview Auto-Resync")]
    monkeypatch.setattr(pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("SUCCESS")]))
    monkeypatch.setattr(pr_watch, "STARTUP_RETRIES", 3)
    # main() drives VERBOSE_MODE off argv, so ask for verbosity there — the
    # superseded notice is an emit_event, suppressed in the default quiet mode.
    monkeypatch.setattr(sys, "argv", ["pr-watch.py", "--verbose", str(PR)])
    monkeypatch.setattr(pr_watch, "VERBOSE_MODE", pr_watch.VERBOSE_MODE)

    assert pr_watch.main() == 0
    out = capsys.readouterr().out
    assert out.count("Preview Auto-Resync — superseded (cancelled)") == 1


@pytest.mark.unit
def test_main_reports_undetermined_runs_as_unknown_not_failure(
    monkeypatch, stub_watch_loop, capsys
):
    """An unreadable run exits 2 with the cause — not 1 with "failure(s) detected".

    CI Gate is deliberately not consulted: the same API is down, and under a
    rate-limit 403 every extra call digs the shared quota deeper.
    """
    runs = [_run(30184323661, "in_progress", "", "CI")]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )
    monkeypatch.setattr(
        pr_watch,
        "watch_run",
        lambda _id, name, _stop, _failures, undetermined: undetermined.append(
            (name, RATE_LIMIT_403)
        ),
    )
    monkeypatch.setattr(
        pr_watch,
        "_finalize_via_ci_gate",
        lambda *_a, **_k: pytest.fail("CI Gate must not be polled while gh is down"),
    )

    assert pr_watch.main() == pr_watch.EXIT_UNDETERMINED
    out = capsys.readouterr().out
    assert "Could not determine the outcome of CI" in out
    assert RATE_LIMIT_403 in out
    assert "failure(s) detected" not in out
    assert "failed" not in out


@pytest.mark.unit
def test_main_prefers_a_real_failure_over_an_undetermined_run(
    monkeypatch, stub_watch_loop, capsys
):
    """One run unreadable, another observed failing — report the failure."""
    runs = [
        _run(30184323661, "in_progress", "", "CI"),
        _run(30184323662, "in_progress", "", "E2E"),
    ]
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(runs=runs, rollup=[_gate("", status="IN_PROGRESS")])
    )

    def fake_watch(run_id, name, _stop, failures, undetermined):
        if name == "CI":
            undetermined.append((name, RATE_LIMIT_403))
        else:
            failures.append(run_id)

    monkeypatch.setattr(pr_watch, "watch_run", fake_watch)

    assert pr_watch.main() == 1
    out = capsys.readouterr().out
    assert "1 failure(s) detected" in out
    assert "failure-30184323662.md" in out


# ---------------------------------------------------------------------------
# run_audit — a cancelled gate is "not ready", but not described as a failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_run_audit_reports_cancelled_gate_as_superseded(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("CANCELLED")]))
    assert pr_watch.run_audit(PR) is False
    assert "cancelled (superseded)" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# review_state — three states, pinned to the marker (PP-4ric)
# ---------------------------------------------------------------------------
#
# Copilot is retired, so there is no reviewer to poll and no request to wait on.
# The only observable fact is the SHA-pinned marker. Kept in lockstep with the
# bash implementation in _pr-gates.sh (see scripts/tests/test_pr_gates.py).

GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"


@pytest.mark.unit
def test_marker_prefix_is_identical_to_the_bash_gate():
    """pr-watch and _pr-gates.sh must recognise exactly the same marker.

    A prefix changed in one and not the other makes the readiness report and the
    merge gate disagree about whether a PR has been reviewed — worse than either
    answer alone, because whichever one you happen to read looks authoritative.
    """
    gates = GATES_PATH.read_text()
    match = re.search(r'^readonly CLAUDE_MARKER_PREFIX="(.+)"$', gates, re.M)
    assert match, "CLAUDE_MARKER_PREFIX not found in _pr-gates.sh"
    assert match.group(1) == pr_watch.CLAUDE_MARKER_PREFIX


@pytest.mark.unit
@pytest.mark.parametrize(
    "state",
    ["marker", "commented", "stale_marker", "stale_comments", "unreviewed"],
)
def test_state_vocabulary_is_shared_with_the_bash_gate(state):
    """Both implementations name the same five states, so reports are comparable.

    Pinned against the `case` arms of `check_review_happened` rather than the
    assignments — the bash computes RS_STATE in one step from `_review_verdict`,
    so the arms are the only place each name is spelled out.
    """
    arms = re.findall(r"^    (\w+)\)$", GATES_PATH.read_text(), re.M)
    assert state in arms, arms


@pytest.mark.unit
def test_review_state_unreviewed(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(issue_comments=()))
    state, detail = pr_watch.review_state(PR)
    assert state == "unreviewed"
    assert "/code-review" in detail
    assert "mark-claude-review.sh" in detail


@pytest.mark.unit
def test_review_state_marker_pins_head(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(issue_comments=[marker_comment()]))
    state, detail = pr_watch.review_state(PR)
    assert state == "marker"
    assert HEAD_SHA[:7] in detail


@pytest.mark.unit
def test_review_state_stale_marker(monkeypatch):
    """Reviewed, then pushed past — the state a bare yes/no would call "reviewed"."""
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(issue_comments=[marker_comment(OLD_SHA)])
    )
    state, detail = pr_watch.review_state(PR)
    assert state == "stale_marker"
    assert OLD_SHA[:7] in detail
    assert HEAD_SHA[:7] in detail
    assert "/code-review" in detail


@pytest.mark.unit
@pytest.mark.parametrize(
    "order",
    [
        pytest.param([OLD_SHA, HEAD_SHA], id="attestation-is-newest"),
        pytest.param([HEAD_SHA, OLD_SHA], id="attestation-is-oldest"),
    ],
)
def test_review_state_accepts_any_marker_pinning_head(monkeypatch, order):
    """Parity with `_marker_verdict` in the bash: membership, not "the newest".

    Duplicate markers are a stray, but if one lands, a reader that inspects only
    one comment can disagree with mark-claude-review.sh about which is canonical
    and report a reviewed head as stale forever.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(issue_comments=[marker_comment(sha) for sha in order]),
    )
    state, _detail = pr_watch.review_state(PR)
    assert state == "marker"


@pytest.mark.unit
def test_review_state_ignores_a_comment_that_merely_quotes_the_marker(monkeypatch):
    """The lookup anchors on the START of the body, so a quote attests nothing."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            issue_comments=[
                {"body": f"maybe post `<!-- pinpoint-claude-review: {HEAD_SHA} -->`?"}
            ]
        ),
    )
    assert pr_watch.review_state(PR)[0] == "unreviewed"


@pytest.mark.unit
def test_review_state_takes_the_newest_marker(monkeypatch):
    """One sticky comment is rewritten in place; a stray duplicate loses to the later."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(issue_comments=[marker_comment(OLD_SHA), marker_comment(HEAD_SHA)]),
    )
    assert pr_watch.review_state(PR)[0] == "marker"


@pytest.mark.unit
def test_review_state_comments_pinning_head(monkeypatch):
    """The second evidence kind (PP-97tt), mirroring the bash `commented` state."""
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(review_comments=[review_comment(HEAD_SHA)])
    )
    state, detail = pr_watch.review_state(PR)
    assert state == "commented"
    assert HEAD_SHA[:7] in detail


@pytest.mark.unit
def test_review_state_reads_original_commit_id_not_commit_id(monkeypatch):
    """The false-green guard, pinned in the mirror as well as the gate.

    `review_comment` sets `commit_id` to something that is not the reviewed SHA
    precisely so an implementation reading the wrong field fails here rather than
    reporting a commit nobody read as reviewed.
    """
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(review_comments=[review_comment(OLD_SHA)])
    )
    assert pr_watch.review_state(PR)[0] == "stale_comments"


@pytest.mark.unit
def test_review_state_ignores_replies(monkeypatch):
    """A reply is written at whatever head is current.

    Counting one would let an agent re-attest by answering the thread it just
    fixed — the exact accident the SHA pin exists to prevent.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(review_comments=[review_comment(HEAD_SHA, in_reply_to=90210)]),
    )
    assert pr_watch.review_state(PR)[0] == "unreviewed"


@pytest.mark.unit
def test_review_state_prefers_the_marker_over_review_comments(monkeypatch):
    """Fixed precedence, matching the bash. See `_review_record`."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            issue_comments=[marker_comment(HEAD_SHA)],
            review_comments=[review_comment(OLD_SHA)],
        ),
    )
    assert pr_watch.review_state(PR)[0] == "marker"


# ---------------------------------------------------------------------------
# run_audit — the review state is reported, but does not gate readiness
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "state,comments",
    [
        ("unreviewed", ()),
        ("stale_marker", (marker_comment(OLD_SHA),)),
        ("marker", (marker_comment(),)),
    ],
)
def test_run_audit_reports_the_review_state_without_gating_on_it(
    monkeypatch, capsys, state, comments
):
    """--check-ready answers "is this worth Tim's /code-review?".

    The review is what happens AFTER that answer is yes, so gating on it would be
    circular and permanently red. merge-pr.sh's `reviewed` gate is the one that
    refuses to merge an unreviewed head; this line is a report, not a verdict.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(rollup=[_gate("SUCCESS")], issue_comments=comments),
    )
    assert pr_watch.run_audit(PR) is True
    assert f"✓ review: {state}:" in capsys.readouterr().out


@pytest.mark.unit
def test_run_audit_still_fails_on_unresolved_threads(monkeypatch, capsys):
    """Threads DO gate readiness — and are now counted regardless of author."""
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
