"""merge-pr.sh when GitHub GraphQL is refused (Claude Code cloud sessions).

The cloud proxy answers every GraphQL request with HTTP 403. `_gh-transport.sh` must
switch to REST on exactly that error and keep every gate intact: CI Gate green on head,
exact-head review coverage, zero unresolved threads (via the proxy's
`/pulls/{n}/ccr/review_threads` route, failing closed), and no conflict. The merge itself
goes through `PUT /pulls/{n}/merge` pinned to the audited head SHA.

The stub `gh` answers every GraphQL-backed command (`gh pr view`, `gh repo view`,
`gh pr merge`, `gh pr edit`, `gh api graphql`) with the proxy's 403, so any path that
still reached GraphQL would fail the run.
"""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

MERGE_SCRIPT = Path(__file__).parent.parent / "workflow" / "merge-pr.sh"
HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
OLD_SHA = "0000000000000000000000000000000000000000"
GRAPHQL_403 = (
    "HTTP 403: GitHub GraphQL is not available from Claude Code sessions; "
    "use the REST API (gh api repos/{owner}/{repo}/...)."
)


def check_run(status: str = "completed", conclusion: str | None = "success") -> dict:
    return {
        "name": "CI Gate",
        "status": status,
        "conclusion": conclusion,
        "started_at": "2026-09-25T10:00:00Z",
        "completed_at": "2026-09-25T10:10:00Z" if status == "completed" else None,
        "details_url": "https://example.invalid/run",
    }


def pull(*, mergeable: bool | None = True, labels: list[str] | None = None) -> dict:
    return {
        "user": {"login": "tim"},
        "title": "test PR",
        "html_url": "https://example.invalid/pr/123",
        "labels": [{"name": n} for n in (labels or [])],
        "head": {"sha": HEAD_SHA, "ref": "feat/stub"},
        "base": {"ref": "main"},
        "mergeable": mergeable,
        "state": "open",
        "merged": False,
        "merged_at": None,
        "merge_commit_sha": None,
    }


APPROVAL = {
    "commit_id": HEAD_SHA,
    "state": "APPROVED",
    "submitted_at": "2026-09-25T11:00:00Z",
    "user": {"login": "coderabbitai[bot]"},
    "body": "LGTM",
}


@contextmanager
def cloud_stub(
    *,
    pr: dict | None = None,
    check_runs: list[dict] | None = None,
    reviews: list[dict] | None = None,
    threads: object = None,
    threads_exit: int = 0,
    graphql_error: str = GRAPHQL_403,
) -> Iterator[dict]:
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / "pull.json").write_text(json.dumps(pr or pull()))
        (t / "checks.json").write_text(
            json.dumps(
                {
                    "total_count": 1,
                    "check_runs": check_runs
                    if check_runs is not None
                    else [check_run()],
                }
            )
        )
        (t / "reviews.json").write_text(
            json.dumps(reviews if reviews is not None else [APPROVAL])
        )
        (t / "threads.json").write_text(
            json.dumps(threads if threads is not None else [])
        )
        (t / "graphql_error").write_text(graphql_error)

        gh = t / "gh"
        gh.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'printf "%s\\n" "$args" >> "$STUB/calls"\n'
            'case "$args" in\n'
            '  "pr "*|"repo "*|"api graphql"*) cat "$STUB/graphql_error" >&2; exit 1 ;;\n'
            '  "api -X PUT repos/acme/widget/pulls/123/merge"*) '
            'printf "%s\\n" "$args" > "$STUB/merged"; '
            'printf "Pull Request successfully merged\\n" ;;\n'
            '  "api -X DELETE repos/acme/widget/issues/123/labels/"*) '
            'printf "%s\\n" "$args" > "$STUB/label_removed" ;;\n'
            '  "api --paginate repos/acme/widget/pulls/123/ccr/review_threads") '
            'cat "$STUB/threads.json"; exit "$STUB_THREADS_EXIT" ;;\n'
            '  "api --paginate repos/acme/widget/commits/'
            + HEAD_SHA
            + '/check-runs"*) cat "$STUB/checks.json" ;;\n'
            '  "api --paginate repos/acme/widget/pulls/123/reviews") cat "$STUB/reviews.json" ;;\n'
            '  "api --paginate repos/acme/widget/issues/123/comments") printf "[]\\n" ;;\n'
            '  "api repos/acme/widget/pulls/123") cat "$STUB/pull.json" ;;\n'
            '  "api user --jq .login") printf "tim\\n" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        # python3 is shadowed so a test merge never runs worktree_reap.py --apply
        # against this machine's real worktrees.
        py = t / "python3"
        py.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$STUB/py"\n')
        for f in (gh, py):
            f.chmod(f.stat().st_mode | stat.S_IEXEC)

        env = dict(os.environ)
        env.pop("PINPOINT_GH_TRANSPORT", None)
        env["PATH"] = f"{tmp}{os.pathsep}{env.get('PATH', '')}"
        env["STUB"] = tmp
        env["STUB_THREADS_EXIT"] = str(threads_exit)
        env["GH_REPO"] = "acme/widget"
        yield {"env": env, "dir": t}


def run(ctx: dict, *args: str) -> tuple[subprocess.CompletedProcess, dict]:
    result = subprocess.run(
        ["bash", str(MERGE_SCRIPT), "123", *args],
        capture_output=True,
        text=True,
        env=ctx["env"],
        timeout=60,
    )
    t = ctx["dir"]
    calls = (t / "calls").read_text().splitlines() if (t / "calls").exists() else []
    return result, {
        "calls": calls,
        "merged": (t / "merged").read_text() if (t / "merged").exists() else None,
        "label_removed": (t / "label_removed").exists(),
    }


def graphql_attempts(calls: list[str]) -> list[str]:
    return [c for c in calls if c.startswith(("pr ", "repo ", "api graphql"))]


def test_green_pr_merges_through_rest_pinned_to_head() -> None:
    with cloud_stub() as ctx:
        result, side = run(ctx, "--human")

    out = result.stdout
    assert result.returncode == 0, out + result.stderr
    assert "PASS: ci: CI Gate conclusion=SUCCESS" in out
    assert "PASS: threads: 0 unresolved review threads" in out
    assert "PASS: reviewed: CodeRabbit approved head SHA d084c14" in out
    assert "PASS: no_conflict: MERGEABLE" in out
    assert "MERGED: PR #123" in out
    assert side["merged"] is not None
    assert "merge_method=squash" in side["merged"]
    assert f"sha={HEAD_SHA}" in side["merged"]
    # The 403 is paid once, at the top-level PR_INFO read; everything after is REST.
    assert graphql_attempts(side["calls"]) == [
        "pr view 123 --json author,title,url,labels,headRefOid,mergeable,state,mergedAt,mergeCommit"
    ]
    assert GRAPHQL_403 not in result.stderr


def test_automerge_waits_on_running_ci_then_stops_at_timeout() -> None:
    with cloud_stub(check_runs=[check_run("in_progress", None)]) as ctx:
        ctx["env"]["AUTOMERGE_POLL_INTERVAL"] = "0.05"
        ctx["env"]["AUTOMERGE_TIMEOUT"] = "1"
        result, side = run(ctx, "--human", "--automerge")

    assert result.returncode == 2, result.stdout + result.stderr
    assert "WAIT: ci: CI Gate status=IN_PROGRESS" in result.stdout
    assert "TIMED OUT" in result.stdout
    assert side["merged"] is None
    assert len(graphql_attempts(side["calls"])) == 1


def test_red_ci_blocks_and_drops_label_through_rest() -> None:
    with cloud_stub(
        pr=pull(labels=["ready-for-review"]),
        check_runs=[check_run(conclusion="failure")],
    ) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "FAIL: ci: CI Gate conclusion=FAILURE" in result.stdout
    assert side["merged"] is None
    assert side["label_removed"]


def test_unresolved_thread_blocks() -> None:
    threads = [{"id": "t1", "is_resolved": True}, {"id": "t2", "is_resolved": False}]
    with cloud_stub(threads=threads) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "FAIL: threads: 1 unresolved review threads" in result.stdout
    assert side["merged"] is None


def test_thread_route_failure_fails_closed() -> None:
    with cloud_stub(threads_exit=1) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "FAIL: threads: could not read review threads" in result.stdout
    assert side["merged"] is None


def test_unrecognized_thread_payload_fails_closed() -> None:
    # A thread without a boolean resolution flag must never count as resolved.
    with cloud_stub(threads=[{"id": "t1", "state": "open"}]) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "FAIL: threads: could not read review threads" in result.stdout
    assert side["merged"] is None


def test_wrapped_thread_payload_is_read() -> None:
    threads = {"review_threads": [{"isResolved": True}, {"isResolved": True}]}
    with cloud_stub(threads=threads) as ctx:
        result, _ = run(ctx, "--human")

    assert "PASS: threads: 0 unresolved review threads" in result.stdout


def test_stale_review_blocks() -> None:
    stale = dict(APPROVAL, commit_id=OLD_SHA)
    with cloud_stub(reviews=[stale]) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "FAIL: reviewed: stale review" in result.stdout
    assert side["merged"] is None


def test_conflict_blocks() -> None:
    with cloud_stub(pr=pull(mergeable=False)) as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode == 1
    assert "BLOCK: no_conflict: CONFLICTING" in result.stdout
    assert side["merged"] is None


def test_dry_run_prints_rest_merge() -> None:
    with cloud_stub() as ctx:
        result, side = run(ctx, "--dry-run")

    assert result.returncode == 0, result.stdout + result.stderr
    assert (
        "DRY RUN: would run: gh api -X PUT repos/acme/widget/pulls/123/merge "
        f"-f merge_method=squash -f sha={HEAD_SHA}"
    ) in result.stdout
    assert side["merged"] is None


def test_other_graphql_errors_do_not_fall_back() -> None:
    # Only the Claude Code 403 switches transports; any other GraphQL failure still
    # stops the run where it did before, with gh's own error visible.
    with cloud_stub(graphql_error="HTTP 502: Bad Gateway") as ctx:
        result, side = run(ctx, "--human")

    assert result.returncode != 0
    assert "HTTP 502: Bad Gateway" in result.stderr
    assert side["merged"] is None
    assert not any(c.startswith("api repos/") for c in side["calls"])
