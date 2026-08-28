"""Unit tests for scripts/workflow/merge-handoff.sh — the PR merge handoff report.

The report exists because the handoff used to be prose an agent wrote from memory, and
every number in it is one an agent can get subtly wrong. So the tests are about the
claims the block makes, not its layout:

  - the merge command appears only when the PR could actually merge, because the whole
    point of handing Tim a command is that he can run it without re-deriving readiness;
  - the diff is split into buckets that cannot silently swallow a change — a workflow or
    migration edit hiding inside "mostly docs" is the failure this format prevents;
  - migrations and newly-registered env vars are called out separately, because they are
    the two things that go wrong AT merge (prod migration on the deploy build,
    CORE-SEC-009 build gate) rather than in the diff;
  - "how far back was the review" is only reported when it is knowable.

Each test drives the real bash against a real temporary git repository and a stubbed
`gh`, so the git plumbing and the jq filters are exercised rather than mocked away.
"""

import json
import os
import stat
import subprocess
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "workflow" / "merge-handoff.sh"

PR = 123
BRANCH = "feat/thing-PP-abcd"

GIT_ENV = {
    "GIT_AUTHOR_NAME": "Test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "Test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
}


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        env={**os.environ, **GIT_ENV},
        timeout=60,
        check=True,
    )
    return result.stdout.strip()


def write(repo: Path, path: str, body: str) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body)


@dataclass
class Scenario:
    """What the stubbed GitHub says about the PR. Defaults describe a mergeable PR.

    `review` names WHICH commit Codex approved, rather than a SHA: commit hashes depend
    on commit time, so a fixture built twice does not produce the same head, and a test
    that hard-codes one would attest a commit that no longer exists.

      "head"      the approval covers head — the reviewed case
      "previous"  the approval covers head~1 — a commit was pushed after the review
      "orphan"    the approval covers a commit unrelated to the branch — post-force-push
    """

    ci_status: str = "COMPLETED"
    ci_conclusion: str = "SUCCESS"
    mergeable: str = "MERGEABLE"
    state: str = "OPEN"
    draft: bool = False
    review: str | None = None
    review_state: str = "APPROVED"
    clean_comment: bool = False
    clean_reaction: bool = False
    manual_review: bool = False
    gh_head: str = "head"
    threads: list[dict] = field(default_factory=list)
    comments: list[dict] = field(default_factory=list)
    title: str = "feat(thing): do the thing (PP-abcd)"
    branch: str = BRANCH


def codex_review(sha: str, state: str = "APPROVED") -> dict:
    return {
        "commit_id": sha,
        "state": state,
        "submitted_at": "2026-08-02T20:43:19Z",
        "user": {"login": "chatgpt-codex-connector[bot]"},
    }


# Fixed timestamps, not "now": the staleness check compares the screenshot comment's
# time against the last UI commit's, and the fixture's commits happen at run time. A
# real clock would make one of these two tests pass or fail depending on the hour.
SHOTS_AFTER_COMMITS = "2099-01-01T00:00:00Z"
SHOTS_BEFORE_COMMITS = "2000-01-01T00:00:00Z"


def screenshot_comment(at: str = SHOTS_AFTER_COMMITS) -> dict:
    return {
        "body": "<!-- pr-screenshots -->\n| desktop | mobile |",
        "updated_at": at,
    }


@contextmanager
def repo_with_pr(
    *,
    branch_changes: dict[str, str],
    scenario: Scenario | None = None,
    merge_main_in: bool = False,
    extra_branch_commit: dict[str, str] | None = None,
) -> Iterator[tuple[str, subprocess.CompletedProcess]]:
    """Build origin + a PR branch, run merge-handoff.sh against it, yield (head_sha, run).

    The PR head is published to `refs/pull/<PR>/head` on the origin remote — the same ref
    the script fetches — so no local branch has to exist for the report to work, which is
    the case that matters: Tim runs this from whatever worktree he is in.
    """
    scenario = scenario or Scenario()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        origin = tmp_path / "origin.git"
        work = tmp_path / "work"
        subprocess.run(["git", "init", "-q", "--bare", str(origin)], check=True)
        subprocess.run(["git", "init", "-q", "-b", "main", str(work)], check=True)

        write(work, "src/app/page.tsx", "export default function Page() {}\n")
        write(work, "docs/thing.md", "# thing\n")
        write(work, "next.config.ts", 'const REQUIRED = [["POSTGRES_URL"]];\n')
        git("add", "-A", cwd=work)
        git("commit", "-qm", "base", cwd=work)
        git("remote", "add", "origin", str(origin), cwd=work)
        git("push", "-q", "origin", "main", cwd=work)

        git("checkout", "-qb", scenario.branch, cwd=work)
        for path, body in branch_changes.items():
            write(work, path, body)
        git("add", "-A", cwd=work)
        git("commit", "-qm", "branch work", cwd=work)

        if merge_main_in:
            # Main moves, then is merged in — the shape §5 "sync with merge" produces.
            git("checkout", "-q", "main", cwd=work)
            write(work, "docs/other.md", "# moved on\n")
            git("add", "-A", cwd=work)
            git("commit", "-qm", "main moves", cwd=work)
            git("push", "-q", "origin", "main", cwd=work)
            git("checkout", "-q", scenario.branch, cwd=work)
            git("merge", "-q", "--no-ff", "-m", "Merge origin/main", "main", cwd=work)

        if extra_branch_commit is not None:
            for path, body in extra_branch_commit.items():
                write(work, path, body)
            git("add", "-A", cwd=work)
            git("commit", "-qm", "post-review fixup", cwd=work)

        head_sha = git("rev-parse", "HEAD", cwd=work)
        git("push", "-q", "origin", f"HEAD:refs/pull/{PR}/head", cwd=work)

        comments = list(scenario.comments)
        reviews: list[dict] = []
        if scenario.clean_comment:
            comments.append(
                {
                    "user": {"login": "chatgpt-codex-connector[bot]"},
                    "performed_via_github_app": {"slug": "chatgpt-codex-connector"},
                    "body": (
                        "Codex Review: Didn't find any major issues. Hooray!\n\n"
                        f"**Reviewed commit:** `{head_sha[:10]}`"
                    ),
                    "updated_at": "2026-08-02T20:43:19Z",
                }
            )
        if scenario.clean_reaction:
            comments.append(
                {
                    "user": {"login": "github-actions[bot]"},
                    "performed_via_github_app": {"slug": "github-actions"},
                    "body": (
                        f"<!-- pinpoint-codex-reaction-witness: {head_sha} -->\n"
                        "Trusted workflow witnessed Codex eyes-to-+1 on this head."
                    ),
                    "created_at": "2026-08-02T20:43:19Z",
                    "updated_at": "2026-08-02T20:43:19Z",
                }
            )
        if scenario.manual_review:
            comments.append(
                {
                    "body": (
                        f"<!-- pinpoint-review: {head_sha} -->\n"
                        "<!-- pinpoint-reviewer: claude-code -->\n"
                        "<!-- pinpoint-review-detail: medium -->\nreviewed"
                    ),
                    "updated_at": "2026-08-02T20:43:19Z",
                }
            )
        if scenario.review is not None:
            reviewed = {
                "head": head_sha,
                "previous": git("rev-parse", "HEAD~1", cwd=work),
                "orphan": "0" * 40,
            }[scenario.review]
            reviews.append(codex_review(reviewed, scenario.review_state))

        meta = {
            "number": PR,
            "title": scenario.title,
            "url": f"https://github.com/acme/widget/pull/{PR}",
            "headRefName": scenario.branch,
            "headRefOid": (
                head_sha
                if scenario.gh_head == "head"
                else git("rev-parse", f"HEAD~{scenario.gh_head}", cwd=work)
            ),
            "baseRefName": "main",
            "isDraft": scenario.draft,
            "state": scenario.state,
        }
        rollup = (
            ""
            if scenario.ci_status == "MISSING"
            else json.dumps(
                {
                    "name": "CI Gate",
                    "status": scenario.ci_status,
                    "conclusion": scenario.ci_conclusion,
                }
            )
        )
        threads_payload = {
            "data": {
                "repository": {
                    "pullRequest": {
                        "reviewThreads": {
                            "pageInfo": {"hasNextPage": False, "endCursor": None},
                            "nodes": scenario.threads,
                        }
                    }
                }
            }
        }

        (tmp_path / "meta.json").write_text(json.dumps(meta))
        (tmp_path / "rollup.json").write_text(rollup)
        (tmp_path / "threads.json").write_text(json.dumps(threads_payload))
        (tmp_path / "comments.json").write_text(json.dumps(comments))
        (tmp_path / "reviews.json").write_text(json.dumps(reviews))

        # Dispatches on the joined argument string, most specific first: `gh pr view`
        # carries a different --json set per caller and they must not collide.
        gh_stub = tmp_path / "gh"
        gh_stub.write_text(
            "#!/usr/bin/env bash\n"
            'args="$*"\n'
            'case "$args" in\n'
            '  *"nameWithOwner"*) printf "acme/widget\\n" ;;\n'
            '  *"statusCheckRollup"*) cat "$STUB_ROLLUP" ;;\n'
            '  *"--json mergeable"*) printf "%s\\n" "$STUB_MERGEABLE" ;;\n'
            '  *"--jq .headRefOid"*) jq -r .headRefOid "$STUB_META" ;;\n'
            '  *"pr view"*) cat "$STUB_META" ;;\n'
            '  *"api graphql"*) cat "$STUB_THREADS" ;;\n'
            '  *"/reviews"*) cat "$STUB_REVIEWS" ;;\n'
            '  *"/comments"*) cat "$STUB_COMMENTS" ;;\n'
            '  *) printf "UNEXPECTED gh call: %s\\n" "$args" >&2; exit 1 ;;\n'
            "esac\n"
        )
        gh_stub.chmod(
            gh_stub.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH
        )

        env = {
            **os.environ,
            **GIT_ENV,
            "PATH": f"{tmp}{os.pathsep}{os.environ.get('PATH', '')}",
            "STUB_META": str(tmp_path / "meta.json"),
            "STUB_ROLLUP": str(tmp_path / "rollup.json"),
            "STUB_THREADS": str(tmp_path / "threads.json"),
            "STUB_COMMENTS": str(tmp_path / "comments.json"),
            "STUB_REVIEWS": str(tmp_path / "reviews.json"),
            "STUB_MERGEABLE": scenario.mergeable,
        }
        run = subprocess.run(
            ["bash", str(SCRIPT), str(PR)],
            cwd=work,
            capture_output=True,
            text=True,
            env=env,
            timeout=120,
        )
        yield head_sha, run


MERGE_CMD = f"! scripts/workflow/merge-pr.sh {PR} --human"
RERUN_CMD = f"! bash scripts/workflow/merge-handoff.sh {PR}"


# --- The merge command is a readiness claim -----------------------------------------


def test_a_ready_pr_gets_the_merge_command() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "export const x = 1;\n"},
        scenario=Scenario(review="head"),
    ) as (_head, run):
        assert run.returncode == 0, run.stderr
        assert MERGE_CMD in run.stdout, run.stdout
        assert "NOT MERGEABLE YET" not in run.stdout


def test_a_clean_codex_reaction_gets_the_merge_command() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "export const x = 1;\n"},
        scenario=Scenario(clean_reaction=True),
    ) as (_head, run):
        assert run.returncode == 0, run.stderr
        assert "Codex clean reaction witness" in run.stdout
        assert "since review  none — the review covers head" in run.stdout
        assert MERGE_CMD in run.stdout, run.stdout


@pytest.mark.parametrize(
    "scenario,reason",
    [
        pytest.param(
            Scenario(review="head", ci_status="IN_PROGRESS"),
            "ci",
            id="ci-still-running",
        ),
        pytest.param(
            Scenario(review="head", ci_conclusion="FAILURE"), "ci", id="ci-red"
        ),
        pytest.param(
            Scenario(review="head", threads=[{"isResolved": False}]),
            "threads",
            id="open-threads",
        ),
        pytest.param(
            Scenario(review="head", mergeable="CONFLICTING"),
            "no_conflict",
            id="conflicting",
        ),
        pytest.param(Scenario(review="head", draft=True), "draft", id="draft"),
        pytest.param(Scenario(review="head", state="MERGED"), "state", id="merged"),
    ],
)
def test_an_unready_pr_gets_the_reason_instead_of_the_merge_command(
    scenario: Scenario, reason: str
) -> None:
    """Handing over a merge command while a gate is red invites a merge on a guess.

    Each case is otherwise ready — reviewed, green, clean — so the blocked outcome is
    attributable to the one gate under test.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "export const x = 1;\n"}, scenario=scenario
    ) as (_head, run):
        assert run.returncode == 0, run.stderr
        assert MERGE_CMD not in run.stdout, run.stdout
        assert "NOT MERGEABLE YET" in run.stdout
        assert reason in run.stdout


def test_an_unreviewed_head_is_named_as_the_blocker() -> None:
    """The one gate an agent cannot clear on its own — so it must be legible."""
    with repo_with_pr(branch_changes={"src/lib/thing.ts": "x\n"}) as (_head, run):
        assert MERGE_CMD not in run.stdout, run.stdout
        assert "reviewed: unreviewed" in run.stdout


def test_the_report_always_offers_to_re_run_itself() -> None:
    """Every number here is a snapshot; the re-run is how a stale block gets refreshed."""
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(ci_conclusion="FAILURE"),
    ) as (_head, run):
        assert RERUN_CMD in run.stdout, run.stdout


# --- Diff shape ---------------------------------------------------------------------


def test_the_diff_splits_source_from_tests_from_docs() -> None:
    """ "900 lines" and "880 of them docs" are different facts about the same PR."""
    with repo_with_pr(
        branch_changes={
            "src/lib/thing.ts": "export const x = 1;\n",
            "src/lib/thing.test.ts": "test1\ntest2\n",
            "docs/thing.md": "# thing\nnew\nlines\nhere\n",
        }
    ) as (_head, run):
        assert "src +1 -0" in run.stdout, run.stdout
        assert "tests +2 -0" in run.stdout
        assert "docs +3 -0" in run.stdout


def test_a_change_outside_the_three_buckets_is_still_counted() -> None:
    """`other` is what stops a workflow or config edit hiding inside "mostly docs"."""
    with repo_with_pr(
        branch_changes={
            "docs/thing.md": "# thing\nnew\n",
            ".github/workflows/ci.yml": "on: push\n",
        }
    ) as (_head, run):
        assert "other +1 -0" in run.stdout, run.stdout


def test_a_test_file_under_src_counts_as_tests_not_source() -> None:
    """Bucket order is the point: the test pattern is checked before the `src/` prefix."""
    with repo_with_pr(
        branch_changes={"src/components/Thing.test.tsx": "a\nb\nc\n"}
    ) as (_head, run):
        assert "tests +3 -0" in run.stdout, run.stdout
        assert "src +" not in run.stdout


# --- Merge-time-only risks ----------------------------------------------------------


def test_a_migration_is_called_out_by_name() -> None:
    """Migrations run against PROD on the merge build — a different risk class."""
    with repo_with_pr(
        branch_changes={"drizzle/0042_add_column.sql": "ALTER TABLE x ADD y int;\n"}
    ) as (_head, run):
        assert "drizzle/0042_add_column.sql" in run.stdout, run.stdout


def test_a_newly_registered_env_var_is_called_out() -> None:
    """CORE-SEC-009: it must be set in Vercel BEFORE the merge, or the prod build fails.

    Merge is the last moment this can be caught, and nothing else checks it.
    """
    with repo_with_pr(
        branch_changes={
            "next.config.ts": 'const REQUIRED = [["POSTGRES_URL"], ["DISCORD_WEBHOOK_URL"]];\n'
        }
    ) as (_head, run):
        assert "DISCORD_WEBHOOK_URL" in run.stdout, run.stdout


def test_no_migration_and_no_env_var_reads_as_none() -> None:
    with repo_with_pr(branch_changes={"src/lib/thing.ts": "x\n"}) as (_head, run):
        assert "migrations    none" in run.stdout, run.stdout
        assert "new env vars  none" in run.stdout


def test_ui_changes_without_screenshots_say_so() -> None:
    """A UI-touching PR needs screenshots posted; silence reads as "not applicable"."""
    with repo_with_pr(
        branch_changes={"src/components/Thing.tsx": "export const T = () => null;\n"}
    ) as (_head, run):
        assert "yes · NO screenshots posted" in run.stdout, run.stdout


def test_posted_screenshots_are_reported_with_their_timestamp() -> None:
    with repo_with_pr(
        branch_changes={"src/components/Thing.tsx": "export const T = () => null;\n"},
        scenario=Scenario(comments=[screenshot_comment()]),
    ) as (_head, run):
        assert f"screenshots posted {SHOTS_AFTER_COMMITS}" in run.stdout, run.stdout
        assert "STALE" not in run.stdout


def test_screenshots_older_than_the_last_ui_commit_are_flagged_stale() -> None:
    """ "Screenshots exist" is not "screenshots of this".

    The sticky comment survives every later push, so a UI commit landing after it leaves
    the report vouching for pictures of an older tree — the one field that was still
    "trust me" while every other claim is pinned to a commit.
    """
    with repo_with_pr(
        branch_changes={"src/components/Thing.tsx": "export const T = () => null;\n"},
        scenario=Scenario(comments=[screenshot_comment(SHOTS_BEFORE_COMMITS)]),
    ) as (_head, run):
        assert "STALE: UI changed at" in run.stdout, run.stdout


# --- Review distance ----------------------------------------------------------------


def test_a_codex_approval_covering_head_is_named_in_the_handoff() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="head"),
    ) as (_head, run):
        assert "Codex GitHub approval" in run.stdout, run.stdout
        assert "since review  none — the review covers head" in run.stdout


def test_a_clean_codex_comment_covering_head_is_merge_ready() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(clean_comment=True),
    ) as (_head, run):
        assert "Codex clean review comment" in run.stdout, run.stdout
        assert "since review  none — the review covers head" in run.stdout
        assert MERGE_CMD in run.stdout, run.stdout


def test_a_manual_attestation_covering_head_is_merge_ready() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(manual_review=True),
    ) as (_head, run):
        assert MERGE_CMD in run.stdout, run.stdout
        assert "/code-review medium" in run.stdout, run.stdout


def test_a_codex_review_with_no_open_threads_is_merge_ready() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="head", review_state="COMMENTED"),
    ) as (_head, run):
        assert "Codex GitHub review (COMMENTED)" in run.stdout, run.stdout
        assert "threads adjudicated separately" in run.stdout, run.stdout
        assert MERGE_CMD in run.stdout, run.stdout


def test_a_codex_review_with_an_open_thread_is_not_merge_ready() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(
            review="head",
            review_state="COMMENTED",
            threads=[{"isResolved": False}],
        ),
    ) as (_head, run):
        assert "Codex GitHub review (COMMENTED)" in run.stdout, run.stdout
        assert "threads: [FAIL] 1 unresolved" in run.stdout, run.stdout
        assert MERGE_CMD not in run.stdout


def test_commits_pushed_after_the_review_are_counted_and_diffed() -> None:
    """ "How many revisions back" — the question that decides re-review vs re-attest."""
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        extra_branch_commit={"src/lib/other.ts": "a\nb\n"},
        scenario=Scenario(review="previous"),
    ) as (_head, run):
        assert "STALE: 1 commit(s) back" in run.stdout, run.stdout
        assert "since review  +2 -0" in run.stdout


def test_a_review_of_an_unrelated_commit_reports_the_distance_as_unknowable() -> None:
    """After a force-push the reviewed commit is not an ancestor of head.

    Counting commits from it would produce a number, and the number would be fiction.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="orphan"),
    ) as (_head, run):
        assert "not an ancestor of head" in run.stdout, run.stdout


# --- Branch freshness ---------------------------------------------------------------


def test_a_branch_that_never_merged_main_says_when_it_branched() -> None:
    with repo_with_pr(branch_changes={"src/lib/thing.ts": "x\n"}) as (_head, run):
        assert "main merged   never — branched" in run.stdout, run.stdout


def test_merging_main_in_is_reported_with_its_distance() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        merge_main_in=True,
        extra_branch_commit={"src/lib/after.ts": "y\n"},
    ) as (_head, run):
        assert "never" not in run.stdout, run.stdout
        assert "1 commit(s) ago" in run.stdout


# --- Identification -----------------------------------------------------------------


def test_the_bead_id_is_pulled_off_the_title_or_branch() -> None:
    with repo_with_pr(branch_changes={"src/lib/thing.ts": "x\n"}) as (_head, run):
        assert "bead PP-abcd" in run.stdout, run.stdout


def test_the_branch_name_carries_the_bead_when_the_title_does_not() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(title="chore: tidy up"),
    ) as (_head, run):
        assert "bead PP-abcd" in run.stdout, run.stdout


def test_a_pr_with_no_bead_says_so_rather_than_inventing_one() -> None:
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(title="chore: tidy up", branch="chore/tidy-up"),
    ) as (_head, run):
        assert "bead none in title or branch" in run.stdout, run.stdout


# --- The head-moved race ------------------------------------------------------------


def test_a_head_that_moved_mid_report_blocks_the_merge_command() -> None:
    """`gh` and the pull ref naming different commits means no single tree was reported.

    The gate answers (Codex approval, CI, threads) come from `gh` at one SHA while the
    diff comes from git at another, so the block is not a statement about anything
    mergeable — even when every individual gate reads green.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="head", gh_head="1"),
    ) as (_head, run):
        assert run.returncode == 0, run.stderr
        assert "HEAD MOVED" in run.stdout, run.stdout
        assert "head moved mid-report" in run.stdout
        assert MERGE_CMD not in run.stdout


def test_the_race_is_detected_by_sha_not_by_a_missing_object() -> None:
    """The trap this replaced: the fetch brings down the new head's whole ancestry.

    In the race being guarded against, the SHA `gh` named IS an ancestor of what was
    fetched — `git cat-file -e` therefore always succeeded and the guard never fired,
    silently reporting gate answers for one commit and a diff for another.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="head", gh_head="1"),
    ) as (head, run):
        # The commit gh reported is a real, locally-present ancestor of head.
        assert head not in run.stdout.split("HEAD MOVED")[0]
        assert "HEAD MOVED" in run.stdout, run.stdout


def test_an_unknowable_review_distance_does_not_read_as_no_review() -> None:
    """A review exists; it is the DISTANCE that has no answer.

    "nothing reviewed to compare against" would contradict the review line two rows
    above, which names the reviewed SHA.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"},
        scenario=Scenario(review="orphan"),
    ) as (_head, run):
        assert "since review  unknowable" in run.stdout, run.stdout
        assert "nothing reviewed to compare against" not in run.stdout


# --- The command lines have to survive a paste ---------------------------------------


@pytest.mark.parametrize(
    "scenario,expected",
    [
        pytest.param(Scenario(), [RERUN_CMD], id="blocked-rerun-only"),
        pytest.param(Scenario(review="head"), [RERUN_CMD, MERGE_CMD], id="ready-both"),
    ],
)
def test_command_lines_are_flush_left_and_carry_nothing_after_the_command(
    scenario: Scenario, expected: list[str]
) -> None:
    """Tim pastes these lines. Two properties make that work, and both regressed once.

    A trailing parenthetical — "(re-run — this report is a snapshot)" — becomes shell
    arguments, and Claude Code's `!` passthrough wants the bang in column one, so a
    leading indent stops it being a command at all. Anything explaining a command goes
    on the line above it.
    """
    with repo_with_pr(
        branch_changes={"src/lib/thing.ts": "x\n"}, scenario=scenario
    ) as (_head, run):
        bang_lines = [ln for ln in run.stdout.splitlines() if "!" in ln]
        assert bang_lines == expected, bang_lines
