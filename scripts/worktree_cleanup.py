#!/usr/bin/env python3
"""
Worktree cleanup — called by .claude/hooks/worktree-remove.sh.

Stops Supabase, removes Docker volumes, deallocates the manifest slot,
and removes the git worktree. One argument: the worktree path.
"""

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
    """Remove a worktree's entry from the manifest."""
    if not MANIFEST_PATH.exists():
        return
    data = json.loads(MANIFEST_PATH.read_text())
    slots = data.get("slots", {})
    if worktree_path in slots:
        del slots[worktree_path]
        MANIFEST_PATH.write_text(
            json.dumps({"version": 1, "slots": slots}, indent=2) + "\n"
        )


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: worktree_cleanup.py <worktree-path>", file=sys.stderr)
        sys.exit(1)

    worktree_path = Path(sys.argv[1]).resolve()

    if not worktree_path.is_dir():
        print(f"Warning: {worktree_path} does not exist, skipping", file=sys.stderr)
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

    # Deallocate manifest slot
    deallocate_slot(str(worktree_path))

    # Remove git worktree
    subprocess.run(
        ["git", "worktree", "remove", "--force", str(worktree_path)],
        capture_output=True,
    )
    subprocess.run(["git", "worktree", "prune"], capture_output=True)

    print(f"Cleaned up worktree: {worktree_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
