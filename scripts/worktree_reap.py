#!/usr/bin/env python3
"""
worktree_reap.py — reclaim finished worktrees and what deleted ones left behind.

Dry-run by default; `--apply` acts. Two sections:

**Finished worktrees** still on disk, removed through `worktree_cleanup.py`.
"No open PR + clean tree" also describes an agent that has not opened its PR
yet, so a worktree is reaped only on positive proof that nothing can be lost:

- REAP/merged — its newest PR merged, `HEAD` is *exactly* that PR's
  `headRefOid`, and the tree is clean. Branches are squash-merged, so their
  commits never become ancestors of `main`: only SHA equality proves it.
- REAP/empty — clean, zero commits ahead of `origin/main`, at least a day old.
  Nothing unique is on it, so no PR state could change that and `gh` is not
  asked. The age floor keeps an agent's brand-new worktree safe.
- REVIEW — commits without a merged PR, commits after the merge, a dirty tree
  (untracked files and prototype work count, gitignored files don't), or a PR
  state `gh` could not report. Never touched.
- KEEP — an open PR, a young empty worktree, or a live process (this one too)
  whose cwd is inside it.

**Orphans** of worktrees whose directory is gone: slot-manifest entries, and
Supabase containers, networks and volumes whose project_id no live worktree
claims. The local Docker daemon runs only this machine's stacks. With the
remote backend (docs/runbooks/remote-supabase.md) the remote daemon is read
too, keeping only projects whose containers' workdir label is a gone path on
this machine; Crabbox runner projects are never considered. A slot is released
only once no stack references its path and its ports are closed.

**Unknown is never zero.** A failed `gh` or Docker query makes that part
UNKNOWN: it is printed and nothing is removed on its strength. A dry run exits
0 (orchestration-status.sh shows its report); `--apply` exits 1 when a removal
failed or anything it would have acted on was UNKNOWN.

`--branch` limits the run to one worktree and skips orphans (merge-pr.sh).
`--quiet` prints one nudge line (the SessionStart hook). A dry run gives all
its gh/docker calls a shared time budget, so an unreachable remote daemon reads
as UNKNOWN instead of stalling the hook or the briefing; `--apply` has none, so
a removal is never cut off halfway.
"""

import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import worktree_cleanup  # noqa: E402
from worktree_setup import (  # noqa: E402
    BACKEND_ENV_KEY,
    REMOTE_HOST_ENV_KEY,
    DockerNotInstalledError,
    DockerUnavailableError,
    derive_project_id,
    is_main_worktree,
    list_worktrees,
    read_config_project_id,
    read_stored_backend,
    run_docker,
    slot_ports_in_use,
)

CLEANUP_SCRIPT = Path(__file__).resolve().parent / "worktree_cleanup.py"
PROTOTYPE_MARKER = ".prototype-mode"
PROTOTYPE_ROOT = Path("src/app/(dev)/prototype")
PROTOTYPE_PERMANENT_FILES = frozenset({"layout.tsx"})

EXIT_OK = 0
EXIT_FAILED = 1
TIER_REAP, TIER_REVIEW, TIER_KEEP = "REAP", "REVIEW", "KEEP"

#: An empty worktree younger than this may be an agent that has not committed.
EMPTY_MIN_AGE_HOURS = 24
GH_CONCURRENCY = 12
#: In a dry run every gh/docker call shares this budget, so the SessionStart
#: hook (hard cap 23s inside its 25s settings.json timeout) and the briefing
#: get a report even when the remote daemon is asleep.
REPORT_BUDGET_SECONDS = 20.0

PROJECT_LABEL = "com.supabase.cli.project"
REMOTE_DOCKER_HOST_ENV = "PINPOINT_REMOTE_DOCKER_HOST"
#: The remote host's own stacks for Crabbox runners; never ours.
CRABBOX_PROJECT_PREFIX = "pinpoint-runner-crabbox"
# `volume ls --format '{{.Label ...}}'` exits 125 on Podman (PP-5o7b), so
# volumes are listed by label filter and their labels read with `inspect`.
VOLUME_FORMAT = '{{.Name}}|{{index .Labels "' + PROJECT_LABEL + '"}}'
CONTAINER_FORMAT = (
    '{{.Names}}|{{.Label "' + PROJECT_LABEL + '"}}|'
    '{{.Label "com.supabase.cli.workdir"}}'
)
NETWORK_GONE = re.compile(r"not found|no such network", re.IGNORECASE)


def _time_left(deadline: float | None) -> float | None:
    return None if deadline is None else max(0.1, deadline - time.monotonic())


# --- Finished worktrees ------------------------------------------------------


@dataclass(frozen=True)
class PrLookup:
    """PRs whose head is one branch. With `unknown_reason` set, `prs` is empty
    only because `gh` could not be asked — never read that as "no PR"."""

    prs: tuple[dict[str, object], ...] = ()
    unknown_reason: str | None = None

    def pick(self) -> dict[str, object] | None:
        """An OPEN PR wins over an older merged one; otherwise the newest."""
        pool = [pr for pr in self.prs if pr.get("state") == "OPEN"] or self.prs
        return max(pool, key=lambda pr: int(pr.get("number") or 0), default=None)


@dataclass(frozen=True)
class GitState:
    """What the worktree's own git says. `None` anywhere means unknown."""

    head: str | None = None
    dirty: bool | None = None
    ahead: int | None = None
    age_hours: float | None = None

    @property
    def settled_empty(self) -> bool:
        return (
            self.dirty is False
            and self.head is not None
            and self.ahead == 0
            and (self.age_hours or 0) >= EMPTY_MIN_AGE_HOURS
        )


@dataclass(frozen=True)
class Verdict:
    path: str
    branch: str
    tier: str
    reason: str  # doubles as the REAP sub-tier: "merged" / "empty"


def query_branch_prs(branch: str, repo_dir: Path, deadline: float | None) -> PrLookup:
    """Every PR whose head is `branch`. `--head`, not a ref lookup: merged
    branches are auto-deleted. `cwd=repo_dir` is load-bearing: `gh` picks the
    repository from its own cwd, and another repo's same-named merged branch
    would read as proof."""
    if not branch:
        return PrLookup()  # detached: no ref a PR could point at
    command = f"`gh pr list --head {branch}`"
    try:
        result = subprocess.run(
            ["gh", "pr", "list", "--head", branch, "--state", "all", "--limit", "20"]
            + ["--json", "number,state,headRefOid,headRefName"],
            capture_output=True,
            text=True,
            cwd=repo_dir,
            timeout=_time_left(deadline),
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip() or result.returncode
            return PrLookup(unknown_reason=f"{command} failed: {detail}")
        parsed = json.loads(result.stdout or "[]")
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        return PrLookup(unknown_reason=f"{command} failed: {exc}")
    if not isinstance(parsed, list):
        return PrLookup(unknown_reason=f"{command} did not return a list")
    return PrLookup(prs=tuple(pr for pr in parsed if isinstance(pr, dict)))


def read_git_state(worktree: Path) -> GitState:
    """`status` honours `.gitignore`, so generated `.env.local`/`config.toml`
    are not dirt; untracked files are. `origin/main` is read without a fetch:
    stale, it only makes a branch look further ahead, which withholds a reap."""

    def git(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", "-C", str(worktree), *args], capture_output=True, text=True
        )

    try:
        status = git("status", "--porcelain=v2", "--branch")
        count = git("rev-list", "--count", "origin/main..HEAD")
    except OSError:
        return GitState()
    head, dirty = None, _prototype_state(worktree)
    if status.returncode != 0 or dirty is None:
        return GitState()
    for line in status.stdout.splitlines():
        if line.startswith("# branch.oid "):
            oid = line.removeprefix("# branch.oid ").strip()
            head = None if oid == "(initial)" else oid
        elif not line.startswith("# "):
            dirty = True
    ahead = int(count.stdout) if count.returncode == 0 else None
    return GitState(head, dirty, ahead, worktree_age_hours(worktree))


def worktree_age_hours(worktree: Path) -> float | None:
    """Hours since `git worktree add` wrote the worktree's `.git` file."""
    try:
        return (time.time() - (worktree / ".git").stat().st_mtime) / 3600
    except OSError:
        return None


def _prototype_state(worktree: Path) -> bool | None:
    """Whether ignored prototype work exists, or `None` when it cannot be read."""
    if os.path.lexists(worktree / PROTOTYPE_MARKER):
        return True
    root = worktree / PROTOTYPE_ROOT
    if not os.path.lexists(root):
        return False
    if not root.is_dir():
        return True
    try:
        return any(c.name not in PROTOTYPE_PERMANENT_FILES for c in root.iterdir())
    except OSError:
        return None


def live_process_cwds() -> tuple[set[str], str | None]:
    """Running processes' cwds, or why they can't be listed. Defence in depth:
    no REAP verdict depends on it, so a failed scan is a note, not a refusal."""
    proc = Path("/proc")
    if proc.is_dir():
        cwds: set[str] = set()
        for entry in proc.iterdir():
            if entry.name.isdigit():
                try:
                    cwds.add(os.readlink(entry / "cwd"))
                except OSError:
                    continue  # another user's process, or one that just exited
        return cwds, None
    try:
        result = subprocess.run(
            ["lsof", "-w", "-d", "cwd", "-F", "n"], capture_output=True, text=True
        )
    except OSError as exc:
        return set(), f"no /proc and `lsof` unavailable ({exc})"
    # lsof exits 1 when some files could not be listed; its stdout is still good.
    if result.returncode != 0 and not result.stdout:
        return set(), f"no /proc and `lsof` failed ({result.stderr.strip()})"
    return {ln[1:] for ln in result.stdout.splitlines() if ln.startswith("n/")}, None


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

    def verdict(tier: str, reason: str) -> Verdict:
        return Verdict(path, branch, tier, reason)

    resolved = Path(path).resolve()
    if _contains(resolved, self_cwd):
        return verdict(TIER_KEEP, "invoking process's cwd is inside it")
    occupied = sorted(c for c in live_cwds if _contains(resolved, Path(c)))
    if occupied:
        return verdict(TIER_KEEP, f"live process cwd: {occupied[0]}")
    if git.settled_empty:
        return verdict(TIER_REAP, "empty")
    if lookup.unknown_reason:
        return verdict(TIER_REVIEW, f"PR state UNKNOWN — {lookup.unknown_reason}")
    pr = lookup.pick() or {}
    state, number, merged_sha = pr.get("state"), pr.get("number"), pr.get("headRefOid")
    if state == "OPEN":
        return verdict(TIER_KEEP, f"open PR #{number}")
    if git.dirty is None or git.head is None:
        return verdict(TIER_REVIEW, "git state could not be read")
    if git.dirty:
        return verdict(TIER_REVIEW, "working tree is dirty")
    if state == "MERGED":
        if merged_sha and git.head == merged_sha:
            return verdict(TIER_REAP, "merged")
        return verdict(
            TIER_REVIEW,
            f"HEAD {git.head[:12]} is not PR #{number}'s merged "
            f"{str(merged_sha or '(unreported)')[:12]} — commits after the merge",
        )
    # A closed-unmerged PR is no evidence that anything landed, same as none.
    if git.ahead is None:
        return verdict(TIER_REVIEW, "commits ahead of origin/main unknown")
    if git.ahead:
        return verdict(
            TIER_REVIEW, f"{git.ahead} commit(s) ahead of origin/main with no merged PR"
        )
    if git.age_hours is None:
        return verdict(TIER_REVIEW, "worktree age unknown")
    return verdict(
        TIER_KEEP,
        f"no commits yet, created {git.age_hours:.0f}h ago "
        f"(empty worktrees are reaped after {EMPTY_MIN_AGE_HOURS}h)",
    )


def classify_worktrees(
    candidates: dict[str, str], repo_dir: Path, deadline: float | None, quiet: bool
) -> tuple[list[Verdict], list[str]]:
    """Verdicts, plus the branches whose PR state is UNKNOWN. Local git first,
    so `gh` is asked (in parallel) only about worktrees it could still decide."""
    if not candidates:
        return [], []
    git_states = {path: read_git_state(Path(path)) for path in candidates}
    branches = sorted(
        {b for p, b in candidates.items() if b and not git_states[p].settled_empty}
    )
    lookups: dict[str, PrLookup] = {}
    if branches:
        with ThreadPoolExecutor(min(GH_CONCURRENCY, len(branches))) as pool:
            found = pool.map(
                lambda b: query_branch_prs(b, repo_dir, deadline), branches
            )
            lookups = dict(zip(branches, found))
    live_cwds, scan_problem = live_process_cwds()
    if scan_problem and not quiet:
        print(f"Note: live-process cwd guard off ({scan_problem}).", file=sys.stderr)
    self_cwd = Path.cwd().resolve()
    verdicts = [
        classify(p, b, lookups.get(b, PrLookup()), git_states[p], live_cwds, self_cwd)
        for p, b in sorted(candidates.items())
    ]
    return verdicts, [b for b, lookup in lookups.items() if lookup.unknown_reason]


def run_cleanup(path: str, quiet: bool) -> bool:
    """Delegate removal to worktree_cleanup.py; True when it succeeded. Its
    stderr is relayed on failure even under --quiet: it says what leaked."""
    try:
        result = subprocess.run(
            [sys.executable, str(CLEANUP_SCRIPT), path], capture_output=True, text=True
        )
    except OSError as exc:
        print(f"  {path}: could not run worktree_cleanup.py: {exc}", file=sys.stderr)
        return False
    if result.stderr and (not quiet or result.returncode != 0):
        for line in result.stderr.splitlines():
            print(f"    | {line}", file=sys.stderr)
    if result.returncode != 0:
        print(
            f"  {path}: worktree_cleanup.py FAILED (exit {result.returncode}) — "
            "see its output above; the worktree may not be fully cleaned up",
            file=sys.stderr,
        )
        return False
    print(f"REAPED: {path}")  # stdout: merge-pr.sh shows it next to `MERGED:`
    return True


# --- Orphans -----------------------------------------------------------------


@dataclass
class Project:
    """One Supabase project on one daemon. Only containers carry the workdir
    label, so a stopped stack (volumes only) has no workdir."""

    containers: list[str] = field(default_factory=list)
    volumes: list[str] = field(default_factory=list)
    workdirs: set[str] = field(default_factory=set)


@dataclass
class Daemon:
    """A Docker daemon's PinPoint Supabase projects, or why it can't be read."""

    label: str
    remote: bool
    deadline: float | None
    env: dict[str, str] | None = None
    projects: dict[str, Project] = field(default_factory=dict)
    unknown_reason: str | None = None

    def docker(self, *args: str) -> str:
        return run_docker(["docker", *args], self.env, _time_left(self.deadline))


def read_daemon(daemon: Daemon) -> Daemon:
    """Fill `daemon.projects`; any failed query makes the whole daemon
    UNKNOWN, since half an answer is a false count."""
    label_filter = f"label={PROJECT_LABEL}"
    try:
        names = daemon.docker("volume", "ls", "--filter", label_filter, "-q").split()
        volumes = names and daemon.docker(
            "volume", "inspect", "--format", VOLUME_FORMAT, *names
        )
        containers = daemon.docker(
            "ps", "-a", "--filter", label_filter, "--format", CONTAINER_FORMAT
        )
    except DockerNotInstalledError as exc:
        if daemon.remote:  # the remote host's stacks exist whatever is local
            daemon.unknown_reason = str(exc)
        return daemon
    except DockerUnavailableError as exc:
        daemon.unknown_reason = str(exc)
        return daemon
    for kind, rows in (("volumes", volumes or ""), ("containers", containers)):
        for line in rows.splitlines():
            name, _, rest = line.strip().partition("|")
            project, _, workdir = rest.partition("|")
            if project.startswith("pinpoint-") and not project.startswith(
                CRABBOX_PROJECT_PREFIX
            ):
                entry = daemon.projects.setdefault(project, Project())
                getattr(entry, kind).append(name)
                entry.workdirs.update({workdir} - {""})
    if daemon.remote:  # it also runs stacks of the remote host's own checkouts
        daemon.projects = {
            pid: p
            for pid, p in daemon.projects.items()
            if all(_is_this_machine_path(w) for w in p.workdirs)
        }
    return daemon


def read_remote_daemon(
    worktrees: dict[str, str], deadline: float | None
) -> Daemon | None:
    """The remote daemon, when anything says this machine uses the remote
    backend: a remote setting in the shell, or a live worktree's .env.local."""
    host = os.environ.get(REMOTE_DOCKER_HOST_ENV, "").strip()
    if not (
        host
        or os.environ.get(REMOTE_HOST_ENV_KEY, "").strip()
        or os.environ.get(BACKEND_ENV_KEY, "").strip() == "remote"
        or any(read_stored_backend(Path(p)) == "remote" for p in worktrees)
    ):
        return None
    if not host:
        return Daemon(
            f"remote Docker ({REMOTE_DOCKER_HOST_ENV} unset)",
            remote=True,
            deadline=deadline,
            unknown_reason="this machine uses the remote Supabase backend but "
            f"{REMOTE_DOCKER_HOST_ENV} is unset",
        )
    env = {**os.environ, "DOCKER_HOST": host}  # as scripts/supabase-stack.sh does
    env.pop("DOCKER_CONTEXT", None)
    return read_daemon(Daemon(host, remote=True, deadline=deadline, env=env))


def _is_this_machine_path(path: str) -> bool:
    """Under this machine's home or temp directories; the remote host's own
    checkouts (Bazzite: /var/home/...) fall outside them."""
    norm = os.path.normpath(path)
    roots = (os.path.normpath(str(Path.home())), "/tmp", "/private/tmp")
    return path.startswith("/") and any(
        norm == root or norm.startswith(root + "/") for root in roots
    )


def _is_within(child: str, parent: str) -> bool:
    child, parent = os.path.realpath(child), os.path.realpath(parent)
    return child == parent or child.startswith(parent.rstrip("/") + "/")


def orphan_projects(
    daemon: Daemon, active_ids: set[str]
) -> tuple[dict[str, Project], dict[str, Project]]:
    """(orphans, report-only). An orphan is a project_id no live worktree
    claims — never "a volume with no container", which is every stopped stack.
    A remote one must also be attributable: its workdir is a gone path here. A
    remote project with volumes only has no workdir, so it is only reported."""
    orphans: dict[str, Project] = {}
    report_only: dict[str, Project] = {}
    for pid, project in sorted(daemon.projects.items()):
        if pid in active_ids:
            continue
        if not daemon.remote:
            orphans[pid] = project
        elif not project.workdirs:
            report_only[pid] = project
        elif not any(Path(w).exists() for w in project.workdirs):
            orphans[pid] = project
    return orphans, report_only


def remove_project(pid: str, project: Project, daemon: Daemon, quiet: bool) -> bool:
    """Containers, then `supabase_network_<pid>` (which `docker rm` leaves
    behind), then volumes — by name, never by prune. True when all went."""
    ok = True
    for kind, argv, names in (
        ("container", ["rm", "-f"], project.containers),
        ("network", ["network", "rm"], [f"supabase_network_{pid}"]),
        ("volume", ["volume", "rm"], project.volumes),
    ):
        if not names:
            continue
        try:
            daemon.docker(*argv, *names)
        except (DockerNotInstalledError, DockerUnavailableError) as exc:
            if kind == "network" and NETWORK_GONE.search(str(exc)):
                continue  # stopped properly, or the stack used a shared network
            ok = False
            print(
                f"  FAILED removing {pid}'s {kind}(s) on {daemon.label}: {exc}",
                file=sys.stderr,
            )
            if kind == "container":
                print(f"  kept {pid}'s network and volumes", file=sys.stderr)
                return False
            continue
        if not quiet:
            print(f"  removed {len(names)} {kind}(s) of {pid}", file=sys.stderr)
    return ok


def gone_slots() -> dict[str, int]:
    """Manifest entries whose worktree directory (or its `.git`) is gone."""
    try:
        with open(worktree_cleanup.MANIFEST_PATH) as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            slots = json.loads(f.read()).get("slots", {})
    except FileNotFoundError:
        return {}
    except (OSError, ValueError, AttributeError) as exc:
        print(f"Warning: slot manifest unreadable, skipped: {exc}", file=sys.stderr)
        return {}
    return {
        path: slot
        for path, slot in sorted(slots.items())
        if isinstance(slot, int) and not (Path(path) / ".git").exists()
    }


def slot_hold_reason(
    path: str, slot: int, daemons: list[Daemon], removed: set[tuple[str, str]]
) -> str | None:
    """Why a gone worktree's slot must stay allocated, or None to release it."""
    unknown = [d.label for d in daemons if d.unknown_reason]
    if unknown:
        return f"Docker state UNKNOWN on {', '.join(unknown)}"
    holders = sorted(
        pid
        for d in daemons
        for pid, p in d.projects.items()
        if (d.label, pid) not in removed
        and any(_is_within(w, path) for w in p.workdirs)
    )
    if holders:
        return f"stack {', '.join(holders)} still references it"
    if slot_ports_in_use(slot):
        return "its Supabase ports are still open"
    return None


# --- Command -----------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--apply", action="store_true", help="Reclaim (default: report)."
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="One nudge line when something is reclaimable or UNKNOWN, plus failures.",
    )
    parser.add_argument("--branch", help="Only this branch's worktree; no orphans.")
    parser.add_argument(
        "--repo-dir",
        type=Path,
        help="Repository to inventory (default: $CLAUDE_PROJECT_DIR or PWD).",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_dir = args.repo_dir or Path(
        os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    )
    quiet, apply = args.quiet, args.apply
    deadline = None if apply else time.monotonic() + REPORT_BUDGET_SECONDS

    def log(message: str) -> None:
        if not quiet:
            print(message, file=sys.stderr)

    try:
        worktrees = list_worktrees(repo_dir)
    except (OSError, subprocess.CalledProcessError) as exc:
        # Without the inventory every stack would look orphaned. Stop.
        detail = str(getattr(exc, "stderr", "") or exc).strip()
        print(f"worktree-reap: `git worktree list` failed: {detail}", file=sys.stderr)
        return EXIT_FAILED

    # Finished worktrees. The main worktree is never a candidate.
    candidates = {
        path: branch
        for path, branch in worktrees.items()
        if not is_main_worktree(path) and args.branch in (None, branch)
    }
    verdicts, unknown_prs = classify_worktrees(candidates, repo_dir, deadline, quiet)
    reapable = [v for v in verdicts if v.tier == TIER_REAP]
    merged = sum(v.reason == "merged" for v in reapable)
    log("Finished worktrees")
    if unknown_prs:
        log(
            f"PR state UNKNOWN for {len(unknown_prs)} branch(es) "
            f"({', '.join(unknown_prs)}) — reported as REVIEW, never reaped."
        )
    for title, tier in (
        (f"REAP ({merged} merged, {len(reapable) - merged} empty)", TIER_REAP),
        ("REVIEW — unmerged commits, a dirty tree, or UNKNOWN PR state", TIER_REVIEW),
        ("KEEP — open PR, young, or in use", TIER_KEEP),
    ):
        group = [v for v in verdicts if v.tier == tier]
        log(f"{title}: {len(group)}")
        for v in group:
            log(f"  - {v.branch or '(detached)'} [{v.reason}]\n      {v.path}")

    # Orphans; --branch (merge-pr.sh) is about one worktree only.
    daemons: list[Daemon] = []
    orphans: list[tuple[Daemon, str, Project]] = []
    slots: dict[str, int] = {}
    if args.branch is None:
        active_ids = {
            read_config_project_id(Path(p)) or derive_project_id(Path(p), b or "HEAD")
            for p, b in worktrees.items()
        }
        daemons = [read_daemon(Daemon("local Docker", remote=False, deadline=deadline))]
        daemons += filter(None, [read_remote_daemon(worktrees, deadline)])
        log("\nOrphans of deleted worktrees")
        for daemon in daemons:
            if daemon.unknown_reason:
                log(
                    f"Supabase stacks on {daemon.label}: UNKNOWN, not zero — "
                    f"{daemon.unknown_reason}. Nothing there is counted or removed."
                )
                continue
            found, report_only = orphan_projects(daemon, active_ids)
            orphans += [(daemon, pid, p) for pid, p in found.items()]
            log(f"Supabase stacks on {daemon.label}: {len(found)} orphan(s)")
            for pid, p in found.items():
                log(
                    f"  - {pid}: {len(p.containers)} container(s), "
                    f"{len(p.volumes)} volume(s)"
                )
            for pid, p in report_only.items():
                log(
                    f"  - {pid}: {len(p.volumes)} volume(s) with no workdir label; "
                    "not attributable to this machine, never removed — check by hand"
                )
        slots = gone_slots()
        log(f"Slots of deleted worktrees: {len(slots)}")

    # Act: finished worktrees, orphan stacks, then the slots they held.
    reap_failed = stack_failed = slot_failed = 0
    removed: set[tuple[str, str]] = set()
    if apply:
        reap_failed = sum(not run_cleanup(v.path, quiet) for v in reapable)
        for daemon, pid, project in orphans:
            if remove_project(pid, project, daemon, quiet):
                removed.add((daemon.label, pid))
            else:
                stack_failed += 1
    free = 0
    for path, slot in slots.items():
        held = slot_hold_reason(path, slot, daemons, removed)
        if held is None and apply:
            try:
                worktree_cleanup.deallocate_slot(path)
            except OSError as exc:
                held, slot_failed = f"release FAILED: {exc}", slot_failed + 1
                print(f"  slot {slot} {path}: {held}", file=sys.stderr)
        free += held is None
        status = f"held — {held}" if held else "released" if apply else "reclaimable"
        log(f"  - slot {slot} {path}: {status}")

    # Summarise.
    unknown = [f"Supabase stacks on {d.label}" for d in daemons if d.unknown_reason]
    if unknown_prs:
        unknown.insert(0, f"PR state of {len(unknown_prs)} branch(es)")
    counts = (
        f"{len(reapable)} finished worktree(s), {len(orphans)} orphan stack(s) "
        f"and {free} orphan slot(s)"
    )
    if apply:
        log(
            f"\nReaped {len(reapable) - reap_failed} of {len(reapable)} worktree(s), "
            f"removed {len(removed)} of {len(orphans)} orphan stack(s), "
            f"released {free} of {len(slots)} slot(s)."
        )
    else:
        log(f"\nDry-run; re-run with --apply to reclaim {counts}.")
    reclaimable = not apply and bool(reapable or orphans or free)
    if quiet and (unknown or reclaimable):
        parts = [f"{counts} reclaimable (dry-run)"] if reclaimable else []
        parts += [f"UNKNOWN, not zero: {', '.join(unknown)}"] if unknown else []
        print(
            f"worktree-reap: {'; '.join(parts)}. Run `python3 scripts/worktree_reap.py`"
            " for the report, `--apply` to reclaim.",
            file=sys.stderr,
        )
    failed = reap_failed or stack_failed or slot_failed or unknown
    return EXIT_FAILED if apply and failed else EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
