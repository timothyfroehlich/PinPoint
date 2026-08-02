"""Unit tests for the `reviewed` and `threads` gates in scripts/workflow/_pr-gates.sh.

These gates decide whether a PR may merge, so their edge cases are worth pinning down.

PP-4ric retired Copilot review: its free tier was too small to be useful, so no bot
reviews this repo now. The `reviewed` gate is satisfied only by the SHA-pinned marker
`mark-claude-review.sh` posts, which attests that Tim ran `/code-review` (a harness
built-in an agent cannot launch). Three states replace the old six — there is no
request to wait on, so nothing here WAITs, and the whole request-timeline/quota-body
apparatus (PP-lzaw, PP-jw0s) went with the reviewer it modelled.

What survives from that history, and is re-pinned below: the head SHA is compared
directly rather than inferred from timestamps, so a review of an earlier tree cannot
read as coverage of head (the PR #1784 false PASS); and the marker lookup slurps across
pagination, so a marker on page 2+ of a busy PR is still found.

The `threads` gate now counts unresolved threads from ANY author. Left filtered to
Copilot logins it would have matched nothing and become a permanent PASS.

Every test drives the real bash through a stubbed `gh`, so the jq filters are exercised
rather than mocked away.
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

HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
OTHER_SHA = "0000000000000000000000000000000000000000"


def marker_comment(sha: str) -> dict:
    """A comment in the exact shape mark-claude-review.sh posts."""
    return {
        "body": f"<!-- pinpoint-claude-review: {sha} -->\nClaude review of head {sha[:7]} — no serious findings"
    }


def thread(*, resolved: bool, author: str) -> dict:
    return {
        "isResolved": resolved,
        "comments": {"nodes": [{"author": {"login": author}}]},
    }


@contextmanager
def gate_env(
    *,
    comment_pages: list[list[dict]] | None = None,
    threads: list[dict] | None = None,
    head_sha: str = HEAD_SHA,
) -> Iterator[dict]:
    """Yield an env dict wiring a fake `gh` that answers every call the gates make.

    The stub dispatches on the joined argument string rather than parsing flags — it
    only needs to distinguish the four shapes `_pr-gates.sh` actually issues.

    `comment_pages` is a LIST OF PAGES, emitted as separate concatenated JSON arrays
    exactly as `gh api --paginate` does. A single-page list is the common case; a
    multi-page one exercises the `jq -rs` slurp the marker lookup depends on.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
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

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"--jq .headRefOid"*) printf "%s\\n" "$STUB_HEAD_SHA" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"api graphql"*) cat "$STUB_THREADS" ;;\n'
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
        env["STUB_COMMENTS"] = str(tmp_path / "comments.json")
        env["STUB_THREADS"] = str(tmp_path / "threads.json")
        yield env


def run_gate(fn: str, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", "-c", f'source "{GATES_PATH}"; {fn} 123'],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


# --- The merge bar: a head nobody reviewed cannot pass `reviewed` -------------------


@pytest.mark.parametrize(
    "case,comments",
    [
        ("no marker at all", []),
        ("marker pins an earlier commit", [marker_comment(OTHER_SHA)]),
    ],
)
def test_unreviewed_head_never_passes_the_reviewed_gate(
    case: str, comments: list[dict]
) -> None:
    """The hard backstop. A non-zero exit is what blocks merge-pr.sh."""
    with gate_env(comment_pages=[comments]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, f"{case} passed the reviewed gate:\n{result.stdout}"
    assert "FAIL: reviewed:" in result.stdout


def test_marker_pinning_head_passes() -> None:
    with gate_env(comment_pages=[[marker_comment(HEAD_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed:" in result.stdout
    assert HEAD_SHA[:7] in result.stdout


def test_nothing_in_the_reviewed_gate_ever_waits() -> None:
    """rc=2 tells merge-pr.sh's automerge loop to keep polling.

    With no reviewer to answer a request, there is never an outcome already on its
    way, so a WAIT here would poll for an hour and then time out. Both un-reviewed
    states must be terminal.
    """
    for comments in ([], [marker_comment(OTHER_SHA)]):
        with gate_env(comment_pages=[comments]) as env:
            result = run_gate("check_review_happened", env)
        assert result.returncode == 1, result.stdout
        assert "WAIT" not in result.stdout


# --- stale_marker is named distinctly from unreviewed -------------------------------


def test_stale_marker_says_you_pushed_past_the_review() -> None:
    """The subtle failure: the PR visibly HAS a review, and it is not of head.

    Reported as its own state so the reader fixes the right thing — re-review the new
    head — instead of reading the gate as flaky.
    """
    with gate_env(comment_pages=[[marker_comment(OTHER_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert OTHER_SHA[:7] in result.stdout, result.stdout
    assert HEAD_SHA[:7] in result.stdout
    assert "pushed" in result.stdout.lower()


def test_unreviewed_does_not_claim_a_review_exists() -> None:
    with gate_env(comment_pages=[[]]) as env:
        result = run_gate("check_review_happened", env)
    assert "no review marker" in result.stdout, result.stdout


@pytest.mark.parametrize("comments", [[], [marker_comment(OTHER_SHA)]])
def test_every_failing_state_names_the_remedy(comments: list[dict]) -> None:
    """An agent cannot run /code-review, so the remedy has to name the handoff.

    Printing only `mark-claude-review.sh` would read as "attest and move on", which is
    exactly the false attestation the gate exists to prevent.
    """
    with gate_env(comment_pages=[comments]) as env:
        result = run_gate("check_review_happened", env)
    assert "/code-review" in result.stdout, result.stdout
    assert "mark-claude-review.sh 123" in result.stdout


# --- Marker lookup: pagination and shape --------------------------------------------


def test_marker_on_a_later_page_is_still_found() -> None:
    """`gh api --paginate` emits one JSON array per page.

    gh's own `--jq` runs per page and would miss this; the gate slurps instead. A busy
    PR whose marker landed on page 2 must not read as unreviewed.
    """
    pages = [
        [{"body": "unrelated chatter"}] * 3,
        [{"body": "more chatter"}, marker_comment(HEAD_SHA)],
    ]
    with gate_env(comment_pages=pages) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_the_newest_marker_wins() -> None:
    """mark-claude-review.sh rewrites one sticky comment, so duplicates are a stray.

    If one ever lands, the later comment is the current attestation.
    """
    pages = [[marker_comment(OTHER_SHA), marker_comment(HEAD_SHA)]]
    with gate_env(comment_pages=pages) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_a_comment_merely_mentioning_the_marker_is_not_one() -> None:
    """The lookup anchors on the START of the body.

    A review thread quoting the marker — or this test file's own name showing up in a
    PR discussion — must not attest anything.
    """
    quoting = {
        "body": f"I think we should post `<!-- pinpoint-claude-review: {HEAD_SHA} -->` here"
    }
    with gate_env(comment_pages=[[quoting]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, result.stdout


# --- Threads gate: author-agnostic --------------------------------------------------


def test_unresolved_threads_block_regardless_of_author() -> None:
    """The Copilot-login filter is gone (PP-4ric).

    Left in place it would have matched nothing and turned this gate into a permanent
    PASS — a false green worse than no gate, since Tim's own review comments never
    blocked a merge under the old filter either.
    """
    with gate_env(
        threads=[
            thread(resolved=False, author="timothyfroehlich"),
            thread(resolved=False, author="some-agent"),
        ]
    ) as env:
        result = run_gate("check_unresolved_threads", env)
    assert result.returncode != 0, result.stdout
    assert "2 unresolved review threads" in result.stdout


def test_resolved_threads_do_not_block() -> None:
    with gate_env(
        threads=[
            thread(resolved=True, author="timothyfroehlich"),
            thread(resolved=True, author="some-agent"),
        ]
    ) as env:
        result = run_gate("check_unresolved_threads", env)
    assert result.returncode == 0, result.stdout
    assert "PASS: threads: 0 unresolved review threads" in result.stdout


def test_no_threads_at_all_passes() -> None:
    with gate_env(threads=[]) as env:
        result = run_gate("check_unresolved_threads", env)
    assert result.returncode == 0, result.stdout


def test_thread_failure_names_the_two_ways_to_clear_it() -> None:
    """AGENTS.md §5 allows declining, not ignoring. The gate should say so."""
    with gate_env(threads=[thread(resolved=False, author="timothyfroehlich")]) as env:
        result = run_gate("check_unresolved_threads", env)
    assert "decline" in result.stdout.lower(), result.stdout
