#!/usr/bin/env python3
"""
worktree_reap.py — remove agent worktrees whose work has already landed.

Nothing else in PinPoint removes a worktree that is still on disk. Three
mechanisms exist and each covers a different slice; none covers this one:

- The `WorktreeRemove` hook (`worktree_cleanup.py`) only fires when something
  *else* initiates removal. A background agent that commits, pushes and ends
  leaves its directory in place, so nothing ever initiates.
- `worktree_orphan_sweep.py` reconciles slot entries whose directory is *gone*.
  A worktree still on disk is "active" by its definition — invisible to the
  sweep, and its Supabase volumes are deliberately protected there.
- `scripts/stale-worktrees.sh` is hard-scoped to `../pinpoint-worktrees/*`.

**The predicate matters more than the plumbing.** `stale-worktrees.sh` uses
"no open PR + clean tree", which is indistinguishable from an agent that is
working right now and has not opened its PR yet — at the time this script was
written, zero worktrees had an open PR while at least two agents were live, so
that rule would have deleted live work. **The absence of a PR is never the
liveness signal.** This script reaps only on *positive proof that the work is
already on `main`*:

- REAP/merged — the branch has a merged PR, the local `HEAD` is *exactly* that
  PR's `headRefOid`, and the tree is clean. SHA equality is load-bearing:
  branches are squash-merged, so their commits are never ancestors of `main`
  and an `is-ancestor` test gives a false negative on every one of them. A
  `HEAD` that moved past the merged SHA is post-merge work → REVIEW.
- REAP/empty — no merged or open PR, clean tree, and *zero* commits ahead of
  `origin/main`. Nothing unique exists on the branch, so there is nothing to lose.
- REVIEW — anything with unmerged commits or a dirty tree (untracked files
  count). Reported every run, never touched.
- KEEP — an open PR, or a live process whose cwd is inside the worktree.

**Unknown is never mergedness.** If `gh` cannot be queried, the affected
branches are UNKNOWN, not "no PR": they classify REVIEW, never REAP, and the
run exits non-zero. Same discipline as the sweep's "unknown is never zero"
(`worktree_orphan_sweep.py:25`) and `worktree_cleanup.py`'s volume query.

Removal delegates to `worktree_cleanup.py`, which already owns `supabase stop`,
Docker volume removal, slot deallocation and `git worktree remove`. Its exit
codes are reported per worktree with their meanings rather than flattened into
"failed" — flattening them is the standing complaint in PP-r7tv.

Dry-run by default; `--apply` to act.
"""

import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from worktree_orphan_sweep import get_active_worktree_branches  # noqa: E402

CLEANUP_SCRIPT = Path(__file__).resolve().parent / "worktree_cleanup.py"

#: Nothing to do, or everything asked for succeeded.
EXIT_OK = 0
#: At least one branch's PR state could not be determined, so the report is
#: incomplete and nothing that depended on that state was reaped. Deliberately
#: the same value as `worktree_orphan_sweep.EXIT_DOCKER_UNKNOWN`: in both
#: scripts, 1 means "this run could not see everything".
EXIT_GH_UNAVAILABLE = 1
#: `--apply` hit more than one distinct `worktree_cleanup.py` failure code, so
#: there is no single code to propagate. Picked above cleanup's range (0-4) so
#: it can never be confused with one of them. Each worktree's own code is still
#: printed with its meaning.
EXIT_CLEANUP_MIXED = 5

#: `worktree_cleanup.py`'s exit codes, spelled out. A caller that collapses
#: these into "failed" throws away the only signal that says whether anything
#: leaked (PP-r7tv), so every one of them is surfaced verbatim.
CLEANUP_EXIT_MEANINGS = {
    0: "cleaned up",
    1: "FAILED — worktree not removed; slot kept to avoid a port collision",
    2: "REFUSED — target is the main worktree",
    3: "STALE TARGET — path gone but slot/git residue remains",
    4: "removed, but Supabase volume state was UNKNOWN — volumes may have leaked",
}

#: How many `gh pr list` lookups to run at once. One process per branch, so this
#: is bounded by process spawn cost, not by the API: ~60 branches finish in
#: under 2s at 12, which keeps the SessionStart hook inside its 10s ceiling.
GH_CONCURRENCY = 12

TIER_REAP = "REAP"
TIER_REVIEW = "REVIEW"
TIER_KEEP = "KEEP"


@dataclass(frozen=True)
class PrLookup:
    """Pull requests whose head is one branch, or an explicit unknown.

    `unknown_reason is None` means `prs` is trustworthy — empty really means
    "this branch has no pull request". Otherwise `prs` is empty only because we
    could not look, and *no* classification may read it as "no PR": that
    reading is what would turn a `gh` outage into a mass deletion.
    """

    prs: tuple[dict[str, object], ...] = ()
    unknown_reason: str | None = None

    def __post_init__(self) -> None:
        if self.unknown_reason is not None and self.prs:
            raise ValueError("an unknown PrLookup cannot also carry pull requests")

    @property
    def is_unknown(self) -> bool:
        return self.unknown_reason is not None

    def pick(self) -> dict[str, object] | None:
        """The PR that decides this branch's fate.

        An OPEN one always wins — it is the KEEP signal and outranks any older
        merged PR on a reused branch name. Otherwise the newest PR by number,
        so a branch that was merged and then re-opened-and-closed is judged on
        its latest outcome rather than its first.
        """
        if not self.prs:
            return None
        open_prs = [pr for pr in self.prs if pr.get("state") == "OPEN"]
        pool = open_prs or list(self.prs)
        return max(pool, key=lambda pr: int(pr.get("number") or 0))


@dataclass(frozen=True)
class GitState:
    """What the worktree's own git says. `None` anywhere means unknown."""

    head: str | None = None
    dirty: bool | None = None
    ahead: int | None = None


@dataclass(frozen=True)
class Verdict:
    """One worktree's tier plus the sentence explaining why it landed there.

    `reason` doubles as the REAP sub-tier (`merged` / `empty`), which is what
    the summary counts split on.
    """

    path: str
    branch: str
    tier: str
    reason: str


def query_branch_prs(branch: str) -> PrLookup:
    """Ask GitHub for every PR whose head is `branch`.

    `gh pr list --head` is used rather than a GraphQL `ref` lookup on purpose:
    the repo auto-deletes branches on merge, so the ref is *gone* for exactly
    the merged branches this script exists to find, and a ref query returns
    null for all of them.
    """
    if not branch:
        # A detached worktree has no branch to look up. That is a known "no PR",
        # not an unknown: there is no ref for a PR to point at.
        return PrLookup()
    try:
        result = subprocess.run(
            [
                "gh",
                "pr",
                "list",
                "--head",
                branch,
                "--state",
                "all",
                "--limit",
                "20",
                "--json",
                "number,state,headRefOid,headRefName",
            ],
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        return PrLookup(unknown_reason=f"could not run `gh pr list`: {exc}")
    if result.returncode != 0:
        detail = (
            (result.stderr or "").strip()
            or (result.stdout or "").strip()
            or f"exit status {result.returncode}"
        )
        return PrLookup(unknown_reason=f"`gh pr list --head {branch}` failed: {detail}")
    try:
        parsed = json.loads(result.stdout or "[]")
    except json.JSONDecodeError as exc:
        return PrLookup(
            unknown_reason=f"`gh pr list --head {branch}` gave bad JSON: {exc}"
        )
    if not isinstance(parsed, list):
        return PrLookup(
            unknown_reason=f"`gh pr list --head {branch}` gave {type(parsed).__name__}, not a list"
        )
    return PrLookup(prs=tuple(pr for pr in parsed if isinstance(pr, dict)))


def query_all_branch_prs(branches: list[str]) -> dict[str, PrLookup]:
    """Look every branch up concurrently, deduplicating shared branch names."""
    unique = sorted({b for b in branches if b})
    if not unique:
        return {}
    with ThreadPoolExecutor(max_workers=min(GH_CONCURRENCY, len(unique))) as pool:
        return dict(zip(unique, pool.map(query_branch_prs, unique)))


def read_git_state(worktree: Path) -> GitState:
    """Head SHA, dirtiness and commits-ahead-of-`origin/main` for one worktree.

    `status --porcelain=v2 --branch` answers the first two in a single call and
    honours `.gitignore`, so the generated `supabase/config.toml`, `.env.local`
    and `.claude/launch.json` do not make every worktree look dirty. Untracked
    files DO count as dirty — a plan doc that exists nowhere else is exactly the
    kind of thing that must block a reap.

    `origin/main` is read as-is, with no fetch. A stale `origin/main` can only
    make a branch look *further* ahead than it is, which withholds a reap.
    """
    try:
        status = subprocess.run(
            ["git", "-C", str(worktree), "status", "--porcelain=v2", "--branch"],
            capture_output=True,
            text=True,
        )
    except OSError:
        return GitState()
    if status.returncode != 0:
        return GitState()

    head: str | None = None
    dirty = False
    for line in status.stdout.splitlines():
        if line.startswith("# branch.oid "):
            oid = line[len("# branch.oid ") :].strip()
            head = None if oid == "(initial)" else oid
        elif not line.startswith("# "):
            dirty = True

    try:
        ahead_result = subprocess.run(
            ["git", "-C", str(worktree), "rev-list", "--count", "origin/main..HEAD"],
            capture_output=True,
            text=True,
        )
    except OSError:
        return GitState(head=head, dirty=dirty)
    if ahead_result.returncode != 0:
        return GitState(head=head, dirty=dirty)
    try:
        ahead = int(ahead_result.stdout.strip())
    except ValueError:
        return GitState(head=head, dirty=dirty)

    return GitState(head=head, dirty=dirty, ahead=ahead)


def live_process_cwds() -> tuple[set[str], str | None]:
    """Directories that are some running process's cwd, or a reason we can't tell.

    Defence in depth, never the safety floor: a worktree is only ever reaped on
    the strength of merged-SHA equality or zero commits ahead, both of which
    hold whether or not a shell happens to be sitting in the directory. So an
    unavailable scan is a note, not a refusal.
    """
    proc = Path("/proc")
    if proc.is_dir():
        cwds: set[str] = set()
        for entry in proc.iterdir():
            if not entry.name.isdigit():
                continue
            try:
                cwds.add(os.readlink(entry / "cwd"))
            except OSError:
                # Another user's process, or one that exited mid-scan. Both are
                # fine to skip: neither is a worktree we could be about to reap
                # without also owning it.
                continue
        return cwds, None

    try:
        result = subprocess.run(
            ["lsof", "-w", "-d", "cwd", "-F", "n"],
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        return set(), f"no /proc and `lsof` unavailable ({exc})"
    # lsof exits 1 when some files could not be listed; its stdout is still good.
    if result.returncode != 0 and not result.stdout:
        detail = (result.stderr or "").strip() or f"exit status {result.returncode}"
        return set(), f"no /proc and `lsof` failed ({detail})"
    return {
        line[1:] for line in result.stdout.splitlines() if line.startswith("n/")
    }, None


def _contains(parent: Path, child: Path) -> bool:
    return parent == child or parent in child.parents


def classify(
    path: str,
    branch: str,
    lookup: PrLookup,
    git: GitState,
    live_cwds: set[str],
    self_cwd: Path,
) -> Verdict:
    """Decide one worktree's tier. Pure — every input is already gathered."""
    resolved = Path(path).resolve()

    if _contains(resolved, self_cwd):
        return Verdict(path, branch, TIER_KEEP, "invoking process's cwd is inside it")

    occupied = sorted(c for c in live_cwds if _contains(resolved, Path(c)))
    if occupied:
        return Verdict(path, branch, TIER_KEEP, f"live process cwd: {occupied[0]}")

    if lookup.is_unknown:
        return Verdict(
            path, branch, TIER_REVIEW, f"PR state UNKNOWN — {lookup.unknown_reason}"
        )

    pr = lookup.pick()
    state = pr.get("state") if pr else None

    if state == "OPEN":
        return Verdict(path, branch, TIER_KEEP, f"open PR #{pr.get('number')}")

    if git.dirty is None or git.head is None:
        return Verdict(path, branch, TIER_REVIEW, "git state could not be read")
    if git.dirty:
        return Verdict(path, branch, TIER_REVIEW, "working tree is dirty")

    if state == "MERGED":
        merged_sha = pr.get("headRefOid") if pr else None
        number = pr.get("number") if pr else None
        if merged_sha and git.head == merged_sha:
            return Verdict(path, branch, TIER_REAP, "merged")
        merged_short = str(merged_sha)[:12] if merged_sha else "(unreported)"
        return Verdict(
            path,
            branch,
            TIER_REVIEW,
            f"HEAD {git.head[:12]} is not PR #{number}'s merged "
            f"{merged_short} — commits after the merge",
        )

    # No merged or open PR: a closed-unmerged PR is treated the same as none,
    # since neither is evidence that anything landed. The only safe reap left is
    # a branch that carries nothing of its own.
    if git.ahead is None:
        return Verdict(
            path, branch, TIER_REVIEW, "commits ahead of origin/main unknown"
        )
    if git.ahead == 0:
        return Verdict(path, branch, TIER_REAP, "empty")
    return Verdict(
        path,
        branch,
        TIER_REVIEW,
        f"{git.ahead} commit(s) ahead of origin/main with no merged PR",
    )


def _is_main_worktree(path: str) -> bool:
    """Main worktree has `.git` as a directory; linked worktrees have a file."""
    return (Path(path) / ".git").is_dir()


def directory_size_kib(path: str) -> int | None:
    try:
        result = subprocess.run(["du", "-sk", path], capture_output=True, text=True)
    except OSError:
        return None
    if result.returncode != 0:
        return None
    try:
        return int(result.stdout.split(maxsplit=1)[0])
    except (ValueError, IndexError):
        return None


def format_kib(kib: int) -> str:
    size = float(kib)
    for unit in ("KiB", "MiB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GiB"


def run_cleanup(path: str, not_quiet: bool) -> int:
    """Delegate removal to worktree_cleanup.py and return its exit code."""
    try:
        result = subprocess.run(
            [sys.executable, str(CLEANUP_SCRIPT), path],
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        print(f"  {path}: could not run worktree_cleanup.py: {exc}", file=sys.stderr)
        return 1
    if result.stderr and (not_quiet or result.returncode != 0):
        for line in result.stderr.splitlines():
            print(f"    | {line}", file=sys.stderr)
    meaning = CLEANUP_EXIT_MEANINGS.get(
        result.returncode, f"unrecognized worktree_cleanup.py exit {result.returncode}"
    )
    if result.returncode == 0:
        # stdout, not stderr: merge-pr.sh surfaces this line next to `MERGED:`,
        # and the SessionStart hook discards stdout.
        print(f"REAPED: {path}")
    else:
        print(
            f"  {path}: worktree_cleanup.py exited {result.returncode} — {meaning}",
            file=sys.stderr,
        )
    return result.returncode


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually remove the REAP worktrees (default: dry-run report).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Only print the summary nudge and errors; skips `du` entirely.",
    )
    parser.add_argument(
        "--branch",
        default=None,
        help="Only consider worktrees checked out on this branch.",
    )
    parser.add_argument(
        "--repo-dir",
        type=Path,
        default=None,
        help=(
            "Repository root to use for `git worktree list`. "
            "Defaults to $CLAUDE_PROJECT_DIR or PWD."
        ),
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    repo_dir = args.repo_dir or Path(
        os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    )
    not_quiet = not args.quiet

    worktrees = {
        path: branch
        for path, branch in get_active_worktree_branches(repo_dir).items()
        if not _is_main_worktree(path)
        and (args.branch is None or branch == args.branch)
    }
    if not worktrees:
        if not_quiet:
            print("No linked worktrees to consider.", file=sys.stderr)
        return EXIT_OK

    lookups = query_all_branch_prs(list(worktrees.values()))
    live_cwds, cwd_scan_reason = live_process_cwds()
    if cwd_scan_reason and not_quiet:
        print(
            f"Note: live-process cwd guard unavailable ({cwd_scan_reason}); "
            "classification is unaffected — it never depends on this guard.",
            file=sys.stderr,
        )

    self_cwd = Path.cwd().resolve()
    verdicts = [
        classify(
            path,
            branch,
            lookups.get(branch, PrLookup()),
            read_git_state(Path(path)),
            live_cwds,
            self_cwd,
        )
        for path, branch in sorted(worktrees.items())
    ]

    reapable = [v for v in verdicts if v.tier == TIER_REAP]
    review = [v for v in verdicts if v.tier == TIER_REVIEW]
    keep = [v for v in verdicts if v.tier == TIER_KEEP]
    merged_count = sum(1 for v in reapable if v.reason == "merged")
    empty_count = len(reapable) - merged_count

    unknown = [b for b, lookup in lookups.items() if lookup.is_unknown]
    if unknown:
        # Never suppressed by --quiet. A branch whose PR state we could not read
        # is REVIEW, not "no PR" — saying so out loud is what keeps a `gh`
        # outage from ever reading as "nothing has landed".
        print(
            f"worktree-reap: PR state UNKNOWN for {len(unknown)} branch(es) "
            f"({', '.join(sorted(unknown)[:3])}"
            f"{', …' if len(unknown) > 3 else ''}) — they are reported as REVIEW and "
            "will not be reaped.",
            file=sys.stderr,
        )

    if not_quiet:
        for title, group in (
            (f"REAP ({merged_count} merged, {empty_count} empty)", reapable),
            ("REVIEW — unmerged commits or a dirty tree; never touched", review),
            ("KEEP — open PR or live process", keep),
        ):
            print(f"\n{title}: {len(group)}", file=sys.stderr)
            for verdict in group:
                size = (
                    directory_size_kib(verdict.path)
                    if verdict.tier == TIER_REAP
                    else None
                )
                suffix = f", {format_kib(size)}" if size is not None else ""
                print(
                    f"  - {verdict.branch or '(detached)'} [{verdict.reason}{suffix}]\n"
                    f"      {verdict.path}",
                    file=sys.stderr,
                )

    if not args.apply:
        if reapable and args.quiet:
            print(
                f"worktree-reap: {len(reapable)} worktree(s) already landed and "
                f"reclaimable ({merged_count} merged, {empty_count} empty), "
                f"{len(review)} need review (dry-run). "
                "Run: python3 scripts/worktree_reap.py --apply",
                file=sys.stderr,
            )
        elif not_quiet:
            print(
                f"\nDry-run; re-run with --apply to reclaim {len(reapable)} worktree(s).",
                file=sys.stderr,
            )
        return EXIT_GH_UNAVAILABLE if unknown else EXIT_OK

    # The set holds distinct *codes* (for the exit status); the counter holds
    # how many worktrees failed. Conflating the two would report "reaped 4 of 5"
    # when two worktrees failed with the same code.
    failures: set[int] = set()
    failed_count = 0
    for verdict in reapable:
        code = run_cleanup(verdict.path, not_quiet)
        if code != 0:
            failures.add(code)
            failed_count += 1

    if not_quiet:
        print(
            f"\nReaped {len(reapable) - failed_count} of {len(reapable)} worktree(s).",
            file=sys.stderr,
        )

    if failures:
        # Propagate the cleanup code when there is exactly one, so a caller sees
        # *which* failure happened rather than a generic 1. Several distinct
        # codes have no single honest answer, hence EXIT_CLEANUP_MIXED.
        if len(failures) == 1:
            return failures.pop()
        print(
            "worktree-reap: cleanup returned several distinct codes "
            f"({', '.join(str(c) for c in sorted(failures))}); see the per-worktree "
            "lines above.",
            file=sys.stderr,
        )
        return EXIT_CLEANUP_MIXED

    return EXIT_GH_UNAVAILABLE if unknown else EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
