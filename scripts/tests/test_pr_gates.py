"""Regression tests for the merge gate's automatic and manual review records.

A native approval, trusted clean connector comment or reaction from the official Codex
GitHub App, or the existing SHA-pinned manual attestation, may cover the current head.
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

GATES_PATH = Path(__file__).parent.parent / "workflow" / "_pr-gates.sh"
CODEX_BOT = "chatgpt-codex-connector[bot]"
CODEX_APP = "chatgpt-codex-connector"
HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
OTHER_SHA = "0000000000000000000000000000000000000000"


def codex_review(
    *,
    sha: str = HEAD_SHA,
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


def clean_codex_reaction(
    *,
    login: str = CODEX_BOT,
    content: str = "+1",
    created_at: str = "2026-08-22T12:02:00Z",
) -> dict:
    return {
        "user": {"login": login},
        "content": content,
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
    reaction_pages: list[list[dict]] | None = None,
    threads: list[dict] | None = None,
    head_sha: str = HEAD_SHA,
    ci_completed_at: str = "2026-08-22T12:01:00Z",
) -> Iterator[dict]:
    """Yield an environment whose gh executable serves paginated review records."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "reviews.json").write_text(
            "\n".join(json.dumps(page) for page in (review_pages or [[]]))
        )
        (tmp_path / "comments.json").write_text(
            "\n".join(json.dumps(page) for page in (comment_pages or [[]]))
        )
        (tmp_path / "reactions.json").write_text(
            "\n".join(json.dumps(page) for page in (reaction_pages or [[]]))
        )
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
            '  *"statusCheckRollup"*) printf "%s\\n" "$STUB_CI_COMPLETED_AT" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"api graphql"*) cat "$STUB_THREADS" ;;\n'
            '  *"/pulls/"*"/reviews"*) cat "$STUB_REVIEWS" ;;\n'
            '  *"/issues/"*"/comments"*) cat "$STUB_COMMENTS" ;;\n'
            '  *"/issues/"*"/reactions"*) cat "$STUB_REACTIONS" ;;\n'
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
        env["STUB_REACTIONS"] = str(tmp_path / "reactions.json")
        env["STUB_THREADS"] = str(tmp_path / "threads.json")
        env["STUB_CALLS"] = str(calls_path)
        env["STUB_CI_COMPLETED_AT"] = ci_completed_at
        yield env


def run_gate(fn: str, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", "-c", f'source "{GATES_PATH}"; {fn} 123'],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def review_record(env: dict) -> list[str]:
    result = subprocess.run(
        [
            "bash",
            "-c",
            f'source "{GATES_PATH}"; _review_record 123 acme/widget {HEAD_SHA}',
        ],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.rstrip("\n").split("\t")


def test_codex_approval_of_head_passes() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert f"Codex approved head SHA {HEAD_SHA[:7]}" in result.stdout


def test_clean_codex_comment_of_head_passes() -> None:
    with gate_env(comment_pages=[[clean_codex_comment()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert f"Codex found no major issues on head SHA {HEAD_SHA[:7]}" in result.stdout


def test_clean_codex_comment_accepts_full_head_sha() -> None:
    with gate_env(comment_pages=[[clean_codex_comment(HEAD_SHA)]]) as env:
        state, sha, reviewer, detail, *_rest = review_record(env)
    assert (state, sha, reviewer, detail) == (
        "clean_comment",
        HEAD_SHA,
        CODEX_BOT,
        "NO_FINDINGS",
    )


def test_clean_codex_reaction_after_current_head_ci_passes() -> None:
    with gate_env(reaction_pages=[[clean_codex_reaction()]]) as env:
        state, sha, reviewer, detail, *_rest = review_record(env)
    assert (state, sha, reviewer, detail) == (
        "clean_reaction",
        HEAD_SHA,
        CODEX_BOT,
        "NO_FINDINGS",
    )


@pytest.mark.parametrize(
    "reaction,ci_completed_at",
    [
        pytest.param(
            clean_codex_reaction(login="other[bot]"),
            "2026-08-22T12:01:00Z",
            id="wrong-bot",
        ),
        pytest.param(
            clean_codex_reaction(content="eyes"),
            "2026-08-22T12:01:00Z",
            id="wrong-content",
        ),
        pytest.param(
            clean_codex_reaction(created_at="2026-08-22T12:00:00Z"),
            "2026-08-22T12:01:00Z",
            id="before-current-ci",
        ),
    ],
)
def test_untrusted_or_pre_head_reactions_do_not_cover_head(
    reaction: dict, ci_completed_at: str
) -> None:
    with gate_env(reaction_pages=[[reaction]], ci_completed_at=ci_completed_at) as env:
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


def test_later_native_finding_overrides_earlier_clean_comment() -> None:
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:01:00Z")]
        ],
        comment_pages=[[clean_codex_comment(updated_at="2026-08-22T12:00:00Z")]],
    ) as env:
        state, *_rest = review_record(env)
    assert state == "reviewed"


def test_delayed_native_review_of_old_head_does_not_override_current_clean_comment() -> (
    None
):
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
        state, *_rest = review_record(env)
    assert state == "clean_comment"


def test_delayed_stale_clean_comment_does_not_override_current_finding_review() -> None:
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")]
        ],
        comment_pages=[
            [clean_codex_comment(OTHER_SHA[:10], updated_at="2026-08-22T12:01:00Z")]
        ],
    ) as env:
        state, *_rest = review_record(env)
    assert state == "reviewed"


def test_later_clean_comment_supersedes_earlier_native_nonapproval() -> None:
    with gate_env(
        review_pages=[
            [codex_review(state="COMMENTED", submitted_at="2026-08-22T12:00:00Z")]
        ],
        comment_pages=[[clean_codex_comment(updated_at="2026-08-22T12:01:00Z")]],
    ) as env:
        state, *_rest = review_record(env)
    assert state == "clean_comment"


def test_manual_attestation_of_head_still_passes() -> None:
    with gate_env(comment_pages=[[manual_marker()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert f"review marker pins head SHA {HEAD_SHA[:7]}" in result.stdout


def test_manual_attestation_remains_valid_after_non_approval_codex_review() -> None:
    with gate_env(
        review_pages=[[codex_review(state="CHANGES_REQUESTED")]],
        comment_pages=[[manual_marker()]],
    ) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert "review marker pins head SHA" in result.stdout


def test_stale_manual_marker_does_not_override_current_finding_review() -> None:
    with gate_env(
        review_pages=[[codex_review(state="CHANGES_REQUESTED")]],
        comment_pages=[
            [
                manual_marker(
                    OTHER_SHA,
                    updated_at="2026-08-22T12:01:00Z",
                )
            ]
        ],
    ) as env:
        state, sha, *_rest = review_record(env)
    assert (state, sha) == ("reviewed", HEAD_SHA)


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
        state, sha, *_rest = review_record(env)
    assert (state, sha) == ("stale_marker", OTHER_SHA)


def test_current_codex_approval_skips_manual_marker_lookup() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
        calls = Path(env["STUB_CALLS"]).read_text()
    assert result.returncode == 0, result.stdout
    assert "/pulls/123/reviews" in calls
    assert "/issues/123/comments" not in calls


def test_manual_markers_are_read_across_all_pages() -> None:
    with gate_env(comment_pages=[[], [manual_marker()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_clean_codex_comments_are_read_across_all_pages() -> None:
    with gate_env(comment_pages=[[], [clean_codex_comment()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_clean_codex_reactions_are_read_across_all_pages() -> None:
    with gate_env(reaction_pages=[[], [clean_codex_reaction()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


@pytest.mark.parametrize(
    "reviews",
    [
        pytest.param([], id="no-codex-review"),
        pytest.param([codex_review(login="other-reviewer[bot]")], id="untrusted-bot"),
        pytest.param([codex_review(sha=OTHER_SHA)], id="approval-of-old-head"),
    ],
)
def test_no_qualifying_codex_review_without_manual_attestation_fails(
    reviews: list[dict],
) -> None:
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed:" in result.stdout


def test_latest_current_head_finding_completes_review_coverage() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T12:00:00Z"),
        codex_review(
            state="CHANGES_REQUESTED",
            submitted_at="2026-08-22T12:01:00Z",
        ),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert "thread gate owns findings" in result.stdout


@pytest.mark.parametrize("state", ["DISMISSED", "PENDING", "UNKNOWN"])
def test_unusable_current_head_review_state_fails_closed(state: str) -> None:
    with gate_env(review_pages=[[codex_review(state=state)]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "without approval" in result.stdout


def test_delayed_old_head_review_does_not_override_current_native_approval() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T12:00:00Z"),
        codex_review(
            sha=OTHER_SHA,
            state="COMMENTED",
            submitted_at="2026-08-22T12:01:00Z",
        ),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert f"Codex approved head SHA {HEAD_SHA[:7]}" in result.stdout


def test_reviews_are_read_across_all_pages() -> None:
    with gate_env(review_pages=[[], [codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_stale_approval_reports_both_commits_and_the_automatic_review_remedy() -> None:
    with gate_env(review_pages=[[codex_review(sha=OTHER_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert OTHER_SHA[:7] in result.stdout
    assert HEAD_SHA[:7] in result.stdout
    assert "await a clean automatic Codex result" in result.stdout
    assert "only when Tim explicitly requests it" in result.stdout


def test_review_gate_never_waits() -> None:
    for reviews in ([], [codex_review(sha=OTHER_SHA)]):
        with gate_env(review_pages=[reviews]) as env:
            result = run_gate("check_review_happened", env)
        assert result.returncode == 1, result.stdout
        assert "WAIT" not in result.stdout


def test_review_record_and_verdict_agree() -> None:
    with gate_env(review_pages=[[codex_review()]]) as env:
        state, sha, reviewer, detail, at, summary = review_record(env)
        verdict = subprocess.run(
            [
                "bash",
                "-c",
                f'source "{GATES_PATH}"; _review_verdict 123 acme/widget {HEAD_SHA}',
            ],
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )
    assert (state, sha, reviewer, detail) == (
        "approval",
        HEAD_SHA,
        CODEX_BOT,
        "APPROVED",
    )
    assert at == "2026-08-22T12:00:00Z"
    assert summary == "Codex review summary"
    assert verdict.stdout.strip() == f"approval {HEAD_SHA}"


def test_manual_marker_record_retains_reviewer_and_detail() -> None:
    with gate_env(
        comment_pages=[[manual_marker(reviewer="codex-plugin-cc", detail="base-main")]]
    ) as env:
        state, sha, reviewer, detail, *_rest = review_record(env)
    assert (state, sha, reviewer, detail) == (
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
        state, sha, reviewer, detail, *_rest = review_record(env)
    assert (state, sha, reviewer, detail) == (
        "marker",
        HEAD_SHA,
        "unrecorded",
        "unrecorded",
    )


def test_legacy_marker_and_trivial_detail_remain_readable() -> None:
    with gate_env(comment_pages=[[legacy_claude_marker(detail="trivial")]]) as env:
        state, sha, reviewer, detail, *_rest = review_record(env)
    assert (state, sha, reviewer, detail) == (
        "marker",
        HEAD_SHA,
        "claude-code",
        "trivial",
    )


@pytest.mark.parametrize("order", [[OTHER_SHA, HEAD_SHA], [HEAD_SHA, OTHER_SHA]])
def test_any_manual_marker_pinning_head_passes(order: list[str]) -> None:
    with gate_env(comment_pages=[[manual_marker(sha) for sha in order]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_marker_text_quoted_in_a_comment_is_not_a_marker() -> None:
    quoted = {"body": f"maybe post <!-- pinpoint-review: {HEAD_SHA} -->"}
    with gate_env(comment_pages=[[quoted]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout


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
