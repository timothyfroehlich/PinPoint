#!/usr/bin/env python3
import subprocess
import sys
import tomllib
from pathlib import Path

CONFIG_TEMPLATE_PATH = Path("supabase/config.toml.template")


def get_git_config():
    """Read the config.toml from HEAD using git show."""
    try:
        result = subprocess.run(
            ["git", "show", "HEAD:supabase/config.toml"],
            capture_output=True,
            text=True,
            check=True,
        )
        return tomllib.loads(result.stdout)
    except subprocess.CalledProcessError:
        # If file doesn't exist in HEAD, fall back to template so local ports
        # (set per-worktree) don't cause false drift errors.
        if CONFIG_TEMPLATE_PATH.exists():
            return tomllib.loads(CONFIG_TEMPLATE_PATH.read_text())
        return {}
    except Exception as e:
        print(f"Error reading git config: {e}", file=sys.stderr)
        sys.exit(1)


def get_local_config():
    """Read the local supabase/config.toml."""
    try:
        path = Path("supabase/config.toml")
        if not path.exists():
            print("Error: supabase/config.toml not found", file=sys.stderr)
            sys.exit(1)
        return tomllib.loads(path.read_text())
    except Exception as e:
        print(f"Error reading local config: {e}", file=sys.stderr)
        sys.exit(1)


def flatten_keys(d, parent_key="", sep="."):
    """Flatten a dictionary to a set of dot-notation keys."""
    keys = set()
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        keys.add(new_key)
        if isinstance(v, dict):
            keys.update(flatten_keys(v, new_key, sep=sep))
    return keys


def main():
    print("🔍 Checking for uncommitted Supabase config keys...")

    git_config = get_git_config()
    local_config = get_local_config()

    git_keys = flatten_keys(git_config)
    local_keys = flatten_keys(local_config)

    # Check for keys present locally but missing in git
    # We ignore value differences (ports), only care about structural keys
    missing_in_git = local_keys - git_keys

    if missing_in_git:
        print(
            "\n❌ ERROR: Found configuration keys in 'supabase/config.toml' that are NOT committed to git:",
            file=sys.stderr,
        )
        for k in sorted(missing_in_git):
            print(f"   - {k}", file=sys.stderr)
        print(
            "\nThis usually happens when you add a new configuration (like 'smtp_port') locally",
            file=sys.stderr,
        )
        print("but 'skip-worktree' prevents it from being committed.", file=sys.stderr)
        print("\nTO FIX:", file=sys.stderr)
        print(
            "1. Run: git update-index --no-skip-worktree supabase/config.toml",
            file=sys.stderr,
        )
        print(
            "2. Commit the changes (revert ports to standard 5432x if needed, but KEEP the new keys)",
            file=sys.stderr,
        )
        print(
            "3. Run: git update-index --skip-worktree supabase/config.toml",
            file=sys.stderr,
        )
        sys.exit(1)

    print("✅ Supabase config structure matches git.")
    sys.exit(0)


if __name__ == "__main__":
    main()
