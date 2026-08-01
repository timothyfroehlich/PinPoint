"""Unit tests for the currency and reviewed gates in scripts/workflow/_pr-gates.sh.

These two gates decide whether a PR may merge, so their edge cases are worth pinning
down. Two regressions are covered.

PP-jw0s: Copilot posts a *review object* even when it reviewed nothing — quota
exhaustion, or no analyzable files — and a login-only filter counted that as a review,
so both gates could go green on a review that read nothing. That is strictly worse than
no review, because no-review has an honest path (the SHA-pinned Claude marker).

PP-lzaw: Copilot review is request-only on this repo since 2026-08-01. The gates used to
measure their 600s window from the HEAD PUSH, which only made sense when Copilot arrived
unprompted — under request-only that timer counts down against a review nobody asked
for, and every un-re-requested PR lands on the `reviewed` FAIL whose remedy is the Claude
marker, making the fallback the default path. The gates now key to the review REQUEST and
report six distinct states. Coverage is judged by `commit_id` rather than by comparing
submitted_at against the head commit date, which read "covers head" for a review of an
earlier tree submitted after a later push (observed on PR #1784).

Every test drives the real bash through a stubbed `gh`, so the jq filters and the
BSD/GNU date branching are exercised rather than mocked away.
"""

import json
import os
import stat
import subprocess
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"

QUOTA_BODY = (
    "Copilot was unable to review this pull request because the user who "
    "requested the review has reached their quota limit."
)
NO_FILES_BODY = "Copilot wasn't able to review any files in this pull request."

HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
OTHER_SHA = "0000000000000000000000000000000000000000"

# Both gates hold for 600s after a review REQUEST before escalating. Ages either side of
# that boundary select the WAIT vs terminal path.
FRESH = 60
STALE = 1200

# Deliberately older than STALE. Paired with a fresh request it proves the timer is keyed
# to the request and no longer to the push: under the old behaviour a head this old with
# no review was an immediate `reviewed` FAIL.
ANCIENT = 4000


def _iso(epoch: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch))


@contextmanager
def gate_env(
    *,
    reviews: list[dict],
    comments: list[dict],
    head_age_seconds: int,
    request_ages: list[int] | None = None,
    head_sha: str = HEAD_SHA,
) -> Iterator[dict]:
    """Yield an env dict wiring a fake `gh` that answers every call the gates make.

    The stub dispatches on the joined argument string rather than parsing flags — it
    only needs to distinguish the six shapes `_pr-gates.sh` actually issues.

    `request_ages` is a list of "seconds ago" for Copilot `review_requested` timeline
    events. `None` means the PR has none at all — which does not occur in practice while
    the repo's PR-open auto-request is enabled, but is the state the gates must report
    distinctly the moment it is switched off.
    """
    now = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "reviews.json").write_text(json.dumps(reviews))
        (tmp_path / "comments.json").write_text(json.dumps(comments))
        (tmp_path / "timeline.json").write_text(
            json.dumps(
                [
                    {
                        "event": "review_requested",
                        "created_at": _iso(now - age),
                        "actor": {"login": "timothyfroehlich"},
                        "requested_reviewer": {"login": "Copilot"},
                    }
                    for age in (request_ages or [])
                ]
                # A human reviewer request must not be mistaken for a Copilot one.
                + [
                    {
                        "event": "review_requested",
                        "created_at": _iso(now),
                        "actor": {"login": "timothyfroehlich"},
                        "requested_reviewer": {"login": "some-human"},
                    }
                ]
            )
        )

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"--jq .headRefOid"*) printf "%s\\n" "$STUB_HEAD_SHA" ;;\n'
            '  *"--json headRefOid"*) printf \'{"headRefOid":"%s"}\\n\' "$STUB_HEAD_SHA" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"/commits/"*) printf "%s\\n" "$STUB_HEAD_DATE" ;;\n'
            '  *"/issues/"*"/timeline"*) cat "$STUB_TIMELINE" ;;\n'
            '  *"/issues/"*"/comments"*) cat "$STUB_COMMENTS" ;;\n'
            '  *"/pulls/"*"/reviews"*) cat "$STUB_REVIEWS" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        env = dict(os.environ)
        env["PATH"] = f"{tmp}{os.pathsep}{env.get('PATH', '')}"
        env["STUB_HEAD_SHA"] = head_sha
        env["STUB_HEAD_DATE"] = _iso(now - head_age_seconds)
        env["STUB_REVIEWS"] = str(tmp_path / "reviews.json")
        env["STUB_COMMENTS"] = str(tmp_path / "comments.json")
        env["STUB_TIMELINE"] = str(tmp_path / "timeline.json")
        yield env


def run_gate(fn: str, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", "-c", f'source "{GATES_PATH}"; {fn} 123'],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def copilot_review(body: str, age_seconds: int, commit_id: str = HEAD_SHA) -> dict:
    return {
        "user": {"login": "copilot-pull-request-reviewer[bot]"},
        "submitted_at": _iso(time.time() - age_seconds),
        "commit_id": commit_id,
        "body": body,
    }


def claude_marker(sha: str) -> dict:
    return {"body": f"<!-- pinpoint-claude-review: {sha} -->\nClaude review of head"}


BOTH_GATES = ["check_copilot_currency", "check_review_happened"]
REQUEST_CMD = 'gh pr edit 123 --add-reviewer "@copilot"'


# --- The merge bar is UNCHANGED: an unreviewed head cannot pass `reviewed` ----------


@pytest.mark.parametrize(
    "state,reviews,head_age,request_ages",
    [
        ("never_requested", [], FRESH, None),
        ("pushed_after", [], FRESH, [STALE]),
        ("overdue", [], ANCIENT, [STALE]),
        # A review exists but read a DIFFERENT commit — the PR #1784 false PASS.
        (
            "stale review",
            [copilot_review("Real review.", age_seconds=0, commit_id=OTHER_SHA)],
            ANCIENT,
            [STALE],
        ),
        # A review carrying head's SHA that reviewed nothing (PP-jw0s).
        (
            "non-review at head",
            [copilot_review(QUOTA_BODY, age_seconds=0, commit_id=HEAD_SHA)],
            ANCIENT,
            [STALE],
        ),
    ],
)
def test_unreviewed_head_never_passes_the_reviewed_gate(
    state: str, reviews: list[dict], head_age: int, request_ages: list[int] | None
) -> None:
    """The hard backstop stays hard. Re-keying the timer must not open a merge path.

    Every state in which no reviewer has demonstrably read the head commit has to be
    non-zero out of `check_review_happened` — that exit code is what blocks merge-pr.sh.
    """
    with gate_env(
        reviews=reviews,
        comments=[],
        head_age_seconds=head_age,
        request_ages=request_ages,
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode != 0, f"{state}: {result.stdout}"
    assert "PASS:" not in result.stdout, f"{state}: {result.stdout}"


# --- never_requested: distinct, and no timer is waited out --------------------------


def test_never_requested_fails_reviewed_immediately() -> None:
    """A fresh head with no request must NOT sit in WAIT.

    Nothing is coming — no push, no label and no green CI fires a review — so waiting
    only delays the moment a human notices. The old head-push timer would have WAITed
    here for 600s first.
    """
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=None
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed: no Copilot review has ever been requested" in result.stdout
    assert REQUEST_CMD in result.stdout


def test_never_requested_does_not_recommend_the_claude_marker() -> None:
    """The marker is the fallback for an UNANSWERED request, not for an unasked one.

    Offering it here is exactly how the marker becomes the default path and the gate
    stops guaranteeing anything.
    """
    with gate_env(
        reviews=[], comments=[], head_age_seconds=ANCIENT, request_ages=None
    ) as env:
        result = run_gate("check_review_happened", env)

    assert "mark-claude-review.sh" not in result.stdout, result.stdout


def test_never_requested_warns_on_currency_without_blocking() -> None:
    """`currency` is soft by contract — it reports, `reviewed` blocks."""
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=None
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "WARN: currency: no Copilot review has ever been requested" in result.stdout
    assert REQUEST_CMD in result.stdout


# --- pushed_after: flagged loudly, never silently re-requested ----------------------


def test_push_after_request_fails_reviewed_and_says_re_request() -> None:
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=[STALE]
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 1, result.stdout
    assert "NEWER than the last review request" in result.stdout
    assert REQUEST_CMD in result.stdout
    # Auto-re-requesting a 3-commit fixup would spend 3 reviews — the exact behaviour
    # request-only Copilot exists to stop. The gate tells you; it never asks for you.
    assert "mark-claude-review.sh" not in result.stdout


def test_push_after_request_is_reported_distinctly_from_never_requested() -> None:
    """Collapsing the two into one 'not reviewed yet' is the failure mode to avoid."""
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=[STALE]
    ) as env:
        pushed_after = run_gate("check_review_happened", env).stdout
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=None
    ) as env:
        never = run_gate("check_review_happened", env).stdout

    assert "has ever been requested" in never
    assert "has ever been requested" not in pushed_after


def test_push_after_request_warns_on_currency_without_blocking() -> None:
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=[STALE]
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "WARN: currency:" in result.stdout
    assert "you pushed after requesting" in result.stdout


# --- awaiting / overdue: the timer runs from the REQUEST ----------------------------


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_fresh_request_waits_even_when_the_head_is_ancient(gate: str) -> None:
    """The re-keying, stated as a test.

    Head pushed 4000s ago, review requested 60s ago. Under the old head-push timer this
    was an immediate `reviewed` FAIL; the request is what makes waiting legitimate.
    """
    with gate_env(
        reviews=[], comments=[], head_age_seconds=ANCIENT, request_ages=[FRESH]
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 2, result.stdout
    assert "WAIT:" in result.stdout
    assert "review requested" in result.stdout


def test_overdue_request_fails_reviewed_and_offers_both_remedies() -> None:
    """Asked and unanswered is the ONE state where the Claude marker is the right call."""
    with gate_env(
        reviews=[], comments=[], head_age_seconds=ANCIENT, request_ages=[STALE]
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed: review requested" in result.stdout
    assert REQUEST_CMD in result.stdout
    assert "mark-claude-review.sh" in result.stdout


def test_overdue_request_warns_on_currency_without_blocking() -> None:
    with gate_env(
        reviews=[], comments=[], head_age_seconds=ANCIENT, request_ages=[STALE]
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "WARN: currency: review requested" in result.stdout


def test_the_newest_request_wins() -> None:
    """A stale first request must not hold the PR in `overdue` after a fresh re-request."""
    with gate_env(
        reviews=[],
        comments=[],
        head_age_seconds=ANCIENT,
        request_ages=[STALE, FRESH],
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 2, result.stdout
    assert "WAIT: reviewed:" in result.stdout


def test_a_human_review_request_is_not_a_copilot_request() -> None:
    """Only `requested_reviewer.login` starting with "copilot" starts the clock.

    The gate_env stub always injects a request for a human reviewer; if that were
    counted, this PR would read as `awaiting` instead of `never_requested`.
    """
    with gate_env(
        reviews=[], comments=[], head_age_seconds=FRESH, request_ages=None
    ) as env:
        result = run_gate("check_review_happened", env)

    assert "has ever been requested" in result.stdout


# --- Coverage is judged by commit_id, not by timestamp ------------------------------


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_review_carrying_the_head_sha_passes(gate: str) -> None:
    with gate_env(
        reviews=[copilot_review("Found a null deref on line 12.", age_seconds=10)],
        comments=[],
        head_age_seconds=STALE,
        request_ages=[STALE],
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 0, result.stdout
    assert "carries head SHA" in result.stdout


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_newer_review_of_an_earlier_commit_does_not_cover_head(gate: str) -> None:
    """The PR #1784 false PASS: submitted_at is newer than head, commit_id is not head.

    A review submitted after a later push can still have read the earlier tree — GitHub
    stamps it with the commit it actually analysed. Comparing timestamps read that as
    "covers head"; comparing SHAs does not. The request here is newer than the head, so
    the honest answer is WAIT, not PASS.
    """
    with gate_env(
        reviews=[
            copilot_review(
                "Reviewed the previous head.", age_seconds=0, commit_id=OTHER_SHA
            )
        ],
        comments=[],
        head_age_seconds=STALE,
        request_ages=[FRESH],
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 2, result.stdout
    assert "PASS:" not in result.stdout


# --- PP-jw0s: a non-review must not count as a review -------------------------------


@pytest.mark.parametrize("body", [QUOTA_BODY, NO_FILES_BODY])
def test_non_review_at_head_does_not_satisfy_reviewed_gate(body: str) -> None:
    """A Copilot "I could not review this" comment must fail the hard backstop.

    It now carries head's own commit_id, so only the body filter can catch it.
    """
    with gate_env(
        reviews=[copilot_review(body, age_seconds=0)],
        comments=[],
        head_age_seconds=ANCIENT,
        request_ages=[STALE],
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed:" in result.stdout
    assert "mark-claude-review.sh" in result.stdout, "remedy must be printed"


@pytest.mark.parametrize("body", [QUOTA_BODY, NO_FILES_BODY])
def test_non_review_is_invisible_to_currency_gate(body: str) -> None:
    """Currency must treat a non-review as absent, not as coverage."""
    with gate_env(
        reviews=[copilot_review(body, age_seconds=0)],
        comments=[],
        head_age_seconds=STALE,
        request_ages=[FRESH],
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 2, result.stdout
    assert "WAIT: currency:" in result.stdout


def test_a_partial_review_is_not_mistaken_for_a_non_review() -> None:
    """Copilot's real reviews say what they could NOT get to — that must still count.

    Matching the bare words "unable to review" would discard this, pushing `reviewed`
    toward a FAIL that only --force or a marker clears — training exactly the
    click-through reflex the gate exists to prevent. The patterns are deliberately
    scoped to whole-PR phrasings instead.
    """
    body = (
        "Copilot reviewed 3 out of 5 changed files. It was unable to review "
        "2 generated files. Comments: line 12 dereferences a possibly-null value."
    )
    with gate_env(
        reviews=[copilot_review(body, age_seconds=10)],
        comments=[],
        head_age_seconds=STALE,
        request_ages=[STALE],
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: Copilot review carries head SHA" in result.stdout


def test_non_review_alongside_real_review_keeps_the_real_one() -> None:
    """Filtering must drop only the non-review, not every review on the PR."""
    with gate_env(
        reviews=[
            copilot_review("Found a null deref on line 12.", age_seconds=10),
            copilot_review(QUOTA_BODY, age_seconds=0),
        ],
        comments=[],
        head_age_seconds=STALE,
        request_ages=[STALE],
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: Copilot review carries head SHA" in result.stdout


# --- The Claude marker: honoured by both gates, but never silently ------------------


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_claude_marker_satisfies_both_gates(gate: str) -> None:
    """The merge bar is unchanged — a marker pinned to head is still a valid review."""
    with gate_env(
        reviews=[],
        comments=[claude_marker(HEAD_SHA)],
        head_age_seconds=ANCIENT,
        request_ages=[STALE],
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 0, result.stdout
    assert "Claude review marker covers head commit" in result.stdout


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_marker_standing_in_for_an_unasked_review_says_so(gate: str) -> None:
    """ "Do not let a Claude marker SILENTLY stand in" — it passes, but it announces."""
    with gate_env(
        reviews=[],
        comments=[claude_marker(HEAD_SHA)],
        head_age_seconds=FRESH,
        request_ages=None,
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 0, result.stdout
    assert "no Copilot review was requested for this head" in result.stdout
    assert REQUEST_CMD in result.stdout


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_marker_backed_by_a_current_request_needs_no_note(gate: str) -> None:
    with gate_env(
        reviews=[],
        comments=[claude_marker(HEAD_SHA)],
        head_age_seconds=STALE,
        request_ages=[FRESH],
    ) as env:
        result = run_gate(gate, env)

    assert result.returncode == 0, result.stdout
    assert "no Copilot review was requested" not in result.stdout


@pytest.mark.parametrize("gate", BOTH_GATES)
def test_marker_for_a_different_sha_is_ignored(gate: str) -> None:
    """The SHA pin is what makes the attestation self-expiring after a new push."""
    with gate_env(
        reviews=[],
        comments=[claude_marker(OTHER_SHA)],
        head_age_seconds=FRESH,
        request_ages=[FRESH],
    ) as env:
        result = run_gate(gate, env)

    assert "Claude review marker covers head commit" not in result.stdout
