"""Unit tests for the `reviewed` and `threads` gates in scripts/workflow/_pr-gates.sh.

These gates decide whether a PR may merge, so their edge cases are worth pinning down.

PP-4ric retired Copilot review: its free tier was too small to be useful, so no bot
reviews this repo now. Nothing here WAITs as a result — there is no request on its way
back, and the whole request-timeline/quota-body apparatus (PP-lzaw, PP-jw0s) went with
the reviewer it modelled.

Two kinds of evidence satisfy the `reviewed` gate, and PP-97tt added the second:

- the SHA-pinned marker `mark-claude-review.sh` posts, attesting that Tim ran
  `/code-review` (a harness built-in an agent cannot launch);
- the inline review comments `/code-review <depth> --comment <PR>` posts, which pin the
  commit the reviewer actually read.

Both pin a SHA, so both expire on the next push. The three cases most worth pinning down
here are the ones where a wrong answer is a false GREEN: `commit_id` must not be read in
place of `original_commit_id` (GitHub re-anchors the former, which would make every
review comment pin head forever), replies must not count (an agent answering the thread
it just fixed would otherwise attest a commit nobody read), and a review of an earlier
tree must not read as coverage of head (the PR #1784 false PASS).

What else survives from that history and is re-pinned below: the head SHA is compared
directly rather than inferred from timestamps, and both comment lookups slurp across
pagination, so evidence on page 2+ of a busy PR is still found.

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


def marker_comment(
    sha: str, depth: str | None = None, summary: str = "no serious findings"
) -> dict:
    """A comment in the exact shape mark-claude-review.sh posts.

    `depth=None` is the pre-PP-9onv shape — two lines, no depth comment. Markers in that
    shape are still live on merged PRs and on any branch attested before the change, so
    it stays the default here: every existing test doubles as a backward-compat test.
    """
    lines = [f"<!-- pinpoint-claude-review: {sha} -->"]
    if depth is not None:
        lines.append(f"<!-- pinpoint-review-depth: {depth} -->")
        lines.append(
            f"Claude review of head {sha[:7]} — `/code-review {depth}` — {summary}"
        )
    else:
        lines.append(f"Claude review of head {sha[:7]} — {summary}")
    return {"body": "\n".join(lines), "updated_at": "2026-08-02T20:43:19Z"}


def review_comment(
    sha: str,
    *,
    in_reply_to: int | None = None,
    at: str = "2026-08-03T10:00:00Z",
    commit_id: str | None = None,
) -> dict:
    """A comment in the shape `/code-review <depth> --comment <PR>` leaves behind.

    `commit_id` defaults to something DIFFERENT from `original_commit_id` on purpose:
    GitHub re-anchors `commit_id` as a PR advances, so any test that accidentally
    passes by reading it would be pinning the false-green bug rather than the fix.
    """
    return {
        "original_commit_id": sha,
        "commit_id": commit_id if commit_id is not None else OTHER_SHA,
        "in_reply_to_id": in_reply_to,
        "updated_at": at,
        "created_at": at,
        "body": "This dereferences `machine` before the null check.",
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
    review_comment_pages: list[list[dict]] | None = None,
    threads: list[dict] | None = None,
    head_sha: str = HEAD_SHA,
) -> Iterator[dict]:
    """Yield an env dict wiring a fake `gh` that answers every call the gates make.

    The stub dispatches on the joined argument string rather than parsing flags — it
    only needs to distinguish the five shapes `_pr-gates.sh` actually issues. The two
    comment endpoints are distinct: `issues/<pr>/comments` carries the review markers,
    `pulls/<pr>/comments` the inline review comments (PP-97tt).

    Both `*_pages` args are LISTS OF PAGES, emitted as separate concatenated JSON arrays
    exactly as `gh api --paginate` does. A single-page list is the common case; a
    multi-page one exercises the `jq -s` slurp both lookups depend on.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "comments.json").write_text(
            "\n".join(json.dumps(page) for page in (comment_pages or [[]]))
        )
        (tmp_path / "review-comments.json").write_text(
            "\n".join(json.dumps(page) for page in (review_comment_pages or [[]]))
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
            '  *"/pulls/"*"/comments"*) cat "$STUB_REVIEW_COMMENTS" ;;\n'
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
        env["STUB_REVIEW_COMMENTS"] = str(tmp_path / "review-comments.json")
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


@pytest.mark.parametrize(
    "order",
    [
        pytest.param([OTHER_SHA, HEAD_SHA], id="attestation-is-newest"),
        pytest.param([HEAD_SHA, OTHER_SHA], id="attestation-is-oldest"),
    ],
)
def test_any_marker_pinning_head_passes_whatever_the_order(order: list[str]) -> None:
    """The gate asks "does ANY marker pin head?", not "does the newest one?".

    Duplicate markers are a stray — mark-claude-review.sh rewrites one sticky comment —
    but a second session or a hand-posted comment can leave two. Reading only one of
    them lets writer and reader disagree about which is canonical: re-attesting would
    rewrite a comment the gate never reads, and a genuinely reviewed head would report
    stale_marker forever with --force as the only exit. The `attestation-is-oldest`
    case is the one that broke.
    """
    pages = [[marker_comment(sha) for sha in order]]
    with gate_env(comment_pages=pages) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_stale_marker_names_the_newest_marker_when_none_pins_head() -> None:
    """With nothing pinning head, the SHA reported is the most recent review."""
    older = "1111111111111111111111111111111111111111"
    pages = [[marker_comment(older), marker_comment(OTHER_SHA)]]
    with gate_env(comment_pages=pages) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, result.stdout
    assert OTHER_SHA[:7] in result.stdout, result.stdout
    assert older[:7] not in result.stdout, result.stdout


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


# --- Inline review comments as review evidence (PP-97tt) ----------------------------


def test_review_comments_pinning_head_pass_the_gate() -> None:
    """The point of `--comment`: a review that found something attests itself.

    Without this the findings sat on the PR while the gate still read `unreviewed`,
    waiting on an agent to notice and post a marker.
    """
    with gate_env(review_comment_pages=[[review_comment(HEAD_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout
    assert "PASS: reviewed: inline review comments pin head" in result.stdout


def test_any_top_level_comment_counts_not_only_code_review_findings() -> None:
    """Pinned because it is the honest scope of the gate, not because it is desirable.

    A review comment carries no mark saying which command produced it, so a plain
    line-level remark on head is indistinguishable from a `/code-review --comment`
    finding and PASSes the same way. There is no discriminator available at this layer —
    it would have to be embedded in the comment body at post time, by a harness prompt
    this repo does not own.

    This test exists so the behaviour is a recorded decision rather than a surprise: if
    a future change tightens it, this test should fail loudly and be deleted on purpose.
    """
    remark = review_comment(HEAD_SHA)
    remark["body"] = "why this shape rather than a Map?"
    with gate_env(review_comment_pages=[[remark]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_commit_id_is_never_read_in_place_of_original_commit_id() -> None:
    """The false-green this design turns on.

    GitHub re-anchors `commit_id` to keep a still-applicable comment attached to a live
    line, so a gate reading it would find every review comment pinning head forever and
    wave through commits nobody read. Here the comment was made on an OLD commit and
    GitHub has re-anchored it to head; the honest answer is still `stale_comments`.
    """
    with gate_env(
        review_comment_pages=[[review_comment(OTHER_SHA, commit_id=HEAD_SHA)]]
    ) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, result.stdout
    assert "FAIL: reviewed:" in result.stdout
    assert OTHER_SHA[:7] in result.stdout, result.stdout


def test_a_reply_does_not_attest_the_head_it_was_written_at() -> None:
    """The accidental self-attestation this excludes.

    A reply is created against whatever head is current, so an agent that pushes a fix
    and then answers the thread it just addressed would re-green the gate on a commit no
    reviewer has seen. Only top-level comments count as someone reading the diff.
    """
    with gate_env(
        review_comment_pages=[
            [
                review_comment(OTHER_SHA),
                review_comment(HEAD_SHA, in_reply_to=90210),
            ]
        ]
    ) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, result.stdout
    assert OTHER_SHA[:7] in result.stdout, result.stdout


def test_review_comments_on_an_earlier_commit_report_stale_comments() -> None:
    """Distinct from `stale_marker` because the remedy differs.

    A stale marker is cleared by re-attesting; stale comments only by getting the new
    head reviewed, and the gate says so rather than pointing at the wrong command.
    """
    with gate_env(review_comment_pages=[[review_comment(OTHER_SHA)]]) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode != 0, result.stdout
    assert "the review comments pin" in result.stdout
    assert "Resolving those threads does not re-attest" in result.stdout


def test_review_comments_on_a_later_page_are_still_found() -> None:
    """`gh api --paginate` emits one array per page; a naive parse sees only the first.

    Same trap the marker lookup already guards against, and a busy PR is exactly where
    a review comment ends up on page 2.
    """
    pages = [[review_comment(OTHER_SHA)], [review_comment(HEAD_SHA)]]
    with gate_env(review_comment_pages=pages) as env:
        result = run_gate("check_review_happened", env)
    assert result.returncode == 0, result.stdout


def test_a_marker_pinning_head_outranks_stale_comments() -> None:
    """Precedence is fixed, not newest-wins.

    The two clocks are not comparable — a marker's `updated_at` moves when the sticky
    comment is rewritten — so ordering by timestamp would make the verdict depend on
    which unrelated edit happened last.
    """
    with gate_env(
        comment_pages=[[marker_comment(HEAD_SHA, depth="high")]],
        review_comment_pages=[[review_comment(OTHER_SHA)]],
    ) as env:
        result = run_gate("check_review_happened", env)
        state, sha, depth, _at, _summary = review_record(env)
    assert result.returncode == 0, result.stdout
    assert (state, sha, depth) == ("marker", HEAD_SHA, "high")


def test_review_comments_record_their_count_not_one_row_each() -> None:
    """A six-finding review is one review. The handoff report says so."""
    with gate_env(
        review_comment_pages=[[review_comment(HEAD_SHA) for _ in range(6)]]
    ) as env:
        state, sha, depth, _at, summary = review_record(env)
    assert (state, sha, depth) == ("commented", HEAD_SHA, "unrecorded")
    assert "6 inline review comment(s)" in summary


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


# --- Marker record: the extra fields merge-handoff.sh reports -----------------------


def review_record(env: dict) -> list[str]:
    """`_review_record` for PR 123, split into its five TSV fields."""
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


def test_review_record_reports_the_review_depth() -> None:
    """Which /code-review ran is a separate fact from whether one ran.

    Before PP-9onv only the second was written down, so the merge handoff could not
    state the first without an agent recalling it.
    """
    with gate_env(comment_pages=[[marker_comment(HEAD_SHA, depth="high")]]) as env:
        state, sha, depth, at, summary = review_record(env)
    assert (state, sha, depth) == ("marker", HEAD_SHA, "high")
    assert at == "2026-08-02T20:43:19Z"
    assert "/code-review high" in summary


def test_a_marker_without_a_depth_comment_reads_as_unrecorded() -> None:
    """Absence of the field — not a claim that no review ran.

    Every marker posted before PP-9onv is this shape, and reading one as `trivial` (or
    as no review at all) would misreport a real review of a real head.
    """
    with gate_env(comment_pages=[[marker_comment(HEAD_SHA)]]) as env:
        state, _sha, depth, _at, _summary = review_record(env)
    assert (state, depth) == ("marker", "unrecorded")


def test_trivial_is_recorded_as_its_own_depth() -> None:
    """The typo/one-line carve-out the gate docs allow, made legible in the handoff."""
    with gate_env(comment_pages=[[marker_comment(HEAD_SHA, depth="trivial")]]) as env:
        _state, _sha, depth, _at, summary = review_record(env)
    assert depth == "trivial"
    assert "trivial" in summary


@pytest.mark.parametrize(
    "comments,expected_state,expected_sha",
    [
        pytest.param(
            [marker_comment(HEAD_SHA, depth="low")], "marker", HEAD_SHA, id="pins-head"
        ),
        pytest.param(
            [marker_comment(OTHER_SHA, depth="low")],
            "stale_marker",
            OTHER_SHA,
            id="stale",
        ),
        pytest.param([], "unreviewed", "", id="none"),
    ],
)
def test_record_and_gate_cannot_disagree_about_the_head(
    comments: list[dict], expected_state: str, expected_sha: str
) -> None:
    """The gate's verdict is the record's first two fields, by construction.

    Two lookups that each decided "which marker counts?" would eventually answer
    differently, and the handoff report would tell Tim a head was reviewed while
    merge-pr.sh refused it (or worse, the other way round).
    """
    with gate_env(comment_pages=[comments]) as env:
        state, sha, _depth, _at, _summary = review_record(env)
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
    assert (state, sha) == (expected_state, expected_sha)
    assert verdict.stdout.strip() == f"{expected_state} {expected_sha}".strip()
