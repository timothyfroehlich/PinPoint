#!/usr/bin/env python3
"""
Worktree cleanup — called by .claude/hooks/worktree-remove.sh.

Stops Supabase, removes Docker volumes, deallocates the manifest slot,
and removes the git worktree. One argument: the worktree path.
"""

import fcntl
import json
import re
import subprocess
import sys
from pathlib import Path

MANIFEST_PATH = Path.home() / ".config" / "pinpoint" / "worktree-slots.json"


def branch_to_project_id(branch_name: str) -> str:
    """Convert a branch name to a valid Supabase project ID."""
    project_id = re.sub(r"[^a-z0-9-]", "-", branch_name.lower())
    project_id = re.sub(r"-+", "-", f"pinpoint-{project_id}").strip("-")
    return project_id[:50]


def deallocate_slot(worktree_path: str) -> None:
    """Remove a worktree's entry from the manifest, with file locking."""
    if not MANIFEST_PATH.exists():
        return

    with open(MANIFEST_PATH, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            try:
                data = json.loads(f.read())
                slots = data.get("slots", {})
            except (json.JSONDecodeError, KeyError):
                slots = {}

            if worktree_path in slots:
                del slots[worktree_path]
                f.seek(0)
                f.truncate()
                f.write(json.dumps({"version": 1, "slots": slots}, indent=2) + "\n")
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: worktree_cleanup.py <worktree-path>", file=sys.stderr)
        sys.exit(1)

    worktree_path = Path(sys.argv[1]).resolve()

    if not worktree_path.is_dir():
        print(f"Warning: {worktree_path} does not exist, skipping", file=sys.stderr)
        return

    # Refuse to operate on the main worktree. Inside a main worktree, .git is a
    # directory; inside an additional worktree, .git is a file with a "gitdir:"
    # pointer. A caller pointing this script at the main worktree (e.g., a
    # cleanup script that misidentified the path) would otherwise stop the
    # user's primary Supabase and try to remove their main checkout.
    git_marker = worktree_path / ".git"
    if git_marker.is_dir():
        print(
            f"Refusing to clean up the main worktree at {worktree_path}. "
            "worktree_cleanup.py is for additional (git worktree add) worktrees only.",
            file=sys.stderr,
        )
        sys.exit(2)
    if not git_marker.is_file():
        print(
            f"Warning: {worktree_path} has no .git marker — not a worktree. Skipping.",
            file=sys.stderr,
        )
        return

    # Get branch name for Docker volume cleanup
    try:
        result = subprocess.run(
            ["git", "-C", str(worktree_path), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        branch = result.stdout.strip()
    except subprocess.CalledProcessError:
        branch = ""

    if branch:
        project_id = branch_to_project_id(branch)

        # Stop Supabase
        print(f"Stopping Supabase for {branch}...", file=sys.stderr)
        subprocess.run(["supabase", "stop"], cwd=worktree_path, capture_output=True)

        # Remove Docker volumes
        result = subprocess.run(
            [
                "docker",
                "volume",
                "ls",
                "--filter",
                f"label=com.supabase.cli.project={project_id}",
                "-q",
            ],
            capture_output=True,
            text=True,
        )
        volumes = [v for v in result.stdout.strip().split("\n") if v]
        if volumes:
            subprocess.run(["docker", "volume", "rm"] + volumes, capture_output=True)
            print(f"Removed {len(volumes)} Docker volume(s)", file=sys.stderr)

    # Unlock first. Claude Code agent runtimes lock worktrees while in use,
    # and the lock persists after the agent finishes; `git worktree remove
    # --force` does NOT bypass these locks. Unlock errors (e.g., "not locked")
    # are harmless and intentionally ignored.
    subprocess.run(
        ["git", "worktree", "unlock", str(worktree_path)],
        capture_output=True,
    )

    result = subprocess.run(
        ["git", "worktree", "remove", "--force", str(worktree_path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(
            f"Failed to remove worktree {worktree_path}: {result.stderr.strip()}",
            file=sys.stderr,
        )
        sys.exit(1)

    subprocess.run(["git", "worktree", "prune"], capture_output=True)
    deallocate_slot(str(worktree_path))

    print(f"Cleaned up worktree: {worktree_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
