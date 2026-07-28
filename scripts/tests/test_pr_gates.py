"""Unit tests for the currency and reviewed gates in scripts/workflow/_pr-gates.sh.

These two gates decide whether a PR may merge, so their edge cases are worth pinning
down. The regression under test (PP-jw0s): Copilot posts a *review object* even when
it reviewed nothing — quota exhaustion, or no analyzable files — and a login-only
filter counted that as a review, so both gates could go green on a review that read
nothing. That is strictly worse than no review, because no-review has an honest path
(the SHA-pinned Claude marker).

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

# check_copilot_currency / check_review_happened both hold for 600s after a head push
# before escalating. Ages either side of that boundary select the WAIT vs terminal path.
FRESH_HEAD_AGE = 60
STALE_HEAD_AGE = 1200


def _iso(epoch: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch))


@contextmanager
def gate_env(
    *,
    reviews: list[dict],
    comments: list[dict],
    head_age_seconds: int,
    head_sha: str = HEAD_SHA,
) -> Iterator[dict]:
    """Yield an env dict wiring a fake `gh` that answers every call the gates make.

    The stub dispatches on the joined argument string rather than parsing flags — it
    only needs to distinguish the five shapes `_pr-gates.sh` actually issues.
    """
    now = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "reviews.json").write_text(json.dumps(reviews))
        (tmp_path / "comments.json").write_text(json.dumps(comments))

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"--jq .headRefOid"*) printf "%s\\n" "$STUB_HEAD_SHA" ;;\n'
            '  *"--json headRefOid"*) printf \'{"headRefOid":"%s"}\\n\' "$STUB_HEAD_SHA" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"/commits/"*) printf "%s\\n" "$STUB_HEAD_DATE" ;;\n'
            '  *"/issues/"*"/comments") cat "$STUB_COMMENTS" ;;\n'
            '  *"/pulls/"*"/reviews") cat "$STUB_REVIEWS" ;;\n'
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
        yield env


def run_gate(fn: str, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", "-c", f'source "{GATES_PATH}"; {fn} 123'],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def copilot_review(body: str, age_seconds: int) -> dict:
    return {
        "user": {"login": "copilot-pull-request-reviewer[bot]"},
        "submitted_at": _iso(time.time() - age_seconds),
        "body": body,
    }


def claude_marker(sha: str) -> dict:
    return {"body": f"<!-- pinpoint-claude-review: {sha} -->\nClaude review of head"}


# --- The PP-jw0s regression: a non-review must not count as a review ----------------


@pytest.mark.parametrize("body", [QUOTA_BODY, NO_FILES_BODY])
def test_non_review_does_not_satisfy_reviewed_gate(body: str) -> None:
    """A Copilot 'I could not review this' comment must fail the hard backstop.

    Before the fix this returned PASS: the review object carried a Copilot login and a
    submitted_at newer than the head, satisfying a login-only filter.
    """
    with gate_env(
        reviews=[copilot_review(body, age_seconds=0)],
        comments=[],
        head_age_seconds=STALE_HEAD_AGE,
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed:" in result.stdout
    assert "mark-claude-review.sh" in result.stdout, "remedy must be printed"


@pytest.mark.parametrize("body", [QUOTA_BODY, NO_FILES_BODY])
def test_non_review_is_invisible_to_currency_gate(body: str) -> None:
    """Currency must treat a non-review as absent, not as something to be stale about.

    Counting it produced the inverted incentive: a PR Copilot never touched skipped
    instantly, while one carrying a useless comment served the full 600s wait.
    """
    with gate_env(
        reviews=[copilot_review(body, age_seconds=0)],
        comments=[],
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "SKIP: currency: no substantive Copilot review" in result.stdout


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
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: Copilot review covers head commit" in result.stdout


def test_non_review_alongside_real_review_keeps_the_real_one() -> None:
    """Filtering must drop only the non-review, not every review on the PR."""
    with gate_env(
        reviews=[
            copilot_review("Found a null deref on line 12.", age_seconds=10),
            copilot_review(QUOTA_BODY, age_seconds=0),
        ],
        comments=[],
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: Copilot review covers head commit" in result.stdout


# --- The Claude marker is honoured by both gates, not just `reviewed` ---------------


def test_claude_marker_satisfies_currency_gate() -> None:
    """A marker pinned to head answers currency's question directly.

    Before the fix currency ignored the marker entirely and sat out its full timer
    waiting on a reviewer that already had a documented substitute.
    """
    with gate_env(
        reviews=[copilot_review("Old but real review.", age_seconds=9999)],
        comments=[claude_marker(HEAD_SHA)],
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: currency: Claude review covers head commit" in result.stdout


def test_claude_marker_satisfies_reviewed_gate() -> None:
    with gate_env(
        reviews=[],
        comments=[claude_marker(HEAD_SHA)],
        head_age_seconds=STALE_HEAD_AGE,
    ) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: Claude review covers head commit" in result.stdout


@pytest.mark.parametrize("gate", ["check_copilot_currency", "check_review_happened"])
def test_marker_for_a_different_sha_is_ignored(gate: str) -> None:
    """The SHA pin is what makes the attestation self-expiring after a new push."""
    with gate_env(
        reviews=[],
        comments=[claude_marker(OTHER_SHA)],
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate(gate, env)

    assert "Claude review covers head commit" not in result.stdout


# --- Unchanged behaviour that the refactor must not have broken --------------------


def test_stale_real_review_waits_inside_the_window() -> None:
    with gate_env(
        reviews=[copilot_review("Real review of the previous head.", age_seconds=9999)],
        comments=[],
        head_age_seconds=FRESH_HEAD_AGE,
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 2, result.stdout
    assert "WAIT: currency:" in result.stdout


def test_stale_real_review_warns_and_proceeds_past_the_window() -> None:
    """Currency never hard-fails — past the threshold it degrades to WARN."""
    with gate_env(
        reviews=[copilot_review("Real review of the previous head.", age_seconds=9999)],
        comments=[],
        head_age_seconds=STALE_HEAD_AGE,
    ) as env:
        result = run_gate("check_copilot_currency", env)

    assert result.returncode == 0, result.stdout
    assert "WARN: currency:" in result.stdout


def test_no_review_at_all_waits_inside_the_window() -> None:
    with gate_env(reviews=[], comments=[], head_age_seconds=FRESH_HEAD_AGE) as env:
        result = run_gate("check_review_happened", env)

    assert result.returncode == 2, result.stdout
    assert "WAIT: reviewed:" in result.stdout
