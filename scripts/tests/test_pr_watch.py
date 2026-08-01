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

Review-request state (PP-lzaw): Copilot review is fully request-only on this
repo as of 2026-08-01 — nothing asks on your behalf, so every PR opens with no
request at all — and `--check-ready` has to say WHICH review state a PR is in.
"Nobody asked", "asked and waiting" and "you pushed past the request" need three
different actions and only the middle one resolves by waiting; flattening them
into one "not reviewed yet" turns a forgotten request into a silent overnight
stall.

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


def copilot_review(commit_id=HEAD_SHA, body="Copilot reviewed 3 of 3 files."):
    return {
        "user": {"login": "copilot-pull-request-reviewer[bot]"},
        "commit_id": commit_id,
        "submitted_at": _ago(0),
        "body": body,
    }


def make_gh(
    *,
    rollup=(),
    runs=(),
    merge_state="CLEAN",
    threads=(),
    labels=(),
    head_age=60,
    request_ages=(0,),
    reviews=(),
    issue_comments=(),
    request_pending=False,
):
    """Build a fake `gh` that answers every call pr-watch makes.

    Records each invocation on `.calls` so tests can assert what was queried.

    The review-state args mirror `copilot_review_state`'s inputs. Defaults put the
    PR in `awaiting` — a request 0s old against a 60s-old head, with no review yet
    — which is a passing readiness state, so tests that don't care about the
    review gate stay unaffected by it.
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
            if fields == "headRefOid,reviewRequests":
                return json.dumps(
                    {
                        "headRefOid": HEAD_SHA,
                        "reviewRequests": [{"__typename": "User", "login": "Copilot"}]
                        if request_pending
                        else [],
                    }
                )
        if args[0] == "api" and args[1].endswith(f"/commits/{HEAD_SHA}"):
            return _ago(head_age)
        if args[:2] == ("api", "--paginate"):
            path = args[2]
            if "/timeline" in path:
                return json.dumps(
                    [
                        {
                            "event": "review_requested",
                            "created_at": _ago(age),
                            "requested_reviewer": {"login": "Copilot"},
                        }
                        for age in request_ages
                    ]
                )
            if "/comments" in path:
                return json.dumps(list(issue_comments))
            if "/reviews" in path:
                return json.dumps(list(reviews))
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
    """A stop request (watch_reviews saw a new Copilot review) ends the retries."""
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

    watch_reviews sets `stop` when a new Copilot review lands, which can happen
    while a retry is in flight. Reporting "could not determine" then would be
    noise about a watch we deliberately ended.
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
# copilot_review_state — the six states, keyed to the REQUEST (PP-lzaw)
# ---------------------------------------------------------------------------
#
# Copilot review is request-only on this repo. The states that matter are the
# ones a bare "not reviewed yet" would flatten: "nobody asked", "asked and
# waiting", and "you pushed past the request" need three different actions, and
# only the middle one resolves by waiting. Kept in lockstep with the bash
# implementation in _pr-gates.sh (see scripts/tests/test_pr_gates.py).

FRESH = 60
STALE = 1200
ANCIENT = 4000

_MARKER = f"<!-- pinpoint-claude-review: {HEAD_SHA} -->\nreviewed by hand"
REQUEST_CMD = f'gh pr edit {PR} --add-reviewer "@copilot"'


GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"


@pytest.mark.unit
def test_non_review_pattern_is_identical_to_the_bash_gate():
    """pr-watch and _pr-gates.sh must eat exactly the same non-review bodies.

    A wording added to one and not the other makes the readiness report and the
    merge gate disagree about whether a PR has been reviewed — worse than either
    answer alone, because whichever one you happen to read looks authoritative.
    """
    gates = GATES_PATH.read_text()
    match = re.search(r"^readonly COPILOT_NON_REVIEW_BODY_RE='(.+)'$", gates, re.M)
    assert match, "COPILOT_NON_REVIEW_BODY_RE not found in _pr-gates.sh"
    assert match.group(1) == pr_watch.COPILOT_NON_REVIEW_BODY_RE.pattern


@pytest.mark.unit
def test_wait_threshold_is_identical_to_the_bash_gate():
    gates = GATES_PATH.read_text()
    match = re.search(r"^readonly COPILOT_REVIEW_WAIT_THRESHOLD=(\d+)$", gates, re.M)
    assert match, "COPILOT_REVIEW_WAIT_THRESHOLD not found in _pr-gates.sh"
    assert int(match.group(1)) == pr_watch.COPILOT_REVIEW_WAIT_THRESHOLD


@pytest.mark.unit
@pytest.mark.parametrize(
    "state",
    ["marker", "covered", "awaiting", "overdue", "pushed_after", "never_requested"],
)
def test_state_vocabulary_is_shared_with_the_bash_gate(state):
    """Both implementations name the same six states, so reports are comparable."""
    assert f"RS_STATE={state}" in GATES_PATH.read_text()


@pytest.mark.unit
def test_review_state_never_requested(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(head_age=FRESH, request_ages=()))
    state, detail = pr_watch.copilot_review_state(PR)
    assert state == "never_requested"
    assert REQUEST_CMD in detail


@pytest.mark.unit
def test_review_state_pushed_after_request(monkeypatch):
    """Head newer than the newest request — nothing re-requests automatically."""
    monkeypatch.setattr(pr_watch, "gh", make_gh(head_age=FRESH, request_ages=(STALE,)))
    state, detail = pr_watch.copilot_review_state(PR)
    assert state == "pushed_after"
    assert "NEWER than the last request" in detail
    assert REQUEST_CMD in detail


@pytest.mark.unit
def test_review_state_pushed_after_flags_a_lagging_timeline(monkeypatch):
    """A pending Copilot reviewer alongside `pushed_after` means "re-run".

    GitHub's issue timeline lags a freshly-created review_requested event by up
    to a minute; `reviewRequests` updates immediately. Still `pushed_after`, not
    `awaiting`: Copilot reviews the head as of the REQUEST, so a genuinely stale
    pending request produces a review of the wrong tree.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(head_age=FRESH, request_ages=(STALE,), request_pending=True),
    )
    state, detail = pr_watch.copilot_review_state(PR)
    assert state == "pushed_after"
    assert "pending reviewer right now" in detail


@pytest.mark.unit
def test_review_state_awaiting_survives_an_ancient_head(monkeypatch):
    """The timer runs from the request, so an old head with a fresh ask still waits."""
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(head_age=ANCIENT, request_ages=(FRESH,))
    )
    assert pr_watch.copilot_review_state(PR)[0] == "awaiting"


@pytest.mark.unit
def test_review_state_overdue(monkeypatch):
    monkeypatch.setattr(
        pr_watch, "gh", make_gh(head_age=ANCIENT, request_ages=(STALE,))
    )
    state, detail = pr_watch.copilot_review_state(PR)
    assert state == "overdue"
    assert "mark-claude-review.sh" in detail


@pytest.mark.unit
def test_review_state_covered_is_judged_by_commit_id(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(head_age=STALE, request_ages=(STALE,), reviews=[copilot_review()]),
    )
    assert pr_watch.copilot_review_state(PR)[0] == "covered"


@pytest.mark.unit
def test_review_state_ignores_a_newer_review_of_an_earlier_commit(monkeypatch):
    """The PR #1784 false PASS: submitted_at is newer than head, commit_id is not.

    Comparing timestamps read this as "covers head"; comparing SHAs does not.
    """
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            head_age=STALE,
            request_ages=(FRESH,),
            reviews=[copilot_review(commit_id=OLD_SHA)],
        ),
    )
    assert pr_watch.copilot_review_state(PR)[0] == "awaiting"


@pytest.mark.unit
def test_review_state_ignores_a_non_review_at_head(monkeypatch):
    """A quota-limited "I could not review this" carries head's SHA but read nothing."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            head_age=STALE,
            request_ages=(FRESH,),
            reviews=[
                copilot_review(
                    body=(
                        "Copilot was unable to review this pull request because "
                        "the user who requested the review has reached their "
                        "quota limit."
                    )
                )
            ],
        ),
    )
    assert pr_watch.copilot_review_state(PR)[0] == "awaiting"


@pytest.mark.unit
def test_review_state_counts_a_partial_review(monkeypatch):
    """A real review that merely mentions files it could not analyse still counts."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            head_age=STALE,
            request_ages=(STALE,),
            reviews=[
                copilot_review(
                    body=(
                        "Copilot reviewed 3 out of 5 changed files. It was unable "
                        "to review 2 generated files."
                    )
                )
            ],
        ),
    )
    assert pr_watch.copilot_review_state(PR)[0] == "covered"


@pytest.mark.unit
def test_review_state_marker_without_a_request_says_it_is_standing_in(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(head_age=FRESH, request_ages=(), issue_comments=[{"body": _MARKER}]),
    )
    state, detail = pr_watch.copilot_review_state(PR)
    assert state == "marker"
    assert "standing in" in detail


@pytest.mark.unit
def test_review_state_ignores_a_marker_for_another_sha(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(
            head_age=FRESH,
            request_ages=(FRESH,),
            issue_comments=[{"body": f"<!-- pinpoint-claude-review: {OLD_SHA} -->"}],
        ),
    )
    assert pr_watch.copilot_review_state(PR)[0] == "awaiting"


# ---------------------------------------------------------------------------
# run_audit — the review state is reported distinctly, and gates readiness
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "state,kwargs",
    [
        ("never_requested", {"head_age": FRESH, "request_ages": ()}),
        ("pushed_after", {"head_age": FRESH, "request_ages": (STALE,)}),
        ("overdue", {"head_age": ANCIENT, "request_ages": (STALE,)}),
    ],
)
def test_run_audit_is_not_ready_without_a_live_review_path(
    monkeypatch, capsys, state, kwargs
):
    """A forgotten request must be UNMISTAKABLE, not a silent overnight stall."""
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("SUCCESS")], **kwargs))
    assert pr_watch.run_audit(PR) is False
    assert f"✗ copilot-review: {state}:" in capsys.readouterr().out


@pytest.mark.unit
def test_run_audit_passes_while_a_request_is_outstanding(monkeypatch, capsys):
    """`awaiting` is not a failure — the ask is live and the answer is coming."""
    monkeypatch.setattr(
        pr_watch,
        "gh",
        make_gh(rollup=[_gate("SUCCESS")], head_age=ANCIENT, request_ages=(FRESH,)),
    )
    assert pr_watch.run_audit(PR) is True
    assert "✓ copilot-review: awaiting:" in capsys.readouterr().out
