#!/usr/bin/env python3
"""
PinPoint Worktree Manager (pinpoint-wt)

A command-line tool for managing ephemeral git worktrees with automatic
port allocation and Supabase isolation for parallel development.

Commands:
  create <branch> [--base REF]  Create worktree (new or existing branch)
  sync [--all]                  Regenerate config.toml and .env.local from templates
  remove <branch>               Clean teardown (Supabase, Docker, worktree)
  list                          Show all worktrees with port assignments

Port Allocation:
  Static worktrees (PinPoint, Secondary, review, AntiGravity): offsets 0-3000
  Ephemeral worktrees: offsets 4000-9900 (hash-based with linear probing)
"""

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Add scripts directory to path for library import
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from pinpoint_wt_lib import (
    BASE_PORT_API,
    PortConfig,
    branch_to_project_id,
    merge_env_local,
)

# =============================================================================
# Configuration
# =============================================================================

# Static worktree mappings (preserved from sync_worktrees.py)
STATIC_WORKTREES = {
    "PinPoint": {"nextjs_offset": 0, "supabase_offset": 0, "project_id": "pinpoint"},
    "PinPoint-Secondary": {
        "nextjs_offset": 100,
        "supabase_offset": 1000,
        "project_id": "pinpoint-secondary",
    },
    "PinPoint-review": {
        "nextjs_offset": 200,
        "supabase_offset": 2000,
        "project_id": "pinpoint-review",
    },
    "PinPoint-AntiGravity": {
        "nextjs_offset": 300,
        "supabase_offset": 3000,
        "project_id": "pinpoint-antigravity",
    },
}

# Ephemeral worktree configuration
EPHEMERAL_OFFSET_MIN = 4000
EPHEMERAL_OFFSET_MAX = 9900
EPHEMERAL_OFFSET_STEP = 100
EPHEMERAL_SLOTS = (
    EPHEMERAL_OFFSET_MAX - EPHEMERAL_OFFSET_MIN
) // EPHEMERAL_OFFSET_STEP + 1  # 60 slots

# Worktree directories
EPHEMERAL_WORKTREE_BASE = Path("../pinpoint-worktrees")


# =============================================================================
# Path Helpers
# =============================================================================


def branch_to_dir_name(branch: str) -> str:
    """Convert branch name to flat directory name (replace / with -)."""
    return branch.replace("/", "-")


# =============================================================================
# Port Allocation
# =============================================================================


def compute_base_offset(branch_name: str) -> int:
    """
    Compute the base Supabase offset for a branch using SHA-256 hash.
    Returns a value in the ephemeral range (4000-9900, step 100).
    """
    h = int(hashlib.sha256(branch_name.encode()).hexdigest(), 16)
    slot = h % EPHEMERAL_SLOTS
    return EPHEMERAL_OFFSET_MIN + (slot * EPHEMERAL_OFFSET_STEP)


def get_offset_from_env(worktree_path: Path) -> Optional[int]:
    """
    Extract the Supabase offset from a worktree's .env.local file.
    Returns None if the file doesn't exist or can't be parsed.
    """
    env_file = worktree_path / ".env.local"
    if not env_file.exists():
        return None

    try:
        content = env_file.read_text()
        # Look for NEXT_PUBLIC_SUPABASE_URL=http://localhost:XXXXX
        match = re.search(r"NEXT_PUBLIC_SUPABASE_URL=http://localhost:(\d+)", content)
        if match:
            api_port = int(match.group(1))
            return api_port - BASE_PORT_API
    except (OSError, ValueError):
        # If the .env.local file cannot be read or parsed, treat it as if
        # no valid Supabase offset is configured for this worktree.
        pass

    return None


def get_all_worktree_paths() -> list[Path]:
    """Get paths to all git worktrees."""
    try:
        result = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )

        paths = []
        for line in result.stdout.strip().split("\n"):
            if line.startswith("worktree "):
                paths.append(Path(line[9:]))
        return paths
    except subprocess.CalledProcessError:
        return []


def get_used_offsets() -> set[int]:
    """Scan all worktrees to find currently used Supabase offsets."""
    used = set()

    # Add static offsets
    for config in STATIC_WORKTREES.values():
        used.add(config["supabase_offset"])

    # Scan all worktrees for their offsets
    for path in get_all_worktree_paths():
        offset = get_offset_from_env(path)
        if offset is not None:
            used.add(offset)

    return used


def find_free_offset(branch_name: str) -> int:
    """
    Find a free Supabase offset for the given branch.
    Uses hash-based allocation with linear probing for collisions.
    """
    used = get_used_offsets()
    base = compute_base_offset(branch_name)

    # Linear probing: try base, then base+100, base+200, etc.
    for i in range(EPHEMERAL_SLOTS):
        candidate = EPHEMERAL_OFFSET_MIN + (
            (base - EPHEMERAL_OFFSET_MIN + i * EPHEMERAL_OFFSET_STEP)
            % (EPHEMERAL_SLOTS * EPHEMERAL_OFFSET_STEP)
        )
        if candidate not in used:
            return candidate

    raise RuntimeError("No free port offsets available (all 60 ephemeral slots in use)")


# =============================================================================
# Config Generation
# =============================================================================

CONFIG_HEADER = """\
# ⚠️ AUTO-GENERATED - DO NOT EDIT ⚠️
# Managed by: pinpoint-wt.py
# To modify: Edit supabase/config.toml.template, then run `./pinpoint-wt.py sync`
#
"""


def generate_config_toml(worktree_path: Path, port_config: PortConfig) -> str:
    """Generate config.toml content from template with port substitutions."""
    template_path = worktree_path / "supabase" / "config.toml.template"
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    content = template_path.read_text()

    # Replace project_id
    content = re.sub(
        r'^project_id = ".*"',
        f'project_id = "{port_config.project_id}"',
        content,
        flags=re.MULTILINE,
    )

    # Replace ports in sections using section-aware replacement
    def replace_in_section(content: str, section: str, key: str, value: int) -> str:
        pattern = rf"(\[{re.escape(section)}\].*?)^({key} = )\d+"
        replacement = rf"\g<1>\g<2>{value}"
        return re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    content = replace_in_section(content, "api", "port", port_config.api_port)
    content = replace_in_section(content, "db", "port", port_config.db_port)
    content = replace_in_section(content, "db", "shadow_port", port_config.shadow_port)
    content = replace_in_section(content, "db.pooler", "port", port_config.pooler_port)
    content = replace_in_section(content, "inbucket", "port", port_config.inbucket_port)
    content = replace_in_section(
        content, "inbucket", "smtp_port", port_config.smtp_port
    )
    content = replace_in_section(
        content, "inbucket", "pop3_port", port_config.pop3_port
    )

    # Update site_url in auth section
    content = re.sub(
        r'^(site_url = )"[^"]*"',
        rf'\1"{port_config.site_url}"',
        content,
        flags=re.MULTILINE,
    )

    return CONFIG_HEADER + content


def write_protected_file(path: Path, content: str) -> None:
    """Write a file and set it to read-only."""
    # Remove read-only if it exists (so we can overwrite)
    if path.exists():
        path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)

    path.write_text(content)

    # Set read-only (444)
    path.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)


# =============================================================================
# Commands
# =============================================================================


def cmd_create(args: argparse.Namespace) -> int:
    """Create a new ephemeral worktree."""
    branch = args.branch
    repo_root = Path.cwd()
    use_json = getattr(args, "json", False)

    def log(*msg_args: object, **kwargs: object) -> None:
        """Print to stderr in JSON mode, stdout otherwise."""
        if use_json:
            print(*msg_args, **kwargs, file=sys.stderr)
        else:
            print(*msg_args, **kwargs)

    log(f"🌿 Creating ephemeral worktree for branch: {branch}")

    # Validate worktree doesn't already exist at target path
    worktree_dir = (
        repo_root / EPHEMERAL_WORKTREE_BASE / branch_to_dir_name(branch)
    ).resolve()
    if worktree_dir.exists():
        log(f"❌ Error: Worktree already exists at {worktree_dir}")
        return 1

    # Check if branch already exists (local or remote)
    branch_exists_locally = (
        subprocess.run(
            ["git", "rev-parse", "--verify", f"refs/heads/{branch}"],
            capture_output=True,
        ).returncode
        == 0
    )

    branch_exists_remote = False
    if not branch_exists_locally:
        branch_exists_remote = (
            subprocess.run(
                ["git", "rev-parse", "--verify", f"refs/remotes/origin/{branch}"],
                capture_output=True,
            ).returncode
            == 0
        )

    # Fetch latest from origin
    log("  📥 Fetching from origin...")
    try:
        subprocess.run(["git", "fetch", "origin"], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        log("❌ Error: Failed to fetch from origin. Check your network connection.")
        if e.stderr:
            stderr_text = e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr
            if stderr_text.strip():
                log(f"   git error: {stderr_text.strip()}")
        return 1

    # Allocate port offset
    try:
        supabase_offset = find_free_offset(branch)
    except RuntimeError as e:
        log(f"❌ Error: {e}")
        return 1

    # Calculate nextjs offset (supabase_offset / 10 to keep in range)
    nextjs_offset = supabase_offset // 10

    project_id = branch_to_project_id(branch)
    port_config = PortConfig(
        name=branch,
        nextjs_offset=nextjs_offset,
        supabase_offset=supabase_offset,
        project_id=project_id,
        is_static=False,
    )

    log(
        f"  🔌 Allocated ports: Next.js={port_config.nextjs_port}, API={port_config.api_port}, DB={port_config.db_port}"
    )

    # Create parent directories
    worktree_dir.parent.mkdir(parents=True, exist_ok=True)

    # Create worktree — use existing branch or create new one
    if branch_exists_locally:
        log(f"  📂 Creating worktree for existing local branch: {branch}")
        result = subprocess.run(
            ["git", "worktree", "add", str(worktree_dir), branch],
            capture_output=True,
            text=True,
        )
    elif branch_exists_remote:
        log(f"  📂 Creating worktree for existing remote branch: {branch}")
        result = subprocess.run(
            ["git", "worktree", "add", str(worktree_dir), branch],
            capture_output=True,
            text=True,
        )
    else:
        base_ref = args.base
        log(
            f"  📂 Creating worktree with new branch at {worktree_dir} (from {base_ref})..."
        )
        result = subprocess.run(
            ["git", "worktree", "add", "-b", branch, str(worktree_dir), base_ref],
            capture_output=True,
            text=True,
        )

    if result.returncode != 0:
        log(f"❌ Error creating worktree: {result.stderr}")
        return 1

    # Generate config.toml
    log("  ⚙️  Generating supabase/config.toml...")
    config_content = generate_config_toml(worktree_dir, port_config)
    config_path = worktree_dir / "supabase" / "config.toml"
    write_protected_file(config_path, config_content)

    # Generate .env.local
    log("  📝 Generating .env.local...")
    env_content = merge_env_local(worktree_dir, port_config)
    env_path = worktree_dir / ".env.local"
    write_protected_file(env_path, env_content)

    # Install dependencies
    log("  📦 Installing dependencies (pnpm install)...")
    result = subprocess.run(
        ["pnpm", "install", "--frozen-lockfile"],
        cwd=worktree_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"  ⚠️  Warning: pnpm install failed: {result.stderr[:200]}")

    # Set up beads redirect (so `bd` commands work from this worktree)
    beads_dir = worktree_dir / ".beads"
    beads_dir.mkdir(exist_ok=True)
    main_beads = repo_root / ".beads"
    rel_path = os.path.relpath(main_beads, worktree_dir)
    (beads_dir / "redirect").write_text(rel_path + "\n")
    log("  📋 Beads redirect configured")

    log()
    log("✅ Ephemeral worktree created successfully!")
    log()
    log(f"   Path:      {worktree_dir}")
    log(f"   Branch:    {branch}")
    log(f"   Next.js:   http://localhost:{port_config.nextjs_port}")
    log(f"   Supabase:  http://localhost:{port_config.api_port}")
    log()
    log("   Next steps:")
    log(f"   1. cd {worktree_dir}")
    log("   2. supabase start")
    log("   3. pnpm dev")
    log()

    if use_json:
        print(
            json.dumps(
                {
                    "path": str(worktree_dir),
                    "branch": branch,
                    "nextjs_port": port_config.nextjs_port,
                    "api_port": port_config.api_port,
                }
            )
        )

    return 0


def cmd_list(args: argparse.Namespace) -> int:
    """List all worktrees with their port assignments."""
    print()
    print(f"{'WORKTREE':<40} {'BRANCH':<30} {'OFFSET':>8} {'TYPE':<10}")
    print("-" * 92)

    worktree_paths = get_all_worktree_paths()

    for path in sorted(worktree_paths):
        name = path.name
        offset = get_offset_from_env(path)

        # Get branch name
        try:
            result = subprocess.run(
                ["git", "-C", str(path), "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            )
            branch = result.stdout.strip()
        except subprocess.CalledProcessError:
            branch = "unknown"

        # Determine type
        if name in STATIC_WORKTREES:
            worktree_type = "static"
            offset = STATIC_WORKTREES[name]["supabase_offset"]
        elif "pinpoint-worktrees" in str(path):
            worktree_type = "ephemeral"
        else:
            worktree_type = "other"

        offset_str = str(offset) if offset is not None else "-"
        print(f"{name:<40} {branch:<30} {offset_str:>8} {worktree_type:<10}")

    print()
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    """Remove an ephemeral worktree with full cleanup."""
    branch = args.branch
    repo_root = Path.cwd()
    use_json = getattr(args, "json", False)

    def log(*msg_args: object, **kwargs: object) -> None:
        """Print to stderr in JSON mode, stdout otherwise."""
        if use_json:
            print(*msg_args, **kwargs, file=sys.stderr)
        else:
            print(*msg_args, **kwargs)

    # Find the worktree path (flat name first, fallback to old nested path)
    worktree_dir = (
        repo_root / EPHEMERAL_WORKTREE_BASE / branch_to_dir_name(branch)
    ).resolve()
    if not worktree_dir.exists():
        # Fallback: try old nested path for backwards compatibility
        worktree_dir = (repo_root / EPHEMERAL_WORKTREE_BASE / branch).resolve()

    if not worktree_dir.exists():
        log(f"❌ Error: Worktree not found at {worktree_dir}")
        return 1

    # Get project_id for Docker cleanup
    project_id = branch_to_project_id(branch)

    log(f"🗑️  Removing ephemeral worktree: {branch}")

    # Stop Supabase if running
    log("  🛑 Stopping Supabase...")
    subprocess.run(["supabase", "stop"], cwd=worktree_dir, capture_output=True)

    # Remove Docker volumes
    log(f"  🐳 Removing Docker volumes for project: {project_id}...")
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
    volumes = result.stdout.strip().split("\n")
    volumes = [v for v in volumes if v]  # Filter empty strings

    if volumes:
        subprocess.run(["docker", "volume", "rm"] + volumes, capture_output=True)
        log(f"     Removed {len(volumes)} volume(s)")
    else:
        log("     No volumes found")

    # Remove worktree
    log("  📂 Removing worktree...")
    result = subprocess.run(
        ["git", "worktree", "remove", "--force", str(worktree_dir)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"  ⚠️  Warning: {result.stderr}")

    # Prune worktrees
    subprocess.run(["git", "worktree", "prune"], capture_output=True)

    log()
    log("✅ Worktree removed successfully!")
    log(
        f"   Branch '{branch}' preserved (delete manually with: git branch -d -- '{branch}' (or: git branch -D -- '{branch}' to force))"
    )
    log()

    if use_json:
        print(json.dumps({"removed": True}))

    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    """Sync/regenerate config files for worktrees."""
    if args.all:
        worktree_paths = get_all_worktree_paths()
        print(f"🔄 Syncing {len(worktree_paths)} worktree(s)...")
    else:
        worktree_paths = [Path.cwd()]
        print("🔄 Syncing current worktree...")

    for path in worktree_paths:
        name = path.name
        print(f"\n  {name}:")

        # Determine port config
        if name in STATIC_WORKTREES:
            config = STATIC_WORKTREES[name]
            port_config = PortConfig(
                name=name,
                nextjs_offset=config["nextjs_offset"],
                supabase_offset=config["supabase_offset"],
                project_id=config["project_id"],
                is_static=True,
            )
        else:
            # Extract offset from existing .env.local or compute new
            offset = get_offset_from_env(path)
            if offset is None:
                # Get branch name for new allocation
                try:
                    result = subprocess.run(
                        ["git", "-C", str(path), "rev-parse", "--abbrev-ref", "HEAD"],
                        capture_output=True,
                        text=True,
                        check=True,
                    )
                    branch = result.stdout.strip()
                    offset = find_free_offset(branch)
                except (subprocess.CalledProcessError, RuntimeError):
                    print("    ⚠️  Skipping: Could not determine offset")
                    continue

            # Get branch for project_id
            try:
                result = subprocess.run(
                    ["git", "-C", str(path), "rev-parse", "--abbrev-ref", "HEAD"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                branch = result.stdout.strip()
            except subprocess.CalledProcessError:
                branch = name

            port_config = PortConfig(
                name=branch,
                nextjs_offset=offset // 10,
                supabase_offset=offset,
                project_id=branch_to_project_id(branch),
                is_static=False,
            )

        # Check if template exists
        template_path = path / "supabase" / "config.toml.template"
        if not template_path.exists():
            print("    ⚠️  Skipping: No template found")
            continue

        # Generate and write config.toml
        try:
            config_content = generate_config_toml(path, port_config)
            config_path = path / "supabase" / "config.toml"
            write_protected_file(config_path, config_content)
            print(f"    ✅ config.toml (API={port_config.api_port})")
        except Exception as e:
            print(f"    ❌ config.toml: {e}")

        # Merge and write .env.local (preserves user keys)
        try:
            env_content = merge_env_local(path, port_config)
            env_path = path / ".env.local"
            write_protected_file(env_path, env_content)
            print(
                f"    ✅ .env.local (Port={port_config.nextjs_port}, user keys preserved)"
            )
        except Exception as e:
            print(f"    ❌ .env.local: {e}")

        # Ensure beads redirect exists for non-main worktrees
        main_beads = Path.cwd() / ".beads"
        wt_beads = path / ".beads"
        if main_beads.is_dir() and not (wt_beads / "dolt").exists():
            wt_beads.mkdir(exist_ok=True)
            redirect_file = wt_beads / "redirect"
            if not redirect_file.exists():
                rel_path = os.path.relpath(main_beads, path)
                redirect_file.write_text(rel_path + "\n")
                print("    📋 Beads redirect configured")

    print()
    print("✅ Sync complete!")
    print()

    return 0


# =============================================================================
# Main
# =============================================================================


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PinPoint Worktree Manager - Manage ephemeral worktrees with auto port allocation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ./pinpoint-wt.py create feat/new-feature              Create worktree from origin/main
  ./pinpoint-wt.py create feat/fix --base feat/parent   Create worktree from specific branch
  ./pinpoint-wt.py list                                 Show all worktrees
  ./pinpoint-wt.py sync                                 Regenerate config for current worktree
  ./pinpoint-wt.py sync --all                           Regenerate config for all worktrees
  ./pinpoint-wt.py remove feat/new-feature              Remove worktree and cleanup
        """,
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # create
    create_parser = subparsers.add_parser("create", help="Create ephemeral worktree")
    create_parser.add_argument("branch", help="Branch name (e.g., feat/new-feature)")
    create_parser.add_argument(
        "--base",
        "-b",
        default="origin/main",
        help="Base revision/branch to create from (default: origin/main)",
    )
    create_parser.add_argument(
        "--json",
        action="store_true",
        help="Output machine-readable JSON on stdout; route human output to stderr",
    )

    # list
    subparsers.add_parser("list", help="List all worktrees with port assignments")

    # remove
    remove_parser = subparsers.add_parser("remove", help="Remove ephemeral worktree")
    remove_parser.add_argument("branch", help="Branch name to remove")
    remove_parser.add_argument(
        "--json",
        action="store_true",
        help="Output machine-readable JSON on stdout; route human output to stderr",
    )

    # sync
    sync_parser = subparsers.add_parser("sync", help="Regenerate config files")
    sync_parser.add_argument("--all", action="store_true", help="Sync all worktrees")

    args = parser.parse_args()

    commands = {
        "create": cmd_create,
        "list": cmd_list,
        "remove": cmd_remove,
        "sync": cmd_sync,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
