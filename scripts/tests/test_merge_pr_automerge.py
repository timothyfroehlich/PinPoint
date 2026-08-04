"""Unit tests for merge-pr.sh --automerge.

--automerge polls the gates and merges unattended, so its three terminal states are
worth pinning down precisely: it must merge when the gates go green, stop when one
hard-fails, and give up without touching the PR when the budget runs out. A WAIT
(CI still running, review pending) must never be mistaken for either terminus.

The whole script runs against a stubbed `gh`, including the real `_pr-gates.sh` it
sources, so the gate wiring is exercised end to end. `gh pr merge` and `gh pr edit`
write to marker files instead of acting, which is how "did not merge" is asserted.
`bd` and `python3` are shadowed for the same reason: the two post-merge steps reach
outward at real shared state — the live huddle bead, and this machine's real
worktrees via `worktree_reap.py --apply`.
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

MERGE_SCRIPT = Path(__file__).parent.parent / "workflow" / "merge-pr.sh"

HEAD_SHA = "d084c14a43af3ac021f0838f5c7bf4b77f72fb62"
HEAD_REF = "feat/stub-branch"
CI_PASS = '{"name":"CI Gate","status":"COMPLETED","conclusion":"SUCCESS"}'
CI_RED = '{"name":"CI Gate","status":"COMPLETED","conclusion":"FAILURE"}'
CI_RUNNING = '{"name":"CI Gate","status":"IN_PROGRESS","conclusion":null}'

EMPTY_THREADS = json.dumps(
    {
        "data": {
            "repository": {
                "pullRequest": {
                    "reviewThreads": {
                        "pageInfo": {"hasNextPage": False, "endCursor": None},
                        "nodes": [],
                    }
                }
            }
        }
    }
)


@contextmanager
def stub_repo(
    *,
    ci_rollup: str,
    labels: list[str] | None = None,
    live_labels: list[str] | None = None,
    reap_exit: int = 0,
) -> Iterator[dict]:
    """Yield paths + env for a run against a fully stubbed `gh`.

    The PR is set up to satisfy every gate except CI: authored by the current user,
    MERGEABLE, no unresolved threads, and carrying a Claude review marker pinned to
    head. That isolates CI as the single lever each test moves.

    `live_labels` models labels changing after startup (an agent labelling the PR
    while --automerge polls); it defaults to `labels`. Every `gh` invocation is
    appended to a call log so tests can assert on ordering, not just outcomes.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        merged_marker = tmp_path / "merged"
        label_marker = tmp_path / "label-removed"
        bd_calls = tmp_path / "bd-calls"
        gh_calls = tmp_path / "gh-calls"
        py_calls = tmp_path / "py-calls"

        pr_info = json.dumps(
            {
                "author": {"login": "tim"},
                "title": "test PR (PP-test)",
                "url": "https://example.invalid/pr/123",
                "labels": [{"name": n} for n in (labels or [])],
                "headRefOid": HEAD_SHA,
                "mergeable": "MERGEABLE",
            }
        )
        comments = json.dumps(
            [{"body": f"<!-- pinpoint-claude-review: {HEAD_SHA} -->\nreviewed"}]
        )
        head_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 60))

        (tmp_path / "pr_info.json").write_text(pr_info)
        (tmp_path / "comments.json").write_text(comments)
        # No inline review comments: these tests drive the marker path, and an empty
        # answer here is the honest one rather than a fall-through that happens to work.
        (tmp_path / "review-comments.json").write_text("[]")
        (tmp_path / "threads.json").write_text(EMPTY_THREADS)
        (tmp_path / "rollup.json").write_text(ci_rollup)

        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'printf "%s\\n" "$args" >> "$STUB_GH_CALLS"\n'
            'case "$args" in\n'
            '  "pr merge"*) printf "%s\\n" "$args" > "$STUB_MERGED"; printf "merged\\n" ;;\n'
            '  "pr edit"*) printf "%s\\n" "$args" > "$STUB_LABEL_REMOVED" ;;\n'
            '  *"--json author"*) cat "$STUB_PR_INFO" ;;\n'
            '  *"--json statusCheckRollup"*) cat "$STUB_ROLLUP" ;;\n'
            '  *"--json labels"*) printf "%s\\n" "$STUB_LIVE_LABELS" ;;\n'
            '  *"--json mergeable"*) printf "MERGEABLE\\n" ;;\n'
            '  *"--jq .headRefOid"*) printf "%s\\n" "$STUB_HEAD_SHA" ;;\n'
            '  *"--json headRefOid"*) printf \'{"headRefOid":"%s"}\\n\' "$STUB_HEAD_SHA" ;;\n'
            '  *"--json headRefName"*) printf "%s\\n" "$STUB_HEAD_REF" ;;\n'
            '  "api user"*) printf "tim\\n" ;;\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *graphql*) cat "$STUB_THREADS" ;;\n'
            '  *"/commits/"*) printf "%s\\n" "$STUB_HEAD_DATE" ;;\n'
            # Trailing `*` on both comment endpoints, NOT an end anchor: the gates append
            # `?per_page=100`, and an anchored pattern silently falls through to the
            # catch-all instead of returning the markers — which reads as `unreviewed`
            # and fails the gate, several tests away from the line that caused it.
            '  *"/issues/"*"/comments"*) cat "$STUB_COMMENTS" ;;\n'
            '  *"/pulls/"*"/comments"*) cat "$STUB_REVIEW_COMMENTS" ;;\n'
            '  *"/pulls/"*"/reviews") printf "[]\\n" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        # `bd` MUST be stubbed too. After a successful merge, merge-pr.sh posts a
        # coordination notice to the live daily huddle bead via `bd comments add`.
        # Stubbing only `gh` let a test merge write real comments to real shared state
        # — six "Merged PR #123 (PP-test)" notices reached the huddle before this was
        # caught. Any test that drives a script to completion has to shadow every
        # outward-facing binary it can reach, not just the obvious one.
        bd_stub = tmp_path / "bd"
        bd_stub.write_text(
            '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$STUB_BD_CALLS"\nexit 0\n'
        )
        bd_stub.chmod(
            bd_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        # `python3` MUST be stubbed for exactly the same reason as `bd`, only the
        # blast radius is larger. After a successful merge, merge-pr.sh runs
        # `python3 scripts/worktree_reap.py --apply --repo-dir <the real repo>`.
        # Left unshadowed, a test merge would reap this machine's real worktrees.
        # merge-pr.sh and _pr-gates.sh reach python3 nowhere else, so shadowing it
        # wholesale costs nothing.
        py_stub = tmp_path / "python3"
        py_stub.write_text(
            "#!/usr/bin/env bash\n"
            'printf "%s\\n" "$*" >> "$STUB_PY_CALLS"\n'
            'exit "${STUB_PY_EXIT:-0}"\n'
        )
        py_stub.chmod(
            py_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        env = dict(os.environ)
        env["PATH"] = f"{tmp}{os.pathsep}{env.get('PATH', '')}"
        env["STUB_HEAD_SHA"] = HEAD_SHA
        env["STUB_HEAD_DATE"] = head_date
        env["STUB_PR_INFO"] = str(tmp_path / "pr_info.json")
        env["STUB_COMMENTS"] = str(tmp_path / "comments.json")
        env["STUB_REVIEW_COMMENTS"] = str(tmp_path / "review-comments.json")
        env["STUB_THREADS"] = str(tmp_path / "threads.json")
        env["STUB_ROLLUP"] = str(tmp_path / "rollup.json")
        env["STUB_MERGED"] = str(merged_marker)
        env["STUB_LABEL_REMOVED"] = str(label_marker)
        env["STUB_BD_CALLS"] = str(bd_calls)
        env["STUB_GH_CALLS"] = str(gh_calls)
        env["STUB_PY_CALLS"] = str(py_calls)
        env["STUB_PY_EXIT"] = str(reap_exit)
        env["STUB_HEAD_REF"] = HEAD_REF
        env["STUB_LIVE_LABELS"] = ",".join(
            live_labels if live_labels is not None else (labels or [])
        )
        env["AUTOMERGE_POLL_INTERVAL"] = "1"
        env["AUTOMERGE_TIMEOUT"] = "3"

        yield {
            "env": env,
            "merged": merged_marker,
            "label_removed": label_marker,
            "bd_calls": bd_calls,
            "gh_calls": gh_calls,
            "py_calls": py_calls,
        }


def run_merge(env: dict, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", str(MERGE_SCRIPT), "123", *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )


class Outcome:
    """Result plus a snapshot of the side-effect markers.

    The markers live in the stub's temp dir, which is removed when the context exits —
    so they must be read while it is still open. Asserting on the Path objects
    afterwards would make every `not ... .exists()` check vacuously true.
    """

    def __init__(self, result: subprocess.CompletedProcess, ctx: dict) -> None:
        self.result = result
        self.stdout = result.stdout
        self.stderr = result.stderr
        self.returncode = result.returncode
        self.merged = ctx["merged"].exists()
        self.merge_args = ctx["merged"].read_text() if self.merged else ""
        self.label_removed = ctx["label_removed"].exists()
        self.bd_calls = ctx["bd_calls"].read_text() if ctx["bd_calls"].exists() else ""
        self.gh_calls = (
            ctx["gh_calls"].read_text().splitlines() if ctx["gh_calls"].exists() else []
        )
        self.py_calls = (
            ctx["py_calls"].read_text().splitlines() if ctx["py_calls"].exists() else []
        )


def run_and_snapshot(ctx: dict, *args: str) -> Outcome:
    return Outcome(run_merge(ctx["env"], *args), ctx)


def test_automerge_merges_once_gates_are_green() -> None:
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 0, out.stdout + out.stderr
    assert "RESULT: all gates passed" in out.stdout
    assert "AUTOMERGE: green after" in out.stdout
    assert "MERGED: PR #123" in out.stdout
    assert out.merged, "gh pr merge should have been invoked"
    assert f"--match-head-commit={HEAD_SHA}" in out.merge_args


def test_bd_is_shadowed_so_a_test_merge_cannot_reach_the_real_huddle() -> None:
    """`bd` must resolve to the stub for every command the script can reach.

    After a successful merge, merge-pr.sh posts a coordination notice to the LIVE
    daily huddle bead via `bd comments add`. An earlier version of this harness
    stubbed only `gh`, and test merges wrote six real "Merged PR #123 (PP-test)"
    notices into shared state before anyone noticed.

    The notice itself is fail-open and usually bails before `bd` on a synthetic repo,
    so asserting on recorded calls would pass for the wrong reason. What must hold —
    and what actually broke — is that `bd` is shadowed at all.
    """
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        resolved = subprocess.run(
            ["bash", "-c", "command -v bd"],
            capture_output=True,
            text=True,
            env=ctx["env"],
        ).stdout.strip()
        stub_dir = str(ctx["bd_calls"].parent)
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert resolved.startswith(stub_dir), (
        f"bd must resolve into the stub dir, got {resolved!r} — "
        "a test merge could write to the real huddle bead"
    )
    assert out.returncode == 0, out.stdout + out.stderr
    assert "MERGED: PR #123" in out.stdout


def test_python3_is_shadowed_so_a_test_merge_cannot_reap_real_worktrees() -> None:
    """Same class of bug as the `bd` shadowing above, with a larger blast radius.

    After a successful merge, merge-pr.sh runs `worktree_reap.py --apply` against
    the repo the script lives in — this machine's real checkout, not the temp
    dir. Unshadowed, a test merge would delete real worktrees. Asserted on the
    resolution rather than on recorded calls so it holds even if the reap block
    bails early for some unrelated reason.
    """
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        resolved = subprocess.run(
            ["bash", "-c", "command -v python3"],
            capture_output=True,
            text=True,
            env=ctx["env"],
        ).stdout.strip()
        stub_dir = str(ctx["py_calls"].parent)
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert resolved.startswith(stub_dir), (
        f"python3 must resolve into the stub dir, got {resolved!r} — "
        "a test merge could reap real worktrees"
    )
    assert out.returncode == 0, out.stdout + out.stderr


def test_merge_reaps_the_merged_branchs_worktree() -> None:
    """The whole point of the post-merge hook: nothing else ever removes it.

    Scoped to the branch that just merged (`--branch`) and dry-run-free
    (`--apply`), but the verdict is still worktree_reap.py's to make — merge-pr.sh
    passes no opinion about whether the worktree is safe to remove.
    """
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 0, out.stdout + out.stderr
    assert "MERGED: PR #123" in out.stdout
    reap_calls = [c for c in out.py_calls if "worktree_reap.py" in c]
    assert len(reap_calls) == 1, out.py_calls
    assert "--apply" in reap_calls[0]
    assert f"--branch {HEAD_REF}" in reap_calls[0]


def test_a_failing_reap_does_not_change_the_merge_exit_status() -> None:
    """The merge already happened; no post-step may propagate an error.

    A non-zero reap is real information (cleanup codes 1-4 each mean something),
    but it says nothing about the merge, and `set -euo pipefail` at the top of
    the script would otherwise turn it into a failed exit on a merged PR.
    """
    with stub_repo(ci_rollup=CI_PASS, reap_exit=1) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 0, out.stdout + out.stderr
    assert "MERGED: PR #123" in out.stdout
    assert any("worktree_reap.py" in c for c in out.py_calls), out.py_calls


def test_head_is_not_re_read_between_the_last_gate_and_the_merge() -> None:
    """--match-head-commit must pin the SHA the gates evaluated, not a fresher one.

    Asserted structurally rather than by outcome: a stub that flips the SHA can't
    tell the two implementations apart, because the version that re-read head after
    the loop made that its *first* `--jq .headRefOid` call. What distinguishes them
    is *when* the read happens — before the gates, or after them. A read in the
    window between the final gate and the merge is the TOCTOU hole: it would merge
    a commit that inherited the previous commit's CI, review and thread state.
    """
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 0, out.stdout + out.stderr
    assert f"--match-head-commit={HEAD_SHA}" in out.merge_args

    merge_idx = next(i for i, c in enumerate(out.gh_calls) if c.startswith("pr merge"))
    last_gate_idx = max(
        i for i, c in enumerate(out.gh_calls) if "--json mergeable" in c
    )
    between = out.gh_calls[last_gate_idx + 1 : merge_idx]
    assert not [c for c in between if "--jq .headRefOid" in c], (
        f"head re-read after gating, before merge: {between}"
    )


def test_ci_check_not_yet_registered_is_a_wait_not_a_failure() -> None:
    """The seconds after `gh pr create` are the advertised moment to fire automerge.

    GitHub has not registered the check run yet, which used to read as a hard FAIL —
    so automerge exited RED on poll 1 and stripped the label, breaking its own
    primary use case. It must poll instead, and time out if the check never appears.
    """
    with stub_repo(ci_rollup="", labels=["ready-for-review"]) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 2, out.stdout + out.stderr
    assert "WAIT: ci: CI Gate check not reported yet" in out.stdout
    assert "AUTOMERGE: TIMED OUT" in out.stdout
    assert not out.merged
    assert not out.label_removed, "a check GitHub has not created yet is not a failure"


def test_label_is_dropped_even_when_added_after_startup() -> None:
    """--automerge can outlive the startup label snapshot by an hour."""
    with stub_repo(
        ci_rollup=CI_RED, labels=[], live_labels=["ready-for-review"]
    ) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 1, out.stdout + out.stderr
    assert out.label_removed, "label added mid-run must still be dropped on RED"


def test_automerge_stops_when_a_gate_goes_red() -> None:
    """A hard failure is terminal — polling past it would never turn it green."""
    with stub_repo(ci_rollup=CI_RED, labels=["ready-for-review"]) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 1, out.stdout + out.stderr
    assert "FAIL: ci:" in out.stdout
    assert "AUTOMERGE: RED after" in out.stdout
    assert not out.merged, "must not merge on a red gate"
    assert out.label_removed, "ready-for-review should be dropped"


def test_automerge_times_out_without_touching_the_pr() -> None:
    """CI still running is a WAIT: keep polling, then give up cleanly.

    Distinct exit code (2) and an intact label — nothing failed, it just took too long.
    """
    with stub_repo(ci_rollup=CI_RUNNING, labels=["ready-for-review"]) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge")

    assert out.returncode == 2, out.stdout + out.stderr
    assert "AUTOMERGE: TIMED OUT" in out.stdout
    assert "still waiting on: ci" in out.stdout
    assert not out.merged, "must not merge on timeout"
    assert not out.label_removed, "timeout is not a failure — keep the label"


def test_automerge_requires_human() -> None:
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--automerge")

    assert out.returncode == 1
    assert "REFUSE: merges are human-authorized only" in out.stderr
    assert not out.merged


def test_automerge_and_dry_run_are_mutually_exclusive() -> None:
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--human", "--automerge", "--dry-run")

    assert out.returncode == 1
    assert "mutually exclusive" in out.stderr
    assert not out.merged


def test_short_flag_is_accepted() -> None:
    with stub_repo(ci_rollup=CI_PASS) as ctx:
        out = run_and_snapshot(ctx, "--human", "-a")

    assert out.returncode == 0, out.stdout + out.stderr
    assert out.merged


def test_one_shot_path_is_unchanged_by_the_refactor() -> None:
    """Without --automerge the script must still evaluate once and exit.

    The gate runner was restructured to accumulate output instead of printing it; this
    pins the externally visible behaviour of the default path.
    """
    with stub_repo(ci_rollup=CI_RUNNING, labels=["ready-for-review"]) as ctx:
        out = run_and_snapshot(ctx, "--human")

    assert out.returncode == 1, out.stdout + out.stderr
    assert "WAIT: ci: CI Gate status=IN_PROGRESS" in out.stdout
    assert "RESULT: 1 gate(s) failed: ci" in out.stdout
    assert "AUTOMERGE" not in out.stdout
    assert not out.merged
    assert out.label_removed, "one-shot still drops the label on a blocked gate"
