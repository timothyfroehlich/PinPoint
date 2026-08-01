"""Classifier tests for worktree_reap.py (PP-49x5).

This script deletes worktrees, so the only thing worth testing hard is the
predicate that decides which ones. Two mistakes in it destroy real work:

1. **Treating "no open PR + clean" as finished.** That is `stale-worktrees.sh`'s
   rule, and it is indistinguishable from an agent that is working right now and
   has not opened its PR yet. At the moment PP-49x5 was measured, zero worktrees
   had an open PR while at least two agents were live. So a reap must rest on
   *positive proof* — merged-SHA equality, or zero commits ahead of
   `origin/main` — never on the absence of a PR.
2. **Testing mergedness with `git merge-base --is-ancestor`.** PinPoint
   squash-merges, so a merged branch's commits are never ancestors of `main`.
   An is-ancestor implementation returns "not merged" for *every* merged branch
   — it fails safe, but it also makes the tool useless, and the temptation to
   then relax the predicate is how the destructive version gets written.
   `test_squash_merged_branch_is_still_reaped` is the guard.

Real throwaway git repositories with real worktrees, so the commit graph
questions get real answers; `gh` is stubbed on PATH, so no test ever reaches
GitHub. `worktree_cleanup.py` is stubbed too — nothing here removes anything.
"""

import json
import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import worktree_reap as reap  # noqa: E402

GH_STUB = """#!/usr/bin/env bash
if [[ -n "${GH_STUB_FAIL:-}" ]]; then
  echo "gh: could not connect to api.github.com" >&2
  exit 1
fi
branch=""
prev=""
for a in "$@"; do
  if [[ "$prev" == "--head" ]]; then branch="$a"; fi
  prev="$a"
done
file="$GH_STUB_DIR/${branch//\\//__}.json"
if [[ -f "$file" ]]; then cat "$file"; else echo "[]"; fi
"""


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


class World:
    """An origin + a checkout + as many worktrees as a test needs."""

    def __init__(self, tmp_path: Path) -> None:
        self.root = tmp_path
        self.origin = tmp_path / "origin.git"
        self.repo = tmp_path / "repo"
        self.worktrees = tmp_path / "worktrees"
        self.gh_data = tmp_path / "ghdata"
        self.gh_data.mkdir()
        self.worktrees.mkdir()

        subprocess.run(
            ["git", "init", "--bare", "-b", "main", str(self.origin)],
            check=True,
            capture_output=True,
        )
        self.repo.mkdir()
        git("init", "-b", "main", cwd=self.repo)
        git("config", "user.email", "test@example.invalid", cwd=self.repo)
        git("config", "user.name", "Test", cwd=self.repo)
        git("config", "commit.gpgsign", "false", cwd=self.repo)
        git("remote", "add", "origin", str(self.origin), cwd=self.repo)
        self.commit_on_main("README.md", "hello\n")
        git("push", "-u", "origin", "main", cwd=self.repo)

        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        gh = bin_dir / "gh"
        gh.write_text(GH_STUB)
        gh.chmod(gh.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        self.bin_dir = bin_dir

    def commit_on_main(self, name: str, content: str) -> str:
        (self.repo / name).write_text(content)
        git("add", name, cwd=self.repo)
        git("commit", "-m", f"main: {name}", cwd=self.repo)
        return git("rev-parse", "HEAD", cwd=self.repo)

    def add_worktree(self, branch: str) -> Path:
        path = self.worktrees / branch.replace("/", "__")
        git("worktree", "add", str(path), "-b", branch, cwd=self.repo)
        return path

    def add_detached_worktree(self, name: str) -> Path:
        path = self.worktrees / name
        git("worktree", "add", "--detach", str(path), "origin/main", cwd=self.repo)
        return path

    def commit_in(self, worktree: Path, name: str, content: str) -> str:
        (worktree / name).write_text(content)
        git("add", name, cwd=worktree)
        git("commit", "-m", f"work: {name}", cwd=worktree)
        return git("rev-parse", "HEAD", cwd=worktree)

    def set_prs(self, branch: str, *prs: dict[str, object]) -> None:
        target = self.gh_data / f"{branch.replace('/', '__')}.json"
        target.write_text(json.dumps(list(prs)))


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    built = World(tmp_path)
    monkeypatch.setenv("PATH", f"{built.bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("GH_STUB_DIR", str(built.gh_data))
    monkeypatch.delenv("GH_STUB_FAIL", raising=False)
    # The cwd guard would otherwise depend on where pytest was launched from.
    monkeypatch.chdir(tmp_path)
    # Defence-in-depth only, and a real /proc scan makes results depend on what
    # else is running on the host. Tests that care about it patch it back.
    monkeypatch.setattr(reap, "live_process_cwds", lambda: (set(), None))
    return built


def run_reap(
    world: World,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    *extra: str,
) -> tuple[int, str, str]:
    monkeypatch.setattr(
        sys, "argv", ["worktree_reap.py", "--repo-dir", str(world.repo), *extra]
    )
    code = reap.main()
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def tier_of(stderr: str, branch: str) -> str:
    """Read one branch's tier back out of the dry-run report."""
    section = None
    for line in stderr.splitlines():
        if line.startswith("REAP ("):
            section = reap.TIER_REAP
        elif line.startswith("REVIEW —"):
            section = reap.TIER_REVIEW
        elif line.startswith("KEEP —"):
            section = reap.TIER_KEEP
        elif line.strip().startswith(f"- {branch} ["):
            assert section is not None
            return section
    raise AssertionError(f"{branch} not present in report:\n{stderr}")


class TestMergedTier:
    """A merged PR only earns a reap when HEAD *is* the SHA that merged."""

    def test_merged_pr_at_the_merged_sha_with_a_clean_tree_is_reaped(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/landed")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/landed",
            {"number": 10, "state": "MERGED", "headRefOid": sha},
        )

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/landed") == reap.TIER_REAP
        assert "[merged" in err

    def test_squash_merged_branch_is_still_reaped(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """The regression guard: an is-ancestor implementation FAILS this.

        The squash commit on `main` carries the same content under a different
        SHA, so the branch tip is not reachable from `origin/main` — exactly the
        shape of every merged PinPoint branch. SHA equality against the PR's
        `headRefOid` is the only test that answers correctly here.
        """
        wt = world.add_worktree("feat/squashed")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/squashed",
            {"number": 11, "state": "MERGED", "headRefOid": sha},
        )
        # The squash landing: same content, new SHA, on main.
        world.commit_on_main("feature.py", "print(1)\n")
        git("push", "origin", "main", cwd=world.repo)

        ancestor = subprocess.run(
            ["git", "-C", str(wt), "merge-base", "--is-ancestor", sha, "origin/main"],
            capture_output=True,
        )
        assert ancestor.returncode != 0, "premise: a squashed tip is not an ancestor"

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/squashed") == reap.TIER_REAP

    def test_commits_after_the_merge_downgrade_to_review(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/kept-going")
        merged_sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/kept-going",
            {"number": 12, "state": "MERGED", "headRefOid": merged_sha},
        )
        world.commit_in(wt, "more.py", "print(2)\n")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/kept-going") == reap.TIER_REVIEW
        assert "commits after the merge" in err

    def test_dirty_tree_downgrades_a_merged_worktree_to_review(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/dirty")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/dirty", {"number": 13, "state": "MERGED", "headRefOid": sha}
        )
        (wt / "feature.py").write_text("print(1)\nprint('uncommitted')\n")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/dirty") == reap.TIER_REVIEW
        assert "working tree is dirty" in err


class TestEmptyTier:
    """No PR is never itself evidence — only "carries nothing" is."""

    def test_no_pr_and_zero_commits_ahead_is_reaped(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        world.add_worktree("worktree-bridge-idle")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "worktree-bridge-idle") == reap.TIER_REAP
        assert "[empty" in err

    def test_no_pr_with_a_commit_is_review_not_reap(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """An agent mid-task has commits and no PR yet. It must survive."""
        wt = world.add_worktree("feat/in-progress")
        world.commit_in(wt, "wip.py", "print('wip')\n")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/in-progress") == reap.TIER_REVIEW
        assert "1 commit(s) ahead of origin/main" in err

    def test_a_closed_unmerged_pr_is_not_evidence_that_anything_landed(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """CLOSED is judged exactly like "no PR" — on what the branch carries."""
        wt = world.add_worktree("feat/abandoned")
        sha = world.commit_in(wt, "wip.py", "print('wip')\n")
        world.set_prs(
            "feat/abandoned", {"number": 14, "state": "CLOSED", "headRefOid": sha}
        )

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/abandoned") == reap.TIER_REVIEW
        assert "1 commit(s) ahead of origin/main" in err

    def test_a_detached_worktree_at_origin_main_is_reaped_as_empty(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """No branch means no ref a PR could point at — a known "no PR", not unknown."""
        world.add_detached_worktree("detached-residue")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "(detached)") == reap.TIER_REAP
        assert "[empty" in err

    def test_untracked_file_alone_blocks_the_empty_reap(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """The sharpest real case: a plan doc that exists nowhere else on disk.

        Zero commits ahead and no PR, so every other signal says "residue". The
        untracked file is the only thing standing between it and deletion.
        """
        wt = world.add_worktree("worktree-bridge-with-notes")
        (wt / "PLAN.md").write_text("the only copy of this document\n")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "worktree-bridge-with-notes") == reap.TIER_REVIEW
        assert (wt / "PLAN.md").exists()

    def test_gitignored_files_do_not_count_as_dirt(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """Every worktree carries generated `.env.local` / `supabase/config.toml`.

        If those read as dirt, nothing is ever reapable and the tool is inert.
        """
        world.commit_on_main(".gitignore", ".env.local\n")
        git("push", "origin", "main", cwd=world.repo)
        wt = world.add_worktree("worktree-bridge-generated")
        (wt / ".env.local").write_text("PORT=3010\n")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "worktree-bridge-generated") == reap.TIER_REAP


class TestKeepTier:
    def test_open_pr_is_kept(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/under-review")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/under-review", {"number": 20, "state": "OPEN", "headRefOid": sha}
        )

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/under-review") == reap.TIER_KEEP
        assert "open PR #20" in err

    def test_an_open_pr_outranks_an_older_merged_one_on_the_same_branch(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/reused")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/reused",
            {"number": 21, "state": "MERGED", "headRefOid": sha},
            {"number": 22, "state": "OPEN", "headRefOid": sha},
        )

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "feat/reused") == reap.TIER_KEEP

    def test_a_live_process_cwd_keeps_an_otherwise_reapable_worktree(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("worktree-bridge-busy")
        monkeypatch.setattr(
            reap, "live_process_cwds", lambda: ({str(wt / "src")}, None)
        )

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "worktree-bridge-busy") == reap.TIER_KEEP

    def test_the_invoking_processs_own_worktree_is_never_reaped(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("worktree-bridge-self")
        monkeypatch.chdir(wt)

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_OK, err
        assert tier_of(err, "worktree-bridge-self") == reap.TIER_KEEP
        assert "invoking process's cwd" in err

    def test_the_main_worktree_is_not_even_considered(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        world.add_worktree("worktree-bridge-idle")

        _, _, err = run_reap(world, monkeypatch, capsys)

        assert str(world.repo) not in err


class TestGhUnavailable:
    def test_an_unreachable_gh_reaps_nothing_and_exits_non_zero(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """Absence of evidence is never evidence of mergedness.

        Note what the "empty" worktree does here: with `gh` down it has zero
        commits ahead and a clean tree, which is the whole of the empty
        predicate — but its PR state is UNKNOWN, not "no PR", so it must NOT be
        reaped. That distinction is the difference between a `gh` outage being
        a no-op and being a mass deletion.
        """
        wt = world.add_worktree("feat/landed")
        sha = world.commit_in(wt, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/landed", {"number": 30, "state": "MERGED", "headRefOid": sha}
        )
        world.add_worktree("worktree-bridge-idle")
        monkeypatch.setenv("GH_STUB_FAIL", "1")

        code, _, err = run_reap(world, monkeypatch, capsys)

        assert code == reap.EXIT_GH_UNAVAILABLE
        assert "REAP (0 merged, 0 empty): 0" in err
        assert "PR state UNKNOWN for 2 branch(es)" in err
        assert tier_of(err, "feat/landed") == reap.TIER_REVIEW
        assert tier_of(err, "worktree-bridge-idle") == reap.TIER_REVIEW

    def test_apply_with_an_unreachable_gh_removes_nothing(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        world.add_worktree("worktree-bridge-idle")
        monkeypatch.setenv("GH_STUB_FAIL", "1")
        cleanup, calls = fake_cleanup(world, monkeypatch, exit_code=0)

        code, out, _ = run_reap(world, monkeypatch, capsys, "--apply")

        assert code == reap.EXIT_GH_UNAVAILABLE
        assert not calls.exists(), f"cleanup must not run: {cleanup}"
        assert "REAPED:" not in out


def fake_cleanup(
    world: World,
    monkeypatch: pytest.MonkeyPatch,
    *,
    exit_code: int,
    per_path: dict[str, int] | None = None,
) -> tuple[Path, Path]:
    """Stand in for worktree_cleanup.py, recording paths and returning a code."""
    calls = world.root / "cleanup-calls"
    script = world.root / "fake_cleanup.py"
    script.write_text(
        "import sys\n"
        f"calls = {str(calls)!r}\n"
        f"per_path = {per_path or {}!r}\n"
        "target = sys.argv[1]\n"
        "open(calls, 'a').write(target + '\\n')\n"
        "print('fake cleanup ran for ' + target, file=sys.stderr)\n"
        f"sys.exit(per_path.get(target, {exit_code}))\n"
    )
    monkeypatch.setattr(reap, "CLEANUP_SCRIPT", script)
    return script, calls


class TestApply:
    def test_apply_delegates_to_worktree_cleanup_and_announces_on_stdout(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("worktree-bridge-idle")
        _, calls = fake_cleanup(world, monkeypatch, exit_code=0)

        code, out, _ = run_reap(world, monkeypatch, capsys, "--apply")

        assert code == reap.EXIT_OK
        assert calls.read_text().splitlines() == [str(wt)]
        # stdout, so merge-pr.sh can surface it next to `MERGED:`.
        assert f"REAPED: {wt}" in out

    def test_apply_leaves_review_worktrees_alone(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/in-progress")
        world.commit_in(wt, "wip.py", "print('wip')\n")
        _, calls = fake_cleanup(world, monkeypatch, exit_code=0)

        code, _, _ = run_reap(world, monkeypatch, capsys, "--apply")

        assert code == reap.EXIT_OK
        assert not calls.exists()

    def test_cleanups_exit_code_is_propagated_not_flattened(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """PP-r7tv: collapsing 4 into "failed" loses the only leak signal.

        4 means the worktree WAS removed but Supabase volume state was unknown,
        so volumes may have leaked. A caller told "failed" would go looking for
        a worktree that is gone and never sweep for the volumes.
        """
        world.add_worktree("worktree-bridge-idle")
        fake_cleanup(world, monkeypatch, exit_code=4)

        code, _, err = run_reap(world, monkeypatch, capsys, "--apply")

        assert code == 4, "must be cleanup's own code, not a generic failure"
        assert "volume state was UNKNOWN" in err
        assert "FAILED" not in err

    def test_distinct_cleanup_codes_are_reported_individually(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """No single code is honest for two different failures — say so."""
        first = world.add_worktree("worktree-bridge-a")
        second = world.add_worktree("worktree-bridge-b")
        fake_cleanup(
            world,
            monkeypatch,
            exit_code=0,
            per_path={str(first): 1, str(second): 4},
        )

        code, _, err = run_reap(world, monkeypatch, capsys, "--apply")

        assert code == reap.EXIT_CLEANUP_MIXED
        assert "FAILED — worktree not removed" in err
        assert "volume state was UNKNOWN" in err


class TestBranchFilter:
    def test_branch_filter_scopes_the_run_to_one_worktree(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """merge-pr.sh reaps exactly the branch it just merged, nothing else."""
        target = world.add_worktree("feat/landed")
        sha = world.commit_in(target, "feature.py", "print(1)\n")
        world.set_prs(
            "feat/landed", {"number": 40, "state": "MERGED", "headRefOid": sha}
        )
        world.add_worktree("worktree-bridge-idle")
        _, calls = fake_cleanup(world, monkeypatch, exit_code=0)

        code, out, _ = run_reap(
            world, monkeypatch, capsys, "--apply", "--branch", "feat/landed"
        )

        assert code == reap.EXIT_OK
        assert calls.read_text().splitlines() == [str(target)]
        assert "worktree-bridge-idle" not in out

    def test_a_branch_with_no_worktree_is_a_silent_no_op(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        world.add_worktree("worktree-bridge-idle")
        _, calls = fake_cleanup(world, monkeypatch, exit_code=0)

        code, out, _ = run_reap(
            world, monkeypatch, capsys, "--apply", "--quiet", "--branch", "feat/gone"
        )

        assert code == reap.EXIT_OK
        assert not calls.exists()
        assert out == ""


class TestQuiet:
    def test_quiet_dry_run_prints_one_nudge_and_never_shells_out_to_du(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """The SessionStart hook runs this under a 10s cap; `du` over 60 GB blows it."""
        world.add_worktree("worktree-bridge-idle")
        monkeypatch.setattr(
            reap,
            "directory_size_kib",
            lambda _path: pytest.fail("--quiet must not call du"),
        )

        code, _, err = run_reap(world, monkeypatch, capsys, "--quiet")

        assert code == reap.EXIT_OK
        assert "1 worktree(s) already landed and reclaimable" in err
        assert "python3 scripts/worktree_reap.py --apply" in err

    def test_quiet_dry_run_is_silent_when_there_is_nothing_to_reclaim(
        self,
        world: World,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        wt = world.add_worktree("feat/in-progress")
        world.commit_in(wt, "wip.py", "print('wip')\n")

        code, out, err = run_reap(world, monkeypatch, capsys, "--quiet")

        assert code == reap.EXIT_OK
        assert out == ""
        assert err == ""
