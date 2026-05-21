#!/usr/bin/env python3
"""
Worktree cleanup — called by .claude/hooks/worktree-remove.sh.

Stops Supabase, removes Docker volumes, deallocates the manifest slot,
and removes the git worktree. One argument: the worktree path.
"""

import fcntl
import json
import subprocess
import sys
from pathlib import Path

# Reuse the project-id derivation from worktree_setup so cleanup targets the
# same container/volume names that setup created. (Python auto-adds this
# script's directory to sys.path when invoked as `python3 worktree_cleanup.py`.)
from worktree_setup import branch_to_project_id  # noqa: E402

MANIFEST_PATH = Path.home() / ".config" / "pinpoint" / "worktree-slots.json"


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

    # PP-qlzu: when .git is missing (partial removal, rm -rf without the hook,
    # Claude in Web sandbox sessions), we can't derive the branch and therefore
    # can't safely target the Supabase project_id. Skip the Docker/Supabase
    # phase but still deallocate the slot — otherwise the manifest entry leaks
    # forever. worktree_orphan_sweep.py picks up any leaked Docker resources.
    git_marker_present = git_marker.is_file()
    if not git_marker_present:
        print(
            f"Warning: {worktree_path} has no .git marker — skipping Supabase/Docker "
            "cleanup (no branch to derive project_id from); deallocating slot only.",
            file=sys.stderr,
        )

    branch = ""
    if git_marker_present:
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

        # Stop Supabase. Failures here are non-fatal: a missing project_ref or
        # a stack that was never started both look like errors but don't block
        # slot deallocation.
        print(f"Stopping Supabase for {branch}...", file=sys.stderr)
        stop_result = subprocess.run(
            ["supabase", "stop"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
        )
        if stop_result.returncode != 0:
            print(
                f"Warning: `supabase stop` exited {stop_result.returncode}: "
                f"{stop_result.stderr.strip() or stop_result.stdout.strip()}",
                file=sys.stderr,
            )

        # Remove Docker volumes
        ls_result = subprocess.run(
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
        if ls_result.returncode != 0:
            print(
                f"Warning: `docker volume ls` exited {ls_result.returncode}: "
                f"{ls_result.stderr.strip()}",
                file=sys.stderr,
            )
            volumes: list[str] = []
        else:
            volumes = [v for v in ls_result.stdout.strip().split("\n") if v]
        if volumes:
            rm_result = subprocess.run(
                ["docker", "volume", "rm"] + volumes,
                capture_output=True,
                text=True,
            )
            if rm_result.returncode != 0:
                print(
                    f"Warning: `docker volume rm` exited {rm_result.returncode}: "
                    f"{rm_result.stderr.strip()}",
                    file=sys.stderr,
                )
            else:
                print(f"Removed {len(volumes)} Docker volume(s)", file=sys.stderr)

    # Unlock first. Claude Code agent runtimes lock worktrees while in use,
    # and the lock persists after the agent finishes; `git worktree remove
    # --force` does NOT bypass these locks. Unlock errors (e.g., "not locked")
    # are harmless and intentionally ignored.
    if git_marker_present:
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
                f"Warning: failed to remove worktree {worktree_path}: "
                f"{result.stderr.strip()} — continuing to deallocate slot.",
                file=sys.stderr,
            )

        subprocess.run(["git", "worktree", "prune"], capture_output=True)

    deallocate_slot(str(worktree_path))

    print(f"Cleaned up worktree: {worktree_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
