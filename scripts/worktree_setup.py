#!/usr/bin/env python3
"""
Worktree port setup — called by .husky/post-checkout.

Detects fresh worktrees and configures them with unique Supabase ports.
Existing worktrees get their configs regenerated on branch switch.
Not a CLI tool — no argparse, no subcommands. Operates on $PWD.
"""

import fcntl
import json
import os
import re
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# =============================================================================
# Constants
# =============================================================================

BASE_PORT_NEXTJS = 3000
BASE_PORT_API = 54321
BASE_PORT_DB = 54322
BASE_PORT_SHADOW = 54320
BASE_PORT_POOLER = 54329
BASE_PORT_INBUCKET = 54324
BASE_PORT_SMTP = 54325
BASE_PORT_POP3 = 54326
# Brainstorm server port: slot 1 → 49001, slot 96 → 49096. Within IANA dynamic range.
BASE_PORT_BRAINSTORM = 49000

MANIFEST_PATH = Path.home() / ".config" / "pinpoint" / "worktree-slots.json"

# Local Supabase uses static demo keys (same across all instances)
LOCAL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
LOCAL_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

# Keys that this script manages (port-dependent and local dev defaults)
MANAGED_ENV_KEYS = {
    "NEXT_PUBLIC_SUPABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "PORT",
    "NEXT_PUBLIC_SITE_URL",
    "EMAIL_TRANSPORT",
    "MAILPIT_PORT",
    "MAILPIT_SMTP_PORT",
    "INBUCKET_PORT",
    "INBUCKET_SMTP_PORT",
    "DEV_AUTOLOGIN_ENABLED",
    "DEV_AUTOLOGIN_EMAIL",
    "DEV_AUTOLOGIN_PASSWORD",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
}

CONFIG_HEADER = """\
# ⚠️ AUTO-GENERATED — DO NOT EDIT ⚠️
# Managed by: scripts/worktree_setup.py (via post-checkout hook)
# To modify: edit supabase/config.toml.template, then switch branches to regenerate
#
"""

ENV_HEADER = """\
# ⚠️ PORTS MANAGED BY worktree_setup.py — other keys preserved ⚠️
# Port-related keys are auto-updated on branch switch. Custom keys are preserved.
# To add custom vars: chmod +w .env.local, edit, then switch branches to regenerate.
#
"""


# =============================================================================
# PortConfig
# =============================================================================


@dataclass
class PortConfig:
    """All ports for a worktree, derived from a single slot number."""

    slot: int
    project_id: str
    name: str

    @property
    def nextjs_port(self) -> int:
        return BASE_PORT_NEXTJS + self.slot * 10

    @property
    def _offset(self) -> int:
        return self.slot * 100

    @property
    def api_port(self) -> int:
        return BASE_PORT_API + self._offset

    @property
    def db_port(self) -> int:
        return BASE_PORT_DB + self._offset

    @property
    def shadow_port(self) -> int:
        return BASE_PORT_SHADOW + self._offset

    @property
    def pooler_port(self) -> int:
        return BASE_PORT_POOLER + self._offset

    @property
    def inbucket_port(self) -> int:
        return BASE_PORT_INBUCKET + self._offset

    @property
    def smtp_port(self) -> int:
        return BASE_PORT_SMTP + self._offset

    @property
    def pop3_port(self) -> int:
        return BASE_PORT_POP3 + self._offset

    @property
    def brainstorm_port(self) -> int:
        return BASE_PORT_BRAINSTORM + self.slot

    @property
    def site_url(self) -> str:
        return f"http://localhost:{self.nextjs_port}"


# =============================================================================
# Manifest (port slot allocation)
# =============================================================================


def load_manifest() -> dict[str, int]:
    """Load the slot manifest, creating it if missing. Tolerates corruption."""
    if not MANIFEST_PATH.exists():
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST_PATH.write_text(json.dumps({"version": 1, "slots": {}}, indent=2))
    try:
        data = json.loads(MANIFEST_PATH.read_text())
        return data.get("slots", {})
    except (json.JSONDecodeError, KeyError):
        return {}


def save_manifest(slots: dict[str, int]) -> None:
    """Write the slot manifest (not atomic — callers use flock for safety)."""
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps({"version": 1, "slots": slots}, indent=2) + "\n"
    )


def prune_manifest(slots: dict[str, int]) -> dict[str, int]:
    """Remove entries whose worktree directories no longer exist."""
    return {path: slot for path, slot in slots.items() if Path(path).is_dir()}


MAX_SLOT = 96  # slot 96 → offset 9600 → max port 63921 (within integration test range)


def _read_manifest_locked(f: object) -> dict[str, int]:
    """Read and parse manifest from a locked file handle, tolerating corruption."""
    try:
        data = json.loads(f.read())  # type: ignore[union-attr]
        return data.get("slots", {})
    except (json.JSONDecodeError, KeyError):
        return {}


def _write_manifest_locked(f: object, slots: dict[str, int]) -> None:
    """Rewrite the manifest file from a locked file handle."""
    f.seek(0)  # type: ignore[union-attr]
    f.truncate()  # type: ignore[union-attr]
    f.write(json.dumps({"version": 1, "slots": slots}, indent=2) + "\n")  # type: ignore[union-attr]


def allocate_slot(worktree_path: str) -> int:
    """Allocate the lowest free slot for a worktree, with file locking."""
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not MANIFEST_PATH.exists():
        MANIFEST_PATH.write_text(json.dumps({"version": 1, "slots": {}}, indent=2))

    with open(MANIFEST_PATH, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            slots = _read_manifest_locked(f)
            pruned = prune_manifest(slots)
            changed = pruned != slots
            slots = pruned

            # Return existing slot (persist prune if needed)
            if worktree_path in slots:
                if changed:
                    _write_manifest_locked(f, slots)
                return slots[worktree_path]

            used = set(slots.values())
            for candidate in range(1, MAX_SLOT + 1):
                if candidate not in used:
                    slots[worktree_path] = candidate
                    _write_manifest_locked(f, slots)
                    return candidate

            raise RuntimeError(f"No free port slots (all {MAX_SLOT} in use)")
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def get_existing_slot(worktree_path: str) -> int | None:
    """Get the slot for a worktree that's already in the manifest."""
    slots = load_manifest()
    return slots.get(worktree_path)


# =============================================================================
# Config generation
# =============================================================================


def branch_to_project_id(branch_name: str) -> str:
    """Convert a branch name to a valid Supabase project ID."""
    project_id = re.sub(r"[^a-z0-9-]", "-", branch_name.lower())
    project_id = re.sub(r"-+", "-", f"pinpoint-{project_id}").strip("-")
    return project_id[:50]


def generate_config_toml(worktree_path: Path, port_config: PortConfig) -> str:
    """Generate config.toml from template with port substitutions."""
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

    # Replace ports using word-boundary matching (each base port is unique)
    port_map = {
        BASE_PORT_API: port_config.api_port,
        BASE_PORT_DB: port_config.db_port,
        BASE_PORT_SHADOW: port_config.shadow_port,
        BASE_PORT_POOLER: port_config.pooler_port,
        BASE_PORT_INBUCKET: port_config.inbucket_port,
        BASE_PORT_SMTP: port_config.smtp_port,
        BASE_PORT_POP3: port_config.pop3_port,
    }
    for old_port, new_port in port_map.items():
        if old_port != new_port:
            content = re.sub(rf"\b{old_port}\b", str(new_port), content)

    # Replace site_url and redirect URLs (port 3000 → worktree's port)
    if port_config.nextjs_port != BASE_PORT_NEXTJS:
        content = content.replace(
            f"localhost:{BASE_PORT_NEXTJS}", f"localhost:{port_config.nextjs_port}"
        )

    return CONFIG_HEADER + content


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse .env file into dict, ignoring comments and blank lines."""
    result: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result


def format_env_file(
    managed_values: dict[str, str], user_values: dict[str, str], port_config: PortConfig
) -> str:
    """Format environment variables into organized .env file content."""
    lines = [
        ENV_HEADER.rstrip(),
        f"# Worktree: {port_config.name} (slot {port_config.slot})",
        f"# Ports: Next.js={port_config.nextjs_port}, Supabase API={port_config.api_port}, DB={port_config.db_port}",
        "",
        "# === Managed by worktree_setup.py (do not edit) ===",
        f"NEXT_PUBLIC_SUPABASE_URL={managed_values['NEXT_PUBLIC_SUPABASE_URL']}",
        f"POSTGRES_URL={managed_values['POSTGRES_URL']}",
        f"POSTGRES_URL_NON_POOLING={managed_values['POSTGRES_URL_NON_POOLING']}",
        f"PORT={managed_values['PORT']}",
        f"NEXT_PUBLIC_SITE_URL={managed_values['NEXT_PUBLIC_SITE_URL']}",
        "",
        "# Email Configuration (Mailpit)",
        f"EMAIL_TRANSPORT={managed_values['EMAIL_TRANSPORT']}",
        f"MAILPIT_PORT={managed_values['MAILPIT_PORT']}",
        f"MAILPIT_SMTP_PORT={managed_values['MAILPIT_SMTP_PORT']}",
        f"INBUCKET_PORT={managed_values['INBUCKET_PORT']}",
        f"INBUCKET_SMTP_PORT={managed_values['INBUCKET_SMTP_PORT']}",
        "",
        "# Dev autologin",
        f"DEV_AUTOLOGIN_ENABLED={managed_values['DEV_AUTOLOGIN_ENABLED']}",
        f"DEV_AUTOLOGIN_EMAIL={managed_values['DEV_AUTOLOGIN_EMAIL']}",
        f"DEV_AUTOLOGIN_PASSWORD={managed_values['DEV_AUTOLOGIN_PASSWORD']}",
        "",
        "# Supabase keys (static for local dev)",
        f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={managed_values['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']}",
        f"SUPABASE_SERVICE_ROLE_KEY={managed_values['SUPABASE_SERVICE_ROLE_KEY']}",
        "",
        "# Cloudflare Turnstile test keys (always pass for local dev)",
        f"NEXT_PUBLIC_TURNSTILE_SITE_KEY={managed_values['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}",
        f"TURNSTILE_SECRET_KEY={managed_values['TURNSTILE_SECRET_KEY']}",
    ]

    # Preserve custom user keys
    custom_keys = {k: v for k, v in user_values.items() if k not in MANAGED_ENV_KEYS}
    if custom_keys:
        lines.append("")
        lines.append("# === Custom keys (preserved on regeneration) ===")
        for key, value in custom_keys.items():
            lines.append(f"{key}={value}")

    lines.append("")
    return "\n".join(lines)


def merge_env_local(worktree_path: Path, port_config: PortConfig) -> str:
    """Generate .env.local content, preserving user-provided custom keys."""
    env_file = worktree_path / ".env.local"

    managed_values = {
        "NEXT_PUBLIC_SUPABASE_URL": f"http://localhost:{port_config.api_port}",
        "POSTGRES_URL": f"postgresql://postgres:postgres@localhost:{port_config.db_port}/postgres",
        "POSTGRES_URL_NON_POOLING": f"postgresql://postgres:postgres@localhost:{port_config.db_port}/postgres",
        "PORT": str(port_config.nextjs_port),
        "NEXT_PUBLIC_SITE_URL": port_config.site_url,
        "EMAIL_TRANSPORT": "smtp",
        "MAILPIT_PORT": str(port_config.inbucket_port),
        "MAILPIT_SMTP_PORT": str(port_config.smtp_port),
        "INBUCKET_PORT": str(port_config.inbucket_port),
        "INBUCKET_SMTP_PORT": str(port_config.smtp_port),
        "DEV_AUTOLOGIN_ENABLED": "true",
        "DEV_AUTOLOGIN_EMAIL": "admin@test.com",
        "DEV_AUTOLOGIN_PASSWORD": "TestPassword123",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": LOCAL_SUPABASE_PUBLISHABLE_KEY,
        "SUPABASE_SERVICE_ROLE_KEY": LOCAL_SUPABASE_SERVICE_ROLE_KEY,
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY": "1x00000000000000000000AA",
        "TURNSTILE_SECRET_KEY": "1x0000000000000000000000000000000AA",
    }

    user_values: dict[str, str] = {}
    if env_file.exists():
        existing = parse_env_file(env_file)
        user_values = {k: v for k, v in existing.items() if k not in MANAGED_ENV_KEYS}

    return format_env_file(managed_values, user_values, port_config)


def write_protected_file(path: Path, content: str) -> None:
    """Write a file and set it to read-only (444)."""
    if path.exists():
        path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    path.write_text(content)
    path.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)


def resolve_brainstorm_server_path() -> str | None:
    """Find the highest-version superpowers brainstorming start-server.sh.

    Returns the absolute path of the start-server.sh script under the highest
    semver version of the installed superpowers plugin, or None if no install
    is found (e.g., the plugin isn't installed yet — this is fine).
    """
    plugin_root = (
        Path.home()
        / ".claude"
        / "plugins"
        / "cache"
        / "claude-plugins-official"
        / "superpowers"
    )
    matches = list(plugin_root.glob("*/skills/brainstorming/scripts/start-server.sh"))
    if not matches:
        return None

    def _version_key(path: Path) -> tuple[int, ...]:
        # Path layout: .../superpowers/<version>/skills/brainstorming/scripts/start-server.sh
        # The version segment is 4 levels above start-server.sh.
        version_segment = path.parents[3].name
        parts: list[int] = []
        for piece in version_segment.split("."):
            try:
                parts.append(int(piece))
            except ValueError:
                # Non-numeric segments sort lowest so stable releases beat them.
                parts.append(-1)
        return tuple(parts)

    best = max(matches, key=_version_key)
    return str(best.resolve())


def generate_launch_json(worktree_path: Path, port_config: PortConfig) -> None:
    """Generate .claude/launch.json with the worktree's Next.js + brainstorm ports."""
    claude_dir = worktree_path / ".claude"
    claude_dir.mkdir(exist_ok=True)
    launch_path = claude_dir / "launch.json"

    configurations: list[dict[str, object]] = [
        {
            "name": "next-dev",
            "runtimeExecutable": "pnpm",
            "runtimeArgs": ["run", "dev"],
            "port": port_config.nextjs_port,
        }
    ]

    brainstorm_path = resolve_brainstorm_server_path()
    if brainstorm_path is not None:
        configurations.append(
            {
                "name": "brainstorm",
                "runtimeExecutable": "bash",
                "runtimeArgs": [
                    "-c",
                    (
                        f"BRAINSTORM_PORT={port_config.brainstorm_port} "
                        f'{brainstorm_path} --project-dir "$PWD" --foreground'
                    ),
                ],
                "port": port_config.brainstorm_port,
            }
        )

    content = json.dumps(
        {
            "version": "0.0.1",
            "configurations": configurations,
        },
        indent=2,
    )
    launch_path.write_text(content + "\n")


# =============================================================================
# Main
# =============================================================================


def get_main_worktree() -> Path:
    """Get the path to the main (first) worktree."""
    result = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        capture_output=True,
        text=True,
        check=True,
    )
    for line in result.stdout.splitlines():
        if line.startswith("worktree "):
            return Path(line[9:])
    raise RuntimeError("Could not determine main worktree")


def get_branch() -> str:
    """Get the current branch name."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def main() -> None:
    worktree_path = Path.cwd().resolve()

    # Skip if this is the main worktree (uses default ports)
    try:
        main_wt = get_main_worktree()
        if worktree_path == main_wt.resolve():
            return
    except (subprocess.CalledProcessError, RuntimeError):
        return

    branch = get_branch()
    project_id = branch_to_project_id(branch)
    worktree_key = str(worktree_path)

    # Check if we already have a slot (branch switch) or need a new one (fresh worktree)
    existing_slot = get_existing_slot(worktree_key)
    if existing_slot is not None:
        slot = existing_slot
    else:
        slot = allocate_slot(worktree_key)

    port_config = PortConfig(slot=slot, project_id=project_id, name=branch)

    # Generate configs
    try:
        config_content = generate_config_toml(worktree_path, port_config)
        config_path = worktree_path / "supabase" / "config.toml"
        write_protected_file(config_path, config_content)
    except FileNotFoundError:
        pass  # No template — skip config.toml generation

    env_content = merge_env_local(worktree_path, port_config)
    env_path = worktree_path / ".env.local"
    write_protected_file(env_path, env_content)

    generate_launch_json(worktree_path, port_config)

    # Install dependencies if this is a fresh worktree
    if not (worktree_path / "node_modules").exists():
        result = subprocess.run(
            ["pnpm", "install", "--frozen-lockfile"],
            cwd=worktree_path,
        )
        if result.returncode != 0:
            print(
                f"worktree_setup: warning: pnpm install failed "
                f"(exit {result.returncode}) in {worktree_path}",
                file=sys.stderr,
            )

    # Set up beads redirect
    main_beads = main_wt / ".beads"
    wt_beads = worktree_path / ".beads"
    if main_beads.is_dir() and not (wt_beads / "dolt").exists():
        wt_beads.mkdir(exist_ok=True)
        redirect_file = wt_beads / "redirect"
        if not redirect_file.exists():
            rel_path = os.path.relpath(main_beads, worktree_path)
            redirect_file.write_text(rel_path + "\n")

    # Print summary to stderr (post-checkout output goes to terminal)
    print(
        f"worktree_setup: slot={slot} "
        f"nextjs={port_config.nextjs_port} "
        f"api={port_config.api_port} "
        f"db={port_config.db_port}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
