"""Regression tests for the pinned-head PR watcher.

A watch performs one exact-head GitHub query per interval and ends in exactly
one verdict: a moved head is stale, DIRTY/CONFLICTING is conflicting, and an
UNKNOWN merge state is not a conflict. Cancellation is supersession rather than
failure, while an API outage is undetermined rather than a fabricated red
result. Detailed run logs are fetched only after the aggregate gate has
conclusively failed. (PP-r63o, PP-qkl8)

Review state: `--check-ready` and `--phase review` report the merge gate's label
(approved / changes requested / stale review / not reviewed) without owning the
logic — `review_summary` shells out to `_review_summary` in `_pr-gates.sh`, so a
stale approval cannot be flattened into "approved" by a Python copy that drifted.

Everything is mocked at the `gh` CLI seam (`pr_watch.gh`) and the gate seam
(`pr_watch.review_summary`) — these tests never reach GitHub (CORE-TEST-006).
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
) -> dict:
    return {
        "name": pr_watch.CI_GATE_NAME,
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


def fake_summary(
    label="not reviewed",
    *,
    head=HEAD_SHA,
    checker="codex",
    form="approval",
    unresolved=0,
    pending=False,
    stale_sha=OLD_SHA,
):
    """A `_review_summary` document, as the bash gate emits it.

    Only the fields the watcher reads are modelled: label, coverage (present exactly
    when the label is "approved"), checkers, codex_request_pending, unresolved_threads.
    """

    def record(verdict, sha):
        return {
            "checker": checker,
            "verdict": verdict,
            "form": form if verdict == "covers" else "",
            "sha": sha,
            "reviewer": "",
            "detail": "",
            "at": "2026-08-22T12:00:00Z",
            "summary": "",
        }

    none = {name: record("none", "") for name in ("coderabbit", "codex", "marker")}
    checkers = dict(none)
    if label == "approved":
        checkers[checker] = record("covers", head)
    elif label == "stale review":
        checkers[checker] = record("stale", stale_sha)
    elif label == "changes requested" and unresolved == 0:
        checkers[checker] = record("changes_requested", head)
    return {
        "head": head,
        "label": label,
        "coverage": checkers[checker] if label == "approved" else None,
        "checkers": checkers,
        "codex_request_pending": pending,
        "unresolved_threads": unresolved,
    }


def use_summaries(monkeypatch, *summaries):
    """Answer successive `review_summary` calls; the last one repeats."""
    queue = list(summaries)

    def fake_review_summary(_pr, *, timeout=None):
        del timeout
        if len(queue) > 1:
            return queue.pop(0)
        return queue[0]

    monkeypatch.setattr(pr_watch, "review_summary", fake_review_summary)


def make_gh(
    *,
    rollup=(),
    merge_state="CLEAN",
    threads=(),
    labels=(),
):
    """Build a fake `gh` that answers every call pr-watch makes.

    Records each invocation on `.calls` so tests can assert what was queried.

    Review evidence is not modelled here: the watcher reads it from the bash gate
    (`review_summary`), which tests replace with `use_summaries`.
    """

    def fake_gh(*args: str) -> str:
        fake_gh.calls.append(args)
        if args[:2] == ("pr", "view"):
            fields = args[4]
            if fields == "headRefOid,statusCheckRollup,mergeStateStatus":
                return json.dumps(
                    {
                        "headRefOid": HEAD_SHA,
                        "statusCheckRollup": list(rollup),
                        "mergeStateStatus": merge_state,
                    }
                )
            if fields == "headRefOid,mergeStateStatus":
                return json.dumps(
                    {
                        "headRefOid": HEAD_SHA,
                        "mergeStateStatus": merge_state,
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
        raise AssertionError(f"unexpected gh call: {args}")

    fake_gh.calls = []
    return fake_gh


def snapshot_gh(snapshots, merge_state="CLEAN"):
    """Return CI snapshots in sequence (the last repeats); record every call."""
    remaining = list(snapshots)

    def fake_gh(*args: str) -> str:
        fake_gh.calls.append(args)
        assert args[:2] == ("pr", "view"), args
        assert args[4] == "headRefOid,statusCheckRollup,mergeStateStatus", args
        snapshot = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        return json.dumps({**snapshot, "mergeStateStatus": merge_state})

    fake_gh.calls = []
    return fake_gh


def ci_snapshot(head=HEAD_SHA, gate=None):
    return {
        "headRefOid": head,
        "statusCheckRollup": [] if gate is None else [gate],
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
# Review phase — exact-head coverage and threads
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_watch_phase_review_passes_when_approved_and_zero_threads(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(monkeypatch, fake_summary("approved"))

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "passed"
    assert verdict.observed_head == HEAD_SHA
    assert verdict.review_state == "approved"
    assert verdict.unresolved_threads == 0


@pytest.mark.unit
def test_watch_phase_review_rejects_evidence_for_another_head(monkeypatch):
    """An approval the gate computed for a different commit must not pass."""
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(monkeypatch, fake_summary("approved", head=OLD_SHA))

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "stale"


@pytest.mark.unit
def test_watch_phase_review_action_required_when_threads_unresolved(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(monkeypatch, fake_summary("approved", unresolved=1))

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "action_required"
    assert verdict.unresolved_threads == 1


@pytest.mark.unit
def test_watch_phase_review_revalidates_evidence_before_passing(monkeypatch):
    # The first read says approved with zero threads; the terminal re-read sees a
    # thread opened in between. The re-read wins.
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(
        monkeypatch,
        fake_summary("approved"),
        fake_summary("approved", unresolved=1),
    )

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "action_required"
    assert verdict.unresolved_threads == 1


@pytest.mark.unit
def test_watch_phase_review_action_required_on_changes_requested(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(monkeypatch, fake_summary("changes requested", checker="coderabbit"))

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "action_required"
    assert verdict.review_state == "changes requested"
    assert "CodeRabbit: requested changes" in capsys.readouterr().err


@pytest.mark.unit
def test_watch_phase_review_undetermined_when_the_gate_fails(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh())

    def broken(_pr, *, timeout=None):
        del timeout
        raise RuntimeError("_review_summary failed (exit 1): boom")

    monkeypatch.setattr(pr_watch, "review_summary", broken)

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "undetermined"
    assert "boom" in capsys.readouterr().err


@pytest.mark.unit
def test_watch_phase_review_bounds_the_gate_call_by_the_remaining_deadline(
    monkeypatch,
):
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    seen: list[float | None] = []

    def fake_review_summary(_pr, *, timeout=None):
        seen.append(timeout)
        return fake_summary("approved")

    monkeypatch.setattr(pr_watch, "review_summary", fake_review_summary)
    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=30, poll_sec=0)
    assert verdict.outcome == "passed"
    assert seen and all(t is not None and 0 < t <= 30 for t in seen)


@pytest.mark.unit
def test_watch_phase_review_timeout_preserves_last_observed_state(monkeypatch):
    monkeypatch.setattr(
        pr_watch,
        "_current_head_merge_snapshot",
        lambda _pr: (HEAD_SHA, "CLEAN"),
    )
    use_summaries(monkeypatch, fake_summary("stale review"))
    # deadline, loop check, the gate-call timeout budget, then the expiring loop check
    monotonic_values = iter([0.0, 0.0, 0.0, 1.0])
    monkeypatch.setattr(pr_watch.time, "monotonic", lambda: next(monotonic_values))
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=0.5, poll_sec=0)
    assert verdict.outcome == "timed_out"
    assert verdict.review_state == "stale review"
    assert verdict.merge_state == "CLEAN"


@pytest.mark.unit
def test_watch_phase_review_keeps_stale_review_pending_until_head_is_covered(
    monkeypatch, capsys
):
    monkeypatch.setattr(pr_watch, "gh", make_gh())
    use_summaries(
        monkeypatch,
        fake_summary("stale review"),
        fake_summary("approved"),
        fake_summary("approved"),
    )
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "passed"
    assert f"Review pending on {HEAD_SHA[:7]}: stale review" in (
        capsys.readouterr().err
    )


@pytest.mark.unit
def test_watch_phase_review_exits_stale_when_head_moves(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh())

    # PR head in fake_gh is HEAD_SHA, but the watch is pinned to OLD_SHA
    verdict = pr_watch._watch_phase_review(PR, OLD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "stale"
    assert verdict.observed_head == HEAD_SHA


@pytest.mark.unit
def test_watch_phase_review_exits_conflicting_on_conflict(monkeypatch):
    monkeypatch.setattr(pr_watch, "gh", make_gh(merge_state="CONFLICTING"))

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "conflicting"
    assert verdict.merge_state == "CONFLICTING"


@pytest.mark.unit
def test_watch_phase_review_treats_unknown_merge_state_as_not_conflicting(
    monkeypatch,
):
    monkeypatch.setattr(pr_watch, "gh", make_gh(merge_state="UNKNOWN"))
    use_summaries(monkeypatch, fake_summary("approved"))
    no_sleep(monkeypatch)

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "passed"


@pytest.mark.unit
def test_watch_phase_review_exits_stale_if_head_moves_before_terminal_verdict(
    monkeypatch,
):
    base = make_gh()
    use_summaries(monkeypatch, fake_summary("approved"))
    observed_heads = [HEAD_SHA, OLD_SHA]

    def moving_head_gh(*args: str) -> str:
        if args[:2] == ("pr", "view") and args[4] == "headRefOid,mergeStateStatus":
            return json.dumps(
                {
                    "headRefOid": observed_heads.pop(0),
                    "mergeStateStatus": "CLEAN",
                }
            )
        return base(*args)

    monkeypatch.setattr(pr_watch, "gh", moving_head_gh)

    verdict = pr_watch._watch_phase_review(PR, HEAD_SHA, timeout_sec=10, poll_sec=0)
    assert verdict.outcome == "stale"
    assert verdict.observed_head == OLD_SHA


# ---------------------------------------------------------------------------
# main — argument contract, one JSON verdict on stdout, exit codes
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_parse_args_watch_and_check_ready():
    args = pr_watch._parse_args(["1734", "--phase", "ci", "--expected-head", HEAD_SHA])
    assert (args.pr, args.phase, args.expected_head) == (1734, "ci", HEAD_SHA)
    assert args.check_ready is False

    args = pr_watch._parse_args(
        ["1734", "--phase=review", f"--expected-head={HEAD_SHA}"]
    )
    assert (args.phase, args.expected_head) == ("review", HEAD_SHA)

    args = pr_watch._parse_args(["--check-ready", "1734"])
    assert (args.pr, args.check_ready) == (1734, True)


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
        ["1734", "--check-ready", "--phase", "ci"],
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
        "schema_version": 1,
        "repository": "timothyfroehlich/PinPoint",
        "pr": PR,
        "phase": "ci",
        "expected_head": HEAD_SHA,
        "observed_head": HEAD_SHA,
        "outcome": "passed",
        "ci_gate": "SUCCESS",
        "review_state": "not reviewed",
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
        ("action_required", 1),
        ("timed_out", 2),
        ("undetermined", 2),
    ],
)
def test_main_exit_code_follows_the_outcome(monkeypatch, capsys, outcome, code):
    monkeypatch.setattr(
        pr_watch,
        "_watch_phase_review",
        lambda _pr, _head: pr_watch.Verdict(outcome),
    )

    exit_code = pr_watch.main(
        ["1734", "--phase", "review", "--expected-head", HEAD_SHA]
    )

    assert exit_code == code
    assert json.loads(capsys.readouterr().out)["outcome"] == outcome


# ---------------------------------------------------------------------------
# run_audit — a cancelled gate is "not ready", but not described as a failure
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_run_audit_reports_cancelled_gate_as_superseded(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("CANCELLED")]))
    use_summaries(monkeypatch, fake_summary())
    assert pr_watch.run_audit(PR) is False
    assert "cancelled (superseded)" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# review_summary / review_state — read from the bash gate, never mirrored
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_review_summary_shells_out_to_the_gate(monkeypatch, tmp_path):
    gate = tmp_path / "_pr-gates.sh"
    gate.write_text(
        '_review_summary() { echo "{\\"label\\": \\"approved\\", \\"pr\\": $1}"; }\n'
    )
    monkeypatch.setattr(pr_watch, "GATES_SCRIPT", gate)
    assert pr_watch.review_summary(PR) == {"label": "approved", "pr": PR}


@pytest.mark.unit
def test_review_summary_raises_when_the_gate_fails_or_returns_junk(
    monkeypatch, tmp_path
):
    gate = tmp_path / "_pr-gates.sh"
    gate.write_text("_review_summary() { echo boom >&2; return 1; }\n")
    monkeypatch.setattr(pr_watch, "GATES_SCRIPT", gate)
    with pytest.raises(RuntimeError, match="boom"):
        pr_watch.review_summary(PR)

    gate.write_text("_review_summary() { echo '[1, 2]'; }\n")
    with pytest.raises(RuntimeError, match="malformed"):
        pr_watch.review_summary(PR)


@pytest.mark.unit
def test_review_summary_timeout_is_a_runtime_error(monkeypatch, tmp_path):
    gate = tmp_path / "_pr-gates.sh"
    gate.write_text("_review_summary() { sleep 5; echo '{}'; }\n")
    monkeypatch.setattr(pr_watch, "GATES_SCRIPT", gate)
    with pytest.raises(RuntimeError, match="timed out"):
        pr_watch.review_summary(PR, timeout=0.2)


@pytest.mark.unit
@pytest.mark.parametrize("label", pr_watch.REVIEW_LABELS)
def test_review_state_reports_the_gate_label_verbatim(monkeypatch, label):
    use_summaries(monkeypatch, fake_summary(label))
    state, _detail = pr_watch.review_state(PR)
    assert state == label


@pytest.mark.unit
@pytest.mark.parametrize(
    "checker,who",
    [
        ("coderabbit", "CodeRabbit approval"),
        ("codex", "Codex evidence"),
        ("marker", "local review attestation"),
    ],
)
def test_review_state_names_the_covering_checker(monkeypatch, checker, who):
    use_summaries(monkeypatch, fake_summary("approved", checker=checker))
    state, detail = pr_watch.review_state(PR)
    assert state == "approved"
    assert detail == f"{who} covers head {HEAD_SHA[:7]}"


@pytest.mark.unit
def test_review_state_not_reviewed_recommends_one_request(monkeypatch):
    use_summaries(monkeypatch, fake_summary("not reviewed"))
    state, detail = pr_watch.review_state(PR)
    assert state == "not reviewed"
    assert "CodeRabbit: none; Codex: none; local attestation: none" in detail
    assert f"request-codex-review.sh #{PR} exactly once" in detail
    assert "CodeRabbit request or a local review" in detail


@pytest.mark.unit
def test_review_state_pending_request_is_not_recommended_again(monkeypatch):
    use_summaries(monkeypatch, fake_summary("not reviewed", pending=True))
    state, detail = pr_watch.review_state(PR)
    assert state == "not reviewed"
    assert "already requested" in detail
    assert "do not request the same head again" in detail
    assert "request-codex-review.sh" not in detail


@pytest.mark.unit
def test_review_state_stale_review_names_both_commits(monkeypatch):
    use_summaries(monkeypatch, fake_summary("stale review", checker="coderabbit"))
    state, detail = pr_watch.review_state(PR)
    assert state == "stale review"
    assert (
        f"CodeRabbit: newest evidence names {OLD_SHA[:7]}, head is {HEAD_SHA[:7]}"
        in detail
    )


@pytest.mark.unit
def test_review_state_changes_requested_names_the_reviewer(monkeypatch):
    use_summaries(monkeypatch, fake_summary("changes requested", checker="coderabbit"))
    state, detail = pr_watch.review_state(PR)
    assert state == "changes requested"
    assert f"CodeRabbit: requested changes on head {HEAD_SHA[:7]}" in detail


# ---------------------------------------------------------------------------
# run_audit — the review state is reported, but does not gate readiness
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "summary",
    [
        fake_summary("not reviewed"),
        fake_summary("stale review"),
        fake_summary("approved"),
        fake_summary("approved", checker="marker", form="marker"),
    ],
)
def test_run_audit_reports_the_review_state_without_gating_on_it(
    monkeypatch, capsys, summary
):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("SUCCESS")]))
    use_summaries(monkeypatch, summary)
    assert pr_watch.run_audit(PR) is True
    assert f"✓ review: {summary['label']}:" in capsys.readouterr().out


@pytest.mark.unit
def test_run_audit_survives_a_gate_failure(monkeypatch, capsys):
    monkeypatch.setattr(pr_watch, "gh", make_gh(rollup=[_gate("SUCCESS")]))

    def broken(_pr):
        raise RuntimeError("gate exploded")

    monkeypatch.setattr(pr_watch, "review_summary", broken)
    assert pr_watch.run_audit(PR) is True
    assert "✓ review: unknown: could not determine (gate exploded)" in (
        capsys.readouterr().out
    )


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
    use_summaries(monkeypatch, fake_summary())
    assert pr_watch.run_audit(PR) is False
    assert "✗ threads-resolved: 1 unresolved" in capsys.readouterr().out
