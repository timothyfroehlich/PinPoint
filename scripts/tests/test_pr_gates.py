"""Regression tests for the merge gate's native and manual review records.

Either an APPROVED review from the official Codex GitHub App or the existing
SHA-pinned manual attestation may cover the pull request's current head.
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
    threads: list[dict] | None = None,
    head_sha: str = HEAD_SHA,
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
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"api graphql"*) cat "$STUB_THREADS" ;;\n'
            '  *"/pulls/"*"/reviews"*) cat "$STUB_REVIEWS" ;;\n'
            '  *"/issues/"*"/comments"*) cat "$STUB_COMMENTS" ;;\n'
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
        env["STUB_THREADS"] = str(tmp_path / "threads.json")
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


def test_newer_stale_manual_marker_is_reported_over_older_codex_nonapproval() -> None:
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
    assert (state, sha) == ("stale_marker", OTHER_SHA)


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


@pytest.mark.parametrize(
    "reviews",
    [
        pytest.param([], id="no-codex-review"),
        pytest.param([codex_review(login="other-reviewer[bot]")], id="untrusted-bot"),
        pytest.param([codex_review(sha=OTHER_SHA)], id="approval-of-old-head"),
        pytest.param([codex_review(state="COMMENTED")], id="non-approval-review"),
    ],
)
def test_no_qualifying_codex_review_without_manual_attestation_fails(
    reviews: list[dict],
) -> None:
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "FAIL: reviewed:" in result.stdout


def test_latest_codex_review_overrides_an_earlier_approval() -> None:
    reviews = [
        codex_review(submitted_at="2026-08-22T12:00:00Z"),
        codex_review(
            state="CHANGES_REQUESTED",
            submitted_at="2026-08-22T12:01:00Z",
        ),
    ]
    with gate_env(review_pages=[reviews]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 1, result.stdout
    assert "without approval" in result.stdout


def test_reviews_are_read_across_all_pages() -> None:
    with gate_env(review_pages=[[], [codex_review()]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_stale_approval_reports_both_commits_and_the_codex_remedy() -> None:
    with gate_env(review_pages=[[codex_review(sha=OTHER_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert OTHER_SHA[:7] in result.stdout
    assert HEAD_SHA[:7] in result.stdout
    assert "@codex review" in result.stdout


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
