"""Regression tests for the pinned-head PR watcher.

A watch performs one exact-head GitHub query per interval and ends in exactly
one verdict: a moved head is stale, DIRTY/CONFLICTING is conflicting, and an
UNKNOWN merge state is not a conflict. Cancellation is supersession rather than
failure, while an API outage is undetermined rather than a fabricated red
result. Detailed run logs are fetched only after the aggregate gate has
conclusively failed. (PP-r63o, PP-qkl8)

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
    details_url: str = "",
    name: str = pr_watch.CI_GATE_NAME,
    workflow_name: str = "CI",
) -> dict:
    return {
        "name": name,
        "workflowName": workflow_name,
        "status": status,
        "conclusion": conclusion,
        "completedAt": completed_at,
        "startedAt": completed_at if started_at is None else started_at,
        "detailsUrl": details_url,
    }


def _run(
    run_id: int,
    status: str,
    conclusion: str,
    sha=HEAD_SHA,
    workflow_name="CI",
) -> dict:
    return {
        "databaseId": run_id,
        "status": status,
        "conclusion": conclusion,
        "headSha": sha,
        "workflowName": workflow_name,
    }


def snapshot_gh(snapshots, merge_state="CLEAN", resolved=()):
    """Return CI snapshots in sequence (the last repeats); record every call.

    The review-thread query a passed watch makes answers with `resolved`, one
    isResolved flag per thread, and is kept out of `calls`.
    """
    remaining = list(snapshots)

    def fake_gh(*args: str) -> str:
        if args[:2] == ("api", "graphql"):
            fake_gh.thread_queries += 1
            threads = {
                "pageInfo": {"hasNextPage": False},
                "nodes": [{"isResolved": r} for r in resolved],
            }
            return json.dumps(
                {"data": {"repository": {"pullRequest": {"reviewThreads": threads}}}}
            )
        fake_gh.calls.append(args)
        assert args[:2] == ("pr", "view"), args
        assert args[4] == "headRefOid,statusCheckRollup,mergeStateStatus,isDraft", args
        snapshot = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        return json.dumps({**snapshot, "mergeStateStatus": merge_state})

    fake_gh.calls = []
    fake_gh.thread_queries = 0
    return fake_gh


def _review(conclusion: str, status: str = "COMPLETED", **kwargs) -> dict:
    return _gate(
        conclusion,
        status=status,
        name=pr_watch.CLAUDE_REVIEW_NAME,
        workflow_name=pr_watch.CLAUDE_REVIEW_NAME,
        **kwargs,
    )


# Most watch tests are about CI Gate, so the default snapshot carries a passed
# Claude Review; the review tests pass their own.
REVIEW_PASSED = _review("SUCCESS")


def ci_snapshot(head=HEAD_SHA, gate=None, review=REVIEW_PASSED, draft=False):
    return {
        "headRefOid": head,
        "isDraft": draft,
        "statusCheckRollup": [c for c in (gate, review) if c is not None],
    }


def no_sleep(monkeypatch):
    monkeypatch.setattr(pr_watch.time, "sleep", lambda _seconds: None)


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
# _select_ci_gate — superseded leftovers don't shadow the live gate
# ---------------------------------------------------------------------------


def _selected(rollup) -> tuple[str, str]:
    """(status, conclusion) of the gate the watch would act on, or ("", "")."""
    gate = pr_watch._select_ci_gate(rollup)
    return ("", "") if gate is None else (gate["status"], gate["conclusion"])


@pytest.mark.unit
def test_select_ci_gate_prefers_live_gate_over_cancelled_leftover():
    """A re-run leaves a cancelled CI Gate check next to the live one."""
    rollup = [
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
        _gate("", status="IN_PROGRESS", completed_at="2026-07-24T23:30:00Z"),
    ]
    assert _selected(rollup) == ("IN_PROGRESS", "")


@pytest.mark.unit
def test_select_ci_gate_prefers_replacement_that_started_after_late_cancellation():
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
    assert _selected(rollup) == ("COMPLETED", "SUCCESS")


@pytest.mark.unit
def test_select_ci_gate_reports_newer_cancellation_over_older_failure():
    """The latest rerun is authoritative even when both outcomes are non-green."""
    rollup = [
        _gate("FAILURE", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    assert _selected(rollup) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_select_ci_gate_does_not_expose_older_green_after_cancellation():
    rollup = [
        _gate("SUCCESS", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    assert _selected(rollup) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_select_ci_gate_reports_cancelled_when_every_gate_is_superseded():
    rollup = [
        _gate("CANCELLED", completed_at="2026-07-24T20:00:00Z"),
        _gate("CANCELLED", completed_at="2026-07-24T23:26:45Z"),
    ]
    assert _selected(rollup) == ("COMPLETED", "CANCELLED")


@pytest.mark.unit
def test_select_ci_gate_absent():
    assert _selected([]) == ("", "")


# ---------------------------------------------------------------------------
# CI phase — one exact-head query per interval, pinned to expected_head
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_watch_phase_ci_polls_one_snapshot_per_interval(monkeypatch):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.observed_head == HEAD_SHA
    assert verdict.ci_gate == "SUCCESS"
    assert len(fake.calls) == 2


@pytest.mark.unit
def test_watch_phase_ci_emits_unchanged_pending_state_only_once(monkeypatch, capsys):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("", status="IN_PROGRESS")),
            ci_snapshot(gate=_gate("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    captured = capsys.readouterr()
    assert captured.err.count("CI Gate in_progress") == 1
    assert captured.out == ""


@pytest.mark.unit
def test_watch_phase_ci_fetches_failure_artifact_only_after_red(monkeypatch, capsys):
    fake = snapshot_gh(
        [
            ci_snapshot(
                gate=_gate(
                    "FAILURE",
                    details_url="https://github.com/o/r/actions/runs/555/job/999",
                )
            )
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda run_id: f"tmp/gh-monitor/failure-{run_id}.md",
    )

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "failed"
    assert verdict.ci_gate == "FAILURE"
    assert verdict.failure_artifact == "tmp/gh-monitor/failure-555.md"
    assert "CI Gate failed" in capsys.readouterr().err
    assert len(fake.calls) == 1


@pytest.mark.unit
def test_watch_phase_ci_waits_for_claude_review_after_ci_gate_passes(
    monkeypatch, capsys
):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("SUCCESS"), review=None),
            ci_snapshot(gate=_gate("SUCCESS"), review=_review("", "IN_PROGRESS")),
            ci_snapshot(gate=_gate("SUCCESS"), review=_review("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.claude_review == "SUCCESS"
    assert len(fake.calls) == 3
    err = capsys.readouterr().err
    assert "Claude Review not yet posted" in err
    assert "Claude Review in_progress" in err


@pytest.mark.unit
def test_watch_phase_ci_red_claude_review_ends_watch_before_ci(monkeypatch):
    review_url = "https://github.com/o/r/actions/runs/777/job/1"
    fake = snapshot_gh(
        [
            ci_snapshot(
                gate=_gate("", status="IN_PROGRESS"),
                review=_review("FAILURE", details_url=review_url),
            )
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda run_id: f"tmp/gh-monitor/failure-{run_id}.md",
    )

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "failed"
    assert verdict.claude_review == "FAILURE"
    assert verdict.detail_url == review_url
    assert verdict.failure_artifact == "tmp/gh-monitor/failure-777.md"


@pytest.mark.unit
def test_watch_phase_ci_passed_verdict_counts_unresolved_threads(monkeypatch, capsys):
    fake = snapshot_gh(
        [ci_snapshot(gate=_gate("SUCCESS"))], resolved=(True, False, False)
    )
    monkeypatch.setattr(pr_watch, "gh", fake)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.unresolved_threads == 2
    assert fake.thread_queries == 1
    assert "2 unresolved review thread(s)" in capsys.readouterr().err


@pytest.mark.unit
def test_watch_phase_ci_thread_count_outage_leaves_it_unknown(monkeypatch):
    fake = snapshot_gh([ci_snapshot(gate=_gate("SUCCESS"))])

    def flaky_gh(*args: str) -> str:
        if args[:2] == ("api", "graphql"):
            raise RuntimeError("HTTP 502")
        return fake(*args)

    monkeypatch.setattr(pr_watch, "gh", flaky_gh)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.unresolved_threads is None


@pytest.mark.unit
def test_watch_phase_ci_ready_pr_waits_past_a_draft_skipped_review(monkeypatch):
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("SUCCESS"), review=_review("SKIPPED")),
            ci_snapshot(gate=_gate("SUCCESS"), review=_review("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.claude_review == "SUCCESS"
    assert len(fake.calls) == 2


@pytest.mark.unit
def test_watch_phase_ci_draft_needs_only_ci_gate(monkeypatch):
    fake = snapshot_gh([ci_snapshot(gate=_gate("SUCCESS"), review=None, draft=True)])
    monkeypatch.setattr(pr_watch, "gh", fake)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.claude_review == "SKIPPED_DRAFT"


@pytest.mark.unit
def test_watch_phase_ci_ignores_claude_review_name_from_another_workflow(monkeypatch):
    impostor = _gate("SUCCESS", name=pr_watch.CLAUDE_REVIEW_NAME, workflow_name="")
    fake = snapshot_gh(
        [
            ci_snapshot(gate=_gate("SUCCESS"), review=impostor),
            ci_snapshot(gate=_gate("SUCCESS"), review=_review("SUCCESS")),
        ]
    )
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "passed"
    assert len(fake.calls) == 2


@pytest.mark.unit
def test_watch_phase_ci_reports_abandoned_superseded_gate_as_undetermined(
    monkeypatch, capsys
):
    fake = snapshot_gh([ci_snapshot(gate=_gate("CANCELLED"))])
    monkeypatch.setattr(pr_watch, "gh", fake)
    monkeypatch.setattr(pr_watch, "SUPERSEDED_GATE_GRACE", 0)
    no_sleep(monkeypatch)
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda _run_id: pytest.fail("superseded gates have no failure artifact"),
    )

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)

    assert verdict.outcome == "undetermined"
    assert verdict.ci_gate == "CANCELLED"
    err = capsys.readouterr().err
    assert "superseded" in err
    assert "CI Gate failed" not in err


@pytest.mark.unit
def test_watch_phase_ci_exits_stale_when_head_moves(monkeypatch):
    fake = snapshot_gh([ci_snapshot(head=OLD_SHA, gate=_gate("SUCCESS"))])
    monkeypatch.setattr(pr_watch, "gh", fake)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "stale"
    assert verdict.observed_head == OLD_SHA


@pytest.mark.unit
@pytest.mark.parametrize("merge_state", ["DIRTY", "CONFLICTING"])
def test_watch_phase_ci_exits_conflicting_on_conflict(monkeypatch, merge_state):
    fake = snapshot_gh(
        [ci_snapshot(gate=_gate("", status="IN_PROGRESS"))],
        merge_state=merge_state,
    )
    monkeypatch.setattr(pr_watch, "gh", fake)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "conflicting"
    assert verdict.merge_state == merge_state


@pytest.mark.unit
def test_watch_phase_ci_treats_unknown_merge_state_as_not_conflicting(monkeypatch):
    """GitHub recomputes mergeability after every push to main; UNKNOWN is not an error."""
    fake = snapshot_gh([ci_snapshot(gate=_gate("SUCCESS"))], merge_state="UNKNOWN")
    monkeypatch.setattr(pr_watch, "gh", fake)
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "passed"


@pytest.mark.unit
def test_watch_phase_ci_timeout_is_not_a_failure(monkeypatch, capsys):
    monkeypatch.setattr(
        pr_watch,
        "gh",
        lambda *_args: pytest.fail("an already-expired watch must not query GitHub"),
    )

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=0, poll_sec=0)
    assert verdict.outcome == "timed_out"
    err = capsys.readouterr().err
    assert "no terminal verdict" in err
    assert "failed" not in err.lower()


@pytest.mark.unit
def test_watch_phase_ci_reports_api_outage_as_undetermined_without_retry(
    monkeypatch, capsys
):
    calls = []

    def unavailable(*args):
        calls.append(args)
        raise RuntimeError(RATE_LIMIT_403)

    monkeypatch.setattr(pr_watch, "gh", unavailable)

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "undetermined"
    assert len(calls) == 1
    err = capsys.readouterr().err
    assert RATE_LIMIT_403 in err
    assert "failed" not in err.lower()


@pytest.mark.unit
def test_watch_phase_ci_malformed_snapshot_is_undetermined(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", lambda *_args: "{")

    verdict = pr_watch._watch_phase_ci(PR, HEAD_SHA, timeout_sec=60, poll_sec=0)
    assert verdict.outcome == "undetermined"
    assert "unreachable" in capsys.readouterr().err


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
                _run(44, "completed", "failure", workflow_name="Legacy CI"),
            ]
        )

    monkeypatch.setattr(pr_watch, "gh", fake_gh)

    assert pr_watch._failed_ci_run_id(HEAD_SHA) == 43
    assert len(calls) == 1
    assert calls[0][:2] == ("run", "list")
    assert "--workflow" not in calls[0]


# ---------------------------------------------------------------------------
# main — argument contract, one JSON verdict on stdout, exit codes
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_parse_args_watch():
    args = pr_watch._parse_args(["1734", "--phase", "ci", "--expected-head", HEAD_SHA])
    assert (args.pr, args.phase, args.expected_head) == (1734, "ci", HEAD_SHA)

    args = pr_watch._parse_args(["1734", "--phase=ci", f"--expected-head={HEAD_SHA}"])
    assert (args.phase, args.expected_head) == ("ci", HEAD_SHA)


@pytest.mark.unit
@pytest.mark.parametrize(
    "argv",
    [
        ["1734"],
        ["1734", "--phase", "ci"],
        ["1734", "--expected-head", HEAD_SHA],
        ["1734", "--phase", "unknown", "--expected-head", HEAD_SHA],
        ["1734", "--phase", "ci", "--expected-head", HEAD_SHA[:10]],
        ["1734", "--phase", "ci", "--expected-head", HEAD_SHA.upper()],
        ["1734", "--phase", "review", "--expected-head", HEAD_SHA],
        ["--check-ready", "1734"],
        ["1734", "--check-ready", "--phase", "ci", "--expected-head", HEAD_SHA],
        ["1734", "--phase", "ci", "--expected-head", HEAD_SHA, "--force"],
        ["--phase", "ci", "--expected-head", HEAD_SHA],
    ],
)
def test_parse_args_rejects_usage_errors(argv, capsys):
    with pytest.raises(SystemExit) as exc_info:
        pr_watch._parse_args(argv)
    assert exc_info.value.code == 2
    assert capsys.readouterr().out == ""


@pytest.mark.unit
def test_main_prints_exactly_one_json_verdict_on_stdout(monkeypatch, capsys):
    monkeypatch.setattr(
        pr_watch, "gh", snapshot_gh([ci_snapshot(gate=_gate("SUCCESS"))])
    )

    exit_code = pr_watch.main(["1734", "--phase", "ci", "--expected-head", HEAD_SHA])

    assert exit_code == 0
    captured = capsys.readouterr()
    stdout_lines = captured.out.splitlines()
    assert len(stdout_lines) == 1, stdout_lines
    payload = json.loads(stdout_lines[0])
    assert payload == {
        "schema_version": 2,
        "repository": "timothyfroehlich/PinPoint",
        "pr": PR,
        "phase": "ci",
        "expected_head": HEAD_SHA,
        "observed_head": HEAD_SHA,
        "outcome": "passed",
        "ci_gate": "SUCCESS",
        "claude_review": "SUCCESS",
        "unresolved_threads": 0,
        "merge_state": "CLEAN",
        "detail_url": None,
        "failure_artifact": None,
        "timestamp": payload["timestamp"],
    }
    assert "CI Gate passed" in captured.err


@pytest.mark.unit
def test_main_reports_failure_artifact_as_an_absolute_path(monkeypatch, capsys):
    gate = _gate("FAILURE", details_url="https://github.com/o/r/actions/runs/42/job/1")
    monkeypatch.setattr(pr_watch, "gh", snapshot_gh([ci_snapshot(gate=gate)]))
    monkeypatch.setattr(
        pr_watch,
        "write_failure_artifact",
        lambda run_id: f"tmp/gh-monitor/failure-{run_id}.md",
    )

    exit_code = pr_watch.main(["1734", "--phase", "ci", "--expected-head", HEAD_SHA])

    assert exit_code == 1
    payload = json.loads(capsys.readouterr().out)
    assert payload["outcome"] == "failed"
    assert payload["failure_artifact"] == str(
        Path("tmp/gh-monitor/failure-42.md").resolve()
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    "outcome,code",
    [
        ("passed", 0),
        ("failed", 1),
        ("stale", 1),
        ("conflicting", 1),
        ("timed_out", 2),
        ("undetermined", 2),
    ],
)
def test_main_exit_code_follows_the_outcome(monkeypatch, capsys, outcome, code):
    monkeypatch.setattr(
        pr_watch,
        "_watch_phase_ci",
        lambda _pr, _head: pr_watch.Verdict(outcome),
    )

    exit_code = pr_watch.main(["1734", "--phase", "ci", "--expected-head", HEAD_SHA])

    assert exit_code == code
    assert json.loads(capsys.readouterr().out)["outcome"] == outcome
