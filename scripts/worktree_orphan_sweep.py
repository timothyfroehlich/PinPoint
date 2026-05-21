#!/usr/bin/env python3
"""
worktree_orphan_sweep.py — find and (optionally) reclaim leaked worktree resources.

Two failure modes accumulate orphans:

1.  `rm -rf <worktree>` (no WorktreeRemove hook fires) leaves the slot
    manifest entry pointing at a missing path and the Supabase Docker
    volumes/containers — labeled `com.supabase.cli.project=pinpoint-*` —
    intact on the host.
2.  Claude in Web sandbox sessions cannot fire local hooks at all, so a
    branch DB started by an earlier local round-trip can outlive the
    sandbox session.

This script reconciles three sources of truth:

- active git worktrees (`git worktree list --porcelain`)
- slot manifest entries (`~/.config/pinpoint/worktree-slots.json`)
- Docker resources with the `com.supabase.cli.project` label whose value
  starts with `pinpoint-` (the prefix `branch_to_project_id` always emits)

Defaults to dry-run; pass `--apply` to actually deallocate orphan slots and
remove orphan Docker containers/volumes.
"""

import argparse
import fcntl
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from worktree_cleanup import MANIFEST_PATH, deallocate_slot  # noqa: E402
from worktree_setup import branch_to_project_id  # noqa: E402


def get_active_worktree_branches(repo_dir: Path) -> dict[str, str]:
    """Return {path: branch} for all current git worktrees of repo_dir."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_dir), "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        print(
            f"Warning: `git worktree list` failed: {exc.stderr.strip()}",
            file=sys.stderr,
        )
        return {}

    worktrees: dict[str, str] = {}
    current_path = ""
    current_branch = ""
    for line in result.stdout.splitlines():
        if line.startswith("worktree "):
            if current_path:
                worktrees[current_path] = current_branch
            current_path = line[len("worktree ") :]
            current_branch = ""
        elif line.startswith("branch refs/heads/"):
            current_branch = line[len("branch refs/heads/") :]
    if current_path:
        worktrees[current_path] = current_branch
    return worktrees


def get_orphan_slot_paths() -> list[str]:
    """Read the slot manifest and return paths missing on disk or w/o .git marker."""
    if not MANIFEST_PATH.exists():
        return []
    with open(MANIFEST_PATH) as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_SH)
        try:
            data = json.loads(f.read())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    slots = data.get("slots", {})
    orphans: list[str] = []
    for path_str in slots:
        path = Path(path_str)
        if not path.is_dir() or not (path / ".git").exists():
            orphans.append(path_str)
    return orphans


def _docker_label_query(args: list[str], not_quiet: bool) -> list[tuple[str, str]]:
    """Run a Docker command emitting `name|project_id` lines; return parsed pairs.

    Returns [] when Docker is missing or the daemon is unreachable; the SessionStart
    hook must never block on Docker being down.
    """
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
    except FileNotFoundError:
        if not_quiet:
            print(
                "Note: `docker` not installed; skipping Docker sweep.", file=sys.stderr
            )
        return []
    except subprocess.CalledProcessError as exc:
        if not_quiet:
            print(
                f"Note: docker query failed ({exc.stderr.strip()}); skipping Docker sweep.",
                file=sys.stderr,
            )
        return []

    out: list[tuple[str, str]] = []
    for line in result.stdout.splitlines():
        name, _, project = line.partition("|")
        if project.startswith("pinpoint-"):
            out.append((name, project))
    return out


def get_supabase_resources_by_project(
    not_quiet: bool,
) -> dict[str, dict[str, list[str]]]:
    """Group Supabase Docker containers/volumes by their project_id label."""
    grouped: dict[str, dict[str, list[str]]] = {}

    volumes = _docker_label_query(
        [
            "docker",
            "volume",
            "ls",
            "--format",
            '{{.Name}}|{{.Label "com.supabase.cli.project"}}',
        ],
        not_quiet,
    )
    for name, project in volumes:
        grouped.setdefault(project, {"volumes": [], "containers": []})
        grouped[project]["volumes"].append(name)

    containers = _docker_label_query(
        [
            "docker",
            "ps",
            "-a",
            "--format",
            '{{.Names}}|{{.Label "com.supabase.cli.project"}}',
        ],
        not_quiet,
    )
    for name, project in containers:
        grouped.setdefault(project, {"volumes": [], "containers": []})
        grouped[project]["containers"].append(name)

    return grouped


def _is_main_worktree_path(path: str) -> bool:
    """Main worktree has .git as a directory; additional worktrees have .git as a file."""
    return (Path(path) / ".git").is_dir()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually remove orphan resources (default: dry-run report).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-orphan logging; only print summary line and errors.",
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
    args = parser.parse_args()

    repo_dir = args.repo_dir or Path(
        os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    )
    not_quiet = not args.quiet

    active = get_active_worktree_branches(repo_dir)
    active_project_ids = {
        branch_to_project_id(branch) for branch in active.values() if branch
    }

    if not_quiet:
        print(
            f"Active worktrees: {len(active)} "
            f"(project_ids: {sorted(active_project_ids)})",
            file=sys.stderr,
        )

    orphan_slots = get_orphan_slot_paths()
    if orphan_slots and not_quiet:
        print(
            f"Orphan slot entries (path missing or .git removed): {len(orphan_slots)}",
            file=sys.stderr,
        )
        for path_str in orphan_slots:
            print(f"  - {path_str}", file=sys.stderr)

    docker_by_project = get_supabase_resources_by_project(not_quiet)
    orphan_projects = {
        pid: res
        for pid, res in docker_by_project.items()
        if pid not in active_project_ids
    }
    if orphan_projects and not_quiet:
        print(
            f"Orphan Supabase Docker projects: {len(orphan_projects)}",
            file=sys.stderr,
        )
        for pid, res in sorted(orphan_projects.items()):
            print(
                f"  - {pid}: {len(res['containers'])} container(s), "
                f"{len(res['volumes'])} volume(s)",
                file=sys.stderr,
            )

    if not orphan_slots and not orphan_projects:
        if not_quiet:
            print("No orphans found.", file=sys.stderr)
        return 0

    if not args.apply:
        if not_quiet:
            print("Dry-run; re-run with --apply to reclaim.", file=sys.stderr)
        else:
            # Quiet dry-run still surfaces a single-line nudge so the SessionStart
            # hook isn't completely silent when there's something to reclaim.
            print(
                f"worktree-orphan-sweep: found {len(orphan_slots)} slot orphan(s), "
                f"{len(orphan_projects)} Supabase Docker project orphan(s) "
                "(dry-run). Run: python3 scripts/worktree_orphan_sweep.py --apply",
                file=sys.stderr,
            )
        return 0

    for path_str in orphan_slots:
        if _is_main_worktree_path(path_str):
            print(
                f"Skipping main worktree {path_str} (should not be in slot manifest).",
                file=sys.stderr,
            )
            continue
        deallocate_slot(path_str)
        if not_quiet:
            print(f"  deallocated slot: {path_str}", file=sys.stderr)

    for pid, res in sorted(orphan_projects.items()):
        if res["containers"]:
            rm = subprocess.run(
                ["docker", "rm", "-f"] + res["containers"],
                capture_output=True,
                text=True,
            )
            if rm.returncode != 0:
                print(
                    f"  Warning: `docker rm -f` for {pid}: {rm.stderr.strip()}",
                    file=sys.stderr,
                )
            elif not_quiet:
                print(
                    f"  removed {len(res['containers'])} container(s) for {pid}",
                    file=sys.stderr,
                )
        if res["volumes"]:
            rm = subprocess.run(
                ["docker", "volume", "rm"] + res["volumes"],
                capture_output=True,
                text=True,
            )
            if rm.returncode != 0:
                print(
                    f"  Warning: `docker volume rm` for {pid}: {rm.stderr.strip()}",
                    file=sys.stderr,
                )
            elif not_quiet:
                print(
                    f"  removed {len(res['volumes'])} volume(s) for {pid}",
                    file=sys.stderr,
                )

    return 0


if __name__ == "__main__":
    sys.exit(main())
