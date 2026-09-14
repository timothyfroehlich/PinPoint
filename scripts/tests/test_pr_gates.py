"""Regression tests for the merge gate's three review checkers.

Gate 3 passes when ANY checker covers the exact head: CodeRabbit's native approval,
Codex's evidence (native approval, exact-head finding review, trusted clean comment,
or trusted reaction witness), or a local review attestation. `_review_summary` is the
one JSON document every consumer reads; its label is one of four words.
"""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"
CODEX_BOT = "chatgpt-codex-connector[bot]"
CODEX_APP = "chatgpt-codex-connector"
CODERABBIT_BOT = "coderabbitai[bot]"
GITHUB_ACTIONS_BOT = "github-actions[bot]"
GITHUB_ACTIONS_APP = "github-actions"
HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
OTHER_SHA = "0000000000000000000000000000000000000000"


def codex_review(
    *,
    sha: str | None = HEAD_SHA,
    state: str = "APPROVED",
    submitted_at: str = "2026-08-22T12:00:00Z",
    login: str = CODEX_BOT,
) -> dict:
    return {
        "user": {"login": login},
        "state": state,
        "commit_id": sha,
        "submitted_at": submitted_at,
        "body": "Codex review summary",
    }


def manual_marker(
    sha: str = HEAD_SHA,
    *,
    reviewer: str = "claude-code",
    detail: str = "medium",
    updated_at: str = "2026-08-22T12:00:00Z",
) -> dict:
    return {
        "body": (
            f"<!-- pinpoint-review: {sha} -->\n"
            f"<!-- pinpoint-reviewer: {reviewer} -->\n"
            f"<!-- pinpoint-review-detail: {detail} -->\nreviewed"
        ),
        "updated_at": updated_at,
    }


def clean_codex_comment(
    sha: str = HEAD_SHA[:10],
    *,
    login: str = CODEX_BOT,
    app: str = CODEX_APP,
    prefix: str = "Codex Review: Didn't find any major issues. Hooray!",
    updated_at: str = "2026-08-22T12:00:00Z",
) -> dict:
    return {
        "user": {"login": login},
        "performed_via_github_app": {"slug": app},
        "body": f"{prefix}\n\n**Reviewed commit:** `{sha}`",
        "created_at": updated_at,
        "updated_at": updated_at,
    }


def clean_codex_reaction_witness(
    sha: str = HEAD_SHA,
    *,
    login: str = GITHUB_ACTIONS_BOT,
    app: str = GITHUB_ACTIONS_APP,
    updated_at: str = "2026-08-22T12:02:00Z",
) -> dict:
    return {
        "user": {"login": login},
        "performed_via_github_app": {"slug": app},
        "body": f"<!-- pinpoint-codex-reaction-witness: {sha} -->\nwitnessed",
        "created_at": updated_at,
        "updated_at": updated_at,
    }


def manual_review_request(
    sha: str = HEAD_SHA,
    *,
    login: str = "acme",
    created_at: str = "2026-08-22T12:03:00Z",
) -> dict:
    return {
        "user": {"login": login},
        "body": f"@codex review\n<!-- pinpoint-codex-review-head: {sha} -->",
        "created_at": created_at,
    }


def legacy_claude_marker(sha: str = HEAD_SHA, detail: str = "high") -> dict:
    return {
        "body": (
            f"<!-- pinpoint-claude-review: {sha} -->\n"
            f"<!-- pinpoint-review-depth: {detail} -->\n"
            f"Claude review of head {sha[:7]} — `/code-review {detail}`"
        ),
        "updated_at": "2026-08-22T12:00:00Z",
    }


def claude_two_axis_review(
    sha: str | None = HEAD_SHA[:8],
    *,
    login: str = "acme",
    base: str = "origin/main",
    standards_findings: str = "No breaches of documented standards.",
    spec_findings: str = "Faithful to bead.",
    summary: str = "Standards: 0 hard, Spec: 0 findings.",
    updated_at: str = "2026-08-22T12:00:00Z",
    reviewer_sig: str = "—Claude",
) -> dict:
    if sha is not None:
        preamble = f"Reviewed `{base}...{sha}` across **Standards** and **Spec** in parallel sub-agents."
    else:
        preamble = f"Two-axis review against merge-base `{base}`. Docs-only."

    body = (
        f"## Code review — PR #123 (two-axis)\n\n"
        f"{preamble}\n\n"
        f"## Standards\n\n{standards_findings}\n\n"
        f"## Spec\n\n{spec_findings}\n\n"
        f"---\n\n"
        f"**Summary** — {summary}\n\n"
        f"{reviewer_sig}"
    )
    return {
        "user": {"login": login},
        "body": body,
        "created_at": updated_at,
        "updated_at": updated_at,
    }


def thread(*, resolved: bool, author: str) -> dict:
    return {
        "isResolved": resolved,
        "comments": {"nodes": [{"author": {"login": author}}]},
    }


@contextmanager
def gate_env(
    *,
    review_pages: list[list[dict]] | None = None,
    comment_pages: list[list[dict]] | None = None,
    threads: list[dict] | None = None,
    commits: list[dict] | None = None,
    head_sha: str = HEAD_SHA,
    rollup: list[dict] | None = None,
) -> Iterator[dict]:
    """Yield an environment whose gh executable serves paginated review records.

    `rollup` is the raw statusCheckRollup array; the stub runs the gate's real `--jq`
    filter over it with jq, so the authoritative-run selection is what gets tested.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "rollup.json").write_text(
            json.dumps({"statusCheckRollup": rollup or []})
        )
        (tmp_path / "reviews.json").write_text(
            "\n".join(json.dumps(page) for page in (review_pages or [[]]))
        )
        (tmp_path / "comments.json").write_text(
            "\n".join(json.dumps(page) for page in (comment_pages or [[]]))
        )
        (tmp_path / "commits.json").write_text(json.dumps(commits or []))
        (tmp_path / "threads.json").write_text(
            json.dumps(
                {
                    "data": {
                        "repository": {
                            "pullRequest": {
                                "reviewThreads": {
                                    "pageInfo": {
                                        "hasNextPage": False,
                                        "endCursor": None,
                                    },
                                    "nodes": threads or [],
                                }
                            }
                        }
                    }
                }
            )
        )
        calls_path = tmp_path / "calls"
        calls_path.touch()

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'printf "%s\\n" "$args" >> "$STUB_CALLS"\n'
            'case "$args" in\n'
            '  *"--jq .headRefOid"*) printf "%s\\n" "$STUB_HEAD_SHA" ;;\n'
            '  *"--json statusCheckRollup --jq"*) jq -r "${@: -1}" < "$STUB_ROLLUP" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"api graphql"*) cat "$STUB_THREADS" ;;\n'
            '  *"/pulls/"*"/reviews"*) cat "$STUB_REVIEWS" ;;\n'
            '  *"/issues/"*"/comments"*) cat "$STUB_COMMENTS" ;;\n'
            '  *"commits"*) cat "$STUB_COMMITS" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        env = dict(os.environ)
        env["PATH"] = f"{tmp}{os.pathsep}{env.get('PATH', '')}"
        env["STUB_HEAD_SHA"] = head_sha
        env["STUB_REVIEWS"] = str(tmp_path / "reviews.json")
        env["STUB_COMMENTS"] = str(tmp_path / "comments.json")
        env["STUB_COMMITS"] = str(tmp_path / "commits.json")
        env["STUB_THREADS"] = str(tmp_path / "threads.json")
        env["STUB_ROLLUP"] = str(tmp_path / "rollup.json")
        env["STUB_CALLS"] = str(calls_path)
        yield env


def run_gate(fn: str, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", "-c", f'source "{GATES_PATH}"; {fn} 123'],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def review_summary(env: dict) -> dict:
    """`_review_summary 123` as a dict — the document every consumer reads."""
    result = subprocess.run(
        [
            "bash",
            "-c",
            f'set -euo pipefail; source "{GATES_PATH}"; _review_summary 123',
        ],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def verdicts(summary: dict) -> dict[str, str]:
    return {name: record["verdict"] for name, record in summary["checkers"].items()}


# ---------------------------------------------------------------------------------
# Gate 3 passes when any checker covers head
# ---------------------------------------------------------------------------------


def test_codex_approval_of_head_passes() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"PASS: reviewed: Codex approved head SHA {HEAD_SHA[:7]}" in result.stdout
    assert summary["label"] == "approved"
    assert summary["coverage"]["checker"] == "codex"
    assert summary["coverage"]["form"] == "approval"


def test_coderabbit_approval_of_head_passes() -> None:
    with gate_env(review_pages=[[codex_review(login=CODERABBIT_BOT)]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"CodeRabbit approved head SHA {HEAD_SHA[:7]}" in result.stdout
    assert summary["coverage"]["checker"] == "coderabbit"
    assert summary["coverage"]["reviewer"] == CODERABBIT_BOT


def test_clean_codex_comment_of_head_passes() -> None:
    with gate_env(comment_pages=[[clean_codex_comment()]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"Codex found no major issues on head SHA {HEAD_SHA[:7]}" in result.stdout
    assert summary["coverage"]["form"] == "clean_comment"
    assert summary["coverage"]["detail"] == "NO_FINDINGS"


def test_clean_codex_comment_accepts_full_head_sha() -> None:
    with gate_env(comment_pages=[[clean_codex_comment(HEAD_SHA)]]) as env:
        summary = review_summary(env)
    assert summary["label"] == "approved"
    assert summary["coverage"]["sha"] == HEAD_SHA


def test_clean_codex_reaction_witness_pins_current_head() -> None:
    with gate_env(comment_pages=[[clean_codex_reaction_witness()]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert "trusted workflow witnessed Codex clean reaction" in result.stdout
    assert summary["coverage"]["form"] == "clean_reaction"
    assert summary["coverage"]["reviewer"] == GITHUB_ACTIONS_BOT


def test_current_head_finding_review_passes_and_defers_to_the_thread_gate() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T12:00:00Z"),
        codex_review(state="CHANGES_REQUESTED", submitted_at="2026-08-22T12:01:00Z"),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert "thread gate owns findings" in result.stdout
    assert summary["coverage"]["form"] == "reviewed"


def test_manual_attestation_of_head_passes() -> None:
    with gate_env(comment_pages=[[manual_marker()]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"review marker pins head SHA {HEAD_SHA[:7]}" in result.stdout
    assert summary["coverage"]["checker"] == "marker"
    assert (summary["coverage"]["reviewer"], summary["coverage"]["detail"]) == (
        "claude-code",
        "medium",
    )


@pytest.mark.parametrize("order", [[OTHER_SHA, HEAD_SHA], [HEAD_SHA, OTHER_SHA]])
def test_any_manual_marker_pinning_head_passes(order: list[str]) -> None:
    with gate_env(comment_pages=[[manual_marker(sha) for sha in order]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


# ---------------------------------------------------------------------------------
# Checkers are independent: one reviewer's verdict never masks another's
# ---------------------------------------------------------------------------------


def test_manual_attestation_covers_despite_codex_changes_requested() -> None:
    with gate_env(
        review_pages=[[codex_review(state="CHANGES_REQUESTED")]],
        comment_pages=[[manual_marker()]],
    ) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert "review marker pins head SHA" in result.stdout


def test_coderabbit_approval_covers_despite_stale_codex_approval() -> None:
    reviews = [
        codex_review(sha=OTHER_SHA, submitted_at="2026-08-22T11:00:00Z"),
        codex_review(login=CODERABBIT_BOT, submitted_at="2026-08-22T12:00:00Z"),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"CodeRabbit approved head SHA {HEAD_SHA[:7]}" in result.stdout
    assert verdicts(summary) == {
        "coderabbit": "covers",
        "codex": "stale",
        "marker": "none",
    }


def test_coderabbit_changes_requested_does_not_mask_codex_approval() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T11:00:00Z"),
        codex_review(
            login=CODERABBIT_BOT,
            state="CHANGES_REQUESTED",
            submitted_at="2026-08-22T12:00:00Z",
        ),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert f"Codex approved head SHA {HEAD_SHA[:7]}" in result.stdout
    assert summary["label"] == "approved"
    assert verdicts(summary)["coderabbit"] == "changes_requested"


def test_newest_exact_head_codex_evidence_decides_its_form() -> None:
    # A native finding review newer than a clean comment reports as "reviewed";
    # a clean comment newer than a native finding reports as "clean_comment".
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:01:00Z")]
        ],
        comment_pages=[[clean_codex_comment(updated_at="2026-08-22T12:00:00Z")]],
    ) as env:
        assert review_summary(env)["coverage"]["form"] == "reviewed"
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")]
        ],
        comment_pages=[[clean_codex_comment(updated_at="2026-08-22T12:01:00Z")]],
    ) as env:
        assert review_summary(env)["coverage"]["form"] == "clean_comment"


def test_off_head_codex_evidence_never_overrides_exact_head_evidence() -> None:
    # A delayed native review of an OLD head cannot displace the clean comment on
    # head; a delayed stale clean comment cannot displace the finding review on head.
    with gate_env(
        review_pages=[
            [
                codex_review(
                    sha=OTHER_SHA,
                    state="COMMENTED",
                    submitted_at="2026-08-22T12:01:00Z",
                )
            ]
        ],
        comment_pages=[[clean_codex_comment(updated_at="2026-08-22T12:00:00Z")]],
    ) as env:
        assert review_summary(env)["coverage"]["form"] == "clean_comment"
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")]
        ],
        comment_pages=[
            [clean_codex_comment(OTHER_SHA[:10], updated_at="2026-08-22T12:01:00Z")]
        ],
    ) as env:
        assert review_summary(env)["coverage"]["form"] == "reviewed"


def test_delayed_old_head_review_does_not_override_current_native_approval() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T12:00:00Z"),
        codex_review(
            sha=OTHER_SHA, state="COMMENTED", submitted_at="2026-08-22T12:01:00Z"
        ),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert f"Codex approved head SHA {HEAD_SHA[:7]}" in result.stdout


# ---------------------------------------------------------------------------------
# Gate 3 fails closed: nothing off-head, untrusted, or unusable covers
# ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "reviews",
    [
        pytest.param([], id="no-review"),
        pytest.param([codex_review(login="other-reviewer[bot]")], id="untrusted-bot"),
        pytest.param([codex_review(sha=OTHER_SHA)], id="approval-of-old-head"),
        pytest.param(
            [codex_review(login=CODERABBIT_BOT, sha=OTHER_SHA)],
            id="coderabbit-approval-of-old-head",
        ),
    ],
)
def test_no_qualifying_review_without_manual_attestation_fails(
    reviews: list[dict],
) -> None:
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed:" in result.stdout
    assert f"no reviewer's evidence covers head {HEAD_SHA[:7]}" in result.stdout


@pytest.mark.parametrize(
    "witness",
    [
        pytest.param(clean_codex_reaction_witness(login="other[bot]"), id="wrong-bot"),
        pytest.param(clean_codex_reaction_witness(app="other-app"), id="wrong-app"),
        pytest.param(clean_codex_reaction_witness(OTHER_SHA), id="stale-head"),
    ],
)
def test_untrusted_or_stale_reaction_witnesses_do_not_cover_head(
    witness: dict,
) -> None:
    with gate_env(comment_pages=[[witness]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout


@pytest.mark.parametrize(
    "comment",
    [
        pytest.param(clean_codex_comment(login="other[bot]"), id="wrong-bot"),
        pytest.param(clean_codex_comment(app="other-app"), id="wrong-app"),
        pytest.param(
            clean_codex_comment(prefix="Codex Review: Looks good."), id="wrong-prefix"
        ),
        pytest.param(clean_codex_comment(HEAD_SHA[:9]), id="short-sha"),
        pytest.param(clean_codex_comment(OTHER_SHA[:10]), id="stale-sha"),
    ],
)
def test_untrusted_or_stale_clean_comments_do_not_cover_head(comment: dict) -> None:
    with gate_env(comment_pages=[[comment]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout


@pytest.mark.parametrize("state", ["DISMISSED", "PENDING", "UNKNOWN"])
def test_unusable_current_head_codex_review_state_fails_closed(state: str) -> None:
    with gate_env(review_pages=[[codex_review(state=state)]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert summary["label"] == "not reviewed"
    assert verdicts(summary)["codex"] == "none"


@pytest.mark.parametrize("state", ["COMMENTED", "DISMISSED"])
def test_coderabbit_non_approval_on_head_is_not_reviewed(state: str) -> None:
    review = codex_review(login=CODERABBIT_BOT, state=state)
    with gate_env(review_pages=[[review]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert summary["label"] == "not reviewed"
    assert verdicts(summary) == {
        "coderabbit": "none",
        "codex": "none",
        "marker": "none",
    }


def test_coderabbit_changes_requested_on_head_is_changes_requested() -> None:
    review = codex_review(login=CODERABBIT_BOT, state="CHANGES_REQUESTED")
    with gate_env(review_pages=[[review]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed: changes requested" in result.stdout
    assert f"CodeRabbit: requested changes on head {HEAD_SHA[:7]}" in result.stdout
    assert summary["label"] == "changes requested"


def test_unresolved_threads_make_uncovered_head_changes_requested() -> None:
    with gate_env(
        threads=[thread(resolved=False, author="timothyfroehlich")],
        review_pages=[[codex_review(sha=OTHER_SHA)]],
    ) as env:
        summary = review_summary(env)
    assert summary["label"] == "changes requested"
    assert summary["unresolved_threads"] == 1


def test_unresolved_threads_do_not_change_an_approved_label() -> None:
    # Coverage on head is Gate 3's whole question; Gate 2 owns the threads.
    with gate_env(
        threads=[thread(resolved=False, author="timothyfroehlich")],
        review_pages=[[codex_review()]],
    ) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 0, result.stdout
    assert summary["label"] == "approved"


def test_null_commit_id_does_not_shift_reviewer_into_the_sha_slot() -> None:
    # GitHub's commit_id is nullable; the record must carry "" rather than the login.
    with gate_env(review_pages=[[codex_review(sha=None)]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    codex = summary["checkers"]["codex"]
    assert (codex["verdict"], codex["sha"], codex["reviewer"]) == (
        "stale",
        "",
        CODEX_BOT,
    )
    assert "Codex approved chatgpt" not in result.stdout


# ---------------------------------------------------------------------------------
# Stale evidence: named in the FAIL block, never coverage
# ---------------------------------------------------------------------------------


def test_stale_codex_approval_reports_both_commits_and_the_request_remedy() -> None:
    with gate_env(review_pages=[[codex_review(sha=OTHER_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed: stale review" in result.stdout
    assert (
        f"Codex: newest evidence names {OTHER_SHA[:7]}, head is {HEAD_SHA[:7]}"
        in result.stdout
    )
    assert "request-codex-review.sh 123 exactly once" in result.stdout
    assert "CodeRabbit request or a local review" in result.stdout
    assert summary["label"] == "stale review"


def test_stale_coderabbit_approval_is_stale_review() -> None:
    with gate_env(
        review_pages=[[codex_review(login=CODERABBIT_BOT, sha=OTHER_SHA)]]
    ) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed: stale review" in result.stdout
    assert f"CodeRabbit: newest evidence names {OTHER_SHA[:7]}" in result.stdout


@pytest.mark.parametrize("state", ["DISMISSED", "PENDING", "UNKNOWN"])
def test_old_unusable_codex_review_is_stale(state: str) -> None:
    with gate_env(review_pages=[[codex_review(sha=OTHER_SHA, state=state)]]) as env:
        summary = review_summary(env)
    assert summary["label"] == "stale review"
    codex = summary["checkers"]["codex"]
    assert (codex["verdict"], codex["sha"], codex["detail"]) == (
        "stale",
        OTHER_SHA,
        state,
    )


def test_newest_stale_manual_marker_is_reported_when_no_marker_pins_head() -> None:
    older_sha = "1111111111111111111111111111111111111111"
    with gate_env(
        comment_pages=[
            [
                manual_marker(older_sha, updated_at="2026-08-22T12:00:00Z"),
                manual_marker(OTHER_SHA, updated_at="2026-08-22T12:01:00Z"),
            ]
        ]
    ) as env:
        summary = review_summary(env)
    marker = summary["checkers"]["marker"]
    assert (marker["verdict"], marker["sha"]) == ("stale", OTHER_SHA)


def test_stale_manual_marker_does_not_hide_the_current_finding_review() -> None:
    with gate_env(
        review_pages=[[codex_review(state="CHANGES_REQUESTED")]],
        comment_pages=[[manual_marker(OTHER_SHA, updated_at="2026-08-22T12:01:00Z")]],
    ) as env:
        summary = review_summary(env)
    assert summary["label"] == "approved"
    assert summary["coverage"]["checker"] == "codex"
    assert verdicts(summary)["marker"] == "stale"


# ---------------------------------------------------------------------------------
# The manual Codex request marker: pending is a remedy hint, not evidence
# ---------------------------------------------------------------------------------


def test_current_head_review_request_is_pending_not_recommended_again() -> None:
    with gate_env(comment_pages=[[manual_review_request()]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert summary["label"] == "not reviewed"
    assert summary["codex_request_pending"] is True
    assert "already requested" in result.stdout
    assert "do not request the same head again" in result.stdout
    assert "request-codex-review.sh" not in result.stdout


@pytest.mark.parametrize(
    "review_request_comment",
    [
        manual_review_request(OTHER_SHA),
        manual_review_request(login="someone-else"),
    ],
)
def test_old_or_untrusted_review_request_does_not_mark_current_head_requested(
    review_request_comment: dict,
) -> None:
    with gate_env(comment_pages=[[review_request_comment]]) as env:
        result = run_gate("check_review_happened", env)
        summary = review_summary(env)
    assert result.returncode == 1, result.stdout
    assert summary["codex_request_pending"] is False
    assert "request-codex-review.sh 123 exactly once" in result.stdout


@pytest.mark.parametrize("state", ["DISMISSED", "PENDING", "UNKNOWN"])
def test_unusable_current_head_review_with_request_marker_stays_pending(
    state: str,
) -> None:
    with gate_env(
        review_pages=[[codex_review(state=state)]],
        comment_pages=[[manual_review_request()]],
    ) as env:
        summary = review_summary(env)
    assert summary["label"] == "not reviewed"
    assert summary["codex_request_pending"] is True


def test_review_gate_never_waits() -> None:
    for reviews in ([], [codex_review(sha=OTHER_SHA)]):
        with gate_env(review_pages=[reviews]) as env:
            result = run_gate("check_review_happened", env)
        assert result.returncode == 1, result.stdout
        assert "WAIT" not in result.stdout


# ---------------------------------------------------------------------------------
# Evidence collection: pagination, fail-closed fetches, record metadata
# ---------------------------------------------------------------------------------


def test_reviews_and_comments_are_read_across_all_pages() -> None:
    with gate_env(review_pages=[[], [codex_review()]]) as env:
        assert run_gate("check_review_happened", env).returncode == 0
    with gate_env(review_pages=[[], [codex_review(login=CODERABBIT_BOT)]]) as env:
        assert run_gate("check_review_happened", env).returncode == 0
    for comment in (
        manual_marker(),
        clean_codex_comment(),
        clean_codex_reaction_witness(),
    ):
        with gate_env(comment_pages=[[], [comment]]) as env:
            assert run_gate("check_review_happened", env).returncode == 0


def test_every_reviewer_is_consulted_even_when_codex_already_covers() -> None:
    # One evidence fetch serves all three checkers; nothing is skipped on the way.
    with gate_env(review_pages=[[codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
        calls = Path(env["STUB_CALLS"]).read_text()
    assert result.returncode == 0, result.stdout
    assert "/pulls/123/reviews" in calls
    assert "/issues/123/comments" in calls


def test_failed_comment_fetch_fails_the_summary_rather_than_reading_as_empty() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        env["STUB_COMMENTS"] = str(Path(env["STUB_COMMENTS"]).parent / "missing.json")
        result = subprocess.run(
            [
                "bash",
                "-c",
                f'set -euo pipefail; source "{GATES_PATH}"; _review_summary 123',
            ],
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )
    assert result.returncode != 0
    assert result.stdout.strip() == ""


def test_review_summary_shape() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        summary = review_summary(env)
    assert set(summary) == {
        "head",
        "label",
        "coverage",
        "checkers",
        "codex_request_pending",
        "unresolved_threads",
    }
    assert summary["head"] == HEAD_SHA
    assert set(summary["checkers"]) == {"coderabbit", "codex", "marker"}
    coverage = summary["coverage"]
    assert (coverage["sha"], coverage["reviewer"], coverage["detail"]) == (
        HEAD_SHA,
        CODEX_BOT,
        "APPROVED",
    )
    assert coverage["at"] == "2026-08-22T12:00:00Z"
    assert coverage["summary"] == "Codex review summary"


def test_manual_marker_record_retains_reviewer_and_detail() -> None:
    with gate_env(
        comment_pages=[[manual_marker(reviewer="codex-plugin-cc", detail="base-main")]]
    ) as env:
        coverage = review_summary(env)["coverage"]
    assert (
        coverage["checker"],
        coverage["sha"],
        coverage["reviewer"],
        coverage["detail"],
    ) == (
        "marker",
        HEAD_SHA,
        "codex-plugin-cc",
        "base-main",
    )


def test_canonical_marker_without_metadata_is_unrecorded() -> None:
    bare = {
        "body": f"<!-- pinpoint-review: {HEAD_SHA} -->\nreviewed by hand",
        "updated_at": "2026-08-22T12:00:00Z",
    }
    with gate_env(comment_pages=[[bare]]) as env:
        coverage = review_summary(env)["coverage"]
    assert (coverage["reviewer"], coverage["detail"]) == ("unrecorded", "unrecorded")


def test_legacy_marker_and_trivial_detail_remain_readable() -> None:
    with gate_env(comment_pages=[[legacy_claude_marker(detail="trivial")]]) as env:
        coverage = review_summary(env)["coverage"]
    assert (coverage["checker"], coverage["reviewer"], coverage["detail"]) == (
        "marker",
        "claude-code",
        "trivial",
    )


def test_marker_text_quoted_in_a_comment_is_not_a_marker() -> None:
    quoted = {"body": f"maybe post <!-- pinpoint-review: {HEAD_SHA} -->"}
    with gate_env(comment_pages=[[quoted]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout


# ---------------------------------------------------------------------------------
# Two-axis review comments are local attestations
# ---------------------------------------------------------------------------------


def test_claude_two_axis_review_with_explicit_short_sha_pins_head() -> None:
    comment = claude_two_axis_review(sha=HEAD_SHA[:8])
    with gate_env(comment_pages=[[comment]]) as env:
        coverage = review_summary(env)["coverage"]
        gate_res = run_gate("check_review_happened", env)
    assert coverage["checker"] == "marker"
    assert coverage["sha"] == HEAD_SHA[:8]
    assert (coverage["reviewer"], coverage["detail"]) == ("claude-code", "two-axis")
    assert "Standards: 0 hard, Spec: 0 findings" in coverage["summary"]
    assert gate_res.returncode == 0, gate_res.stdout
    assert f"review marker pins head SHA {HEAD_SHA[:7]}" in gate_res.stdout


def test_claude_two_axis_review_with_merge_base_only_correlates_commit_timestamp() -> (
    None
):
    comment = claude_two_axis_review(sha=None, updated_at="2026-08-22T12:05:00Z")
    commits = [
        {
            "oid": "1111111111111111111111111111111111111111",
            "committedDate": "2026-08-22T12:00:00Z",
        },
        {"oid": HEAD_SHA, "committedDate": "2026-08-22T12:04:00Z"},
    ]
    with gate_env(comment_pages=[[comment]], commits=commits) as env:
        coverage = review_summary(env)["coverage"]
        gate_res = run_gate("check_review_happened", env)
    assert coverage["checker"] == "marker"
    assert coverage["sha"] == HEAD_SHA
    assert gate_res.returncode == 0, gate_res.stdout


def test_claude_two_axis_review_becomes_stale_when_head_moves() -> None:
    comment = claude_two_axis_review(sha=OTHER_SHA[:8])
    with gate_env(comment_pages=[[comment]]) as env:
        summary = review_summary(env)
        gate_res = run_gate("check_review_happened", env)
    marker = summary["checkers"]["marker"]
    assert (marker["verdict"], marker["sha"]) == ("stale", OTHER_SHA[:8])
    assert summary["label"] == "stale review"
    assert gate_res.returncode == 1, gate_res.stdout
    assert (
        f"local attestation: newest evidence names {OTHER_SHA[:7]}, head is {HEAD_SHA[:7]}"
        in gate_res.stdout
    )


def test_antigravity_two_axis_review_records_antigravity_reviewer() -> None:
    comment = claude_two_axis_review(sha=HEAD_SHA[:8], reviewer_sig="—Antigravity")
    with gate_env(comment_pages=[[comment]]) as env:
        coverage = review_summary(env)["coverage"]
    assert (coverage["reviewer"], coverage["detail"]) == ("antigravity", "two-axis")


# ---------------------------------------------------------------------------------
# Gate 1 (CI) and Gate 2 (threads)
# ---------------------------------------------------------------------------------


def ci_gate(
    *,
    status: str = "COMPLETED",
    conclusion: str | None = "SUCCESS",
    started_at: str = "2026-08-22T12:00:00Z",
    completed_at: str | None = "2026-08-22T12:10:00Z",
) -> dict:
    return {
        "name": "CI Gate",
        "status": status,
        "conclusion": conclusion,
        "startedAt": started_at,
        "completedAt": completed_at,
    }


def test_ci_gate_passes_on_a_single_successful_run() -> None:
    with gate_env(rollup=[ci_gate()]) as env:
        result = run_gate("check_ci", env)
    assert result.returncode == 0, result.stdout
    assert "PASS: ci:" in result.stdout


def test_ci_gate_absent_is_a_wait() -> None:
    with gate_env(rollup=[{"name": "Other", "status": "COMPLETED"}]) as env:
        result = run_gate("check_ci", env)
    assert result.returncode == 2, result.stdout
    assert "CI Gate check not reported yet" in result.stdout


def test_two_completed_ci_gate_runs_on_one_head_read_as_one_result() -> None:
    # Draft promotion re-runs the workflow on the same SHA; PR #2117 carried two
    # COMPLETED/SUCCESS entries and the gate sat in WAIT with status=COMPLETED.
    rollup = [
        ci_gate(started_at="2026-08-22T12:00:00Z", completed_at="2026-08-22T12:10:00Z"),
        ci_gate(started_at="2026-08-22T12:20:00Z", completed_at="2026-08-22T12:30:00Z"),
    ]
    with gate_env(rollup=rollup) as env:
        result = run_gate("check_ci", env)
    assert result.returncode == 0, result.stdout
    assert "PASS: ci:" in result.stdout


def test_newest_ci_gate_run_is_authoritative() -> None:
    rollup = [
        ci_gate(completed_at="2026-08-22T12:10:00Z"),
        ci_gate(
            conclusion="FAILURE",
            started_at="2026-08-22T12:20:00Z",
            completed_at="2026-08-22T12:30:00Z",
        ),
    ]
    with gate_env(rollup=rollup) as env:
        result = run_gate("check_ci", env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: ci:" in result.stdout


def test_cancelled_ci_gate_leftover_yields_to_the_live_run() -> None:
    rollup = [
        ci_gate(
            conclusion="CANCELLED",
            started_at="2026-08-22T12:20:00Z",
            completed_at="2026-08-22T12:21:00Z",
        ),
        ci_gate(started_at="2026-08-22T12:00:00Z", completed_at="2026-08-22T12:10:00Z"),
    ]
    with gate_env(rollup=rollup) as env:
        result = run_gate("check_ci", env)
    assert result.returncode == 0, result.stdout


def test_unresolved_threads_block_regardless_of_author() -> None:
    with gate_env(
        threads=[
            thread(resolved=False, author="timothyfroehlich"),
            thread(resolved=False, author="some-agent"),
        ]
    ) as env:
        result = run_gate("check_unresolved_threads", env)
    assert result.returncode == 1, result.stdout
    assert "2 unresolved review threads" in result.stdout


def test_resolved_threads_do_not_block() -> None:
    with gate_env(threads=[thread(resolved=True, author="codex")]) as env:
        result = run_gate("check_unresolved_threads", env)
    assert result.returncode == 0, result.stdout
