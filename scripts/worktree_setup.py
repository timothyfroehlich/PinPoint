#!/usr/bin/env python3
"""
Worktree port setup — called by .husky/post-checkout.

Detects fresh worktrees and configures them with unique Supabase ports.
Existing worktrees get their configs regenerated on branch switch.
Not a CLI tool — no argparse, no subcommands. Operates on $PWD.
"""

import fcntl
import hashlib
import json
import os
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path

# =============================================================================
# Constants
# =============================================================================

DEFAULT_INSTALL_TIMEOUT = 120  # seconds

# Failure classes for dependency setup
FAILURE_CLASS_MISSING_TOOL = "missing-tool"
FAILURE_CLASS_TIMEOUT = "timeout"
FAILURE_CLASS_NETWORK = "network"
FAILURE_CLASS_INSTALL = "install"
FAILURE_CLASS_TOOLCHAIN_CONFIG = "toolchain-config"

# Exit codes for worktree_setup.py
EXIT_READY = 0
EXIT_INCOMPLETE = 1

BASE_PORT_NEXTJS = 3000
BASE_PORT_API = 54321
BASE_PORT_DB = 54322
BASE_PORT_SHADOW = 54320
BASE_PORT_POOLER = 54329
BASE_PORT_INBUCKET = 54324
BASE_PORT_SMTP = 54325
BASE_PORT_POP3 = 54326
# Brainstorm server port: slot 1 → 49001, slot 96 → 49096. Uses high, non-privileged ports.
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
    "UNSUBSCRIBE_SIGNING_SECRET",
}

CONFIG_HEADER = """\
# ⚠️ AUTO-GENERATED — DO NOT EDIT ⚠️
# Managed by: scripts/worktree_setup.py (via post-checkout hook)
# To modify: edit supabase/config.toml.template, then switch branches to regenerate
#
# project_id is pinned on first setup and preserved across branch switches —
# it names the Supabase containers/volumes, so changing it would orphan a
# running stack (PP-4936).
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


# Supabase container names follow `supabase_<service>_<project_id>` and must
# fit Docker's 63-char container name limit. The longest active service prefix
# observed in practice is `supabase_inbucket_` (18 chars); `supabase_edge_runtime_`
# (22 chars) is a future risk. Capping project_id at 40 leaves headroom for
# either.
#
# For short branches whose sanitized form fits in 40 chars, the whole readable
# name is preserved (e.g., "pinpoint-main"). For long branches, the readable
# portion is truncated to MAX_READABLE_LEN (31) and an 8-char hash is appended;
# of those 31 chars the leading "pinpoint-" consumes 9, leaving up to 22 chars
# of branch text (potentially fewer after rstrip("-") trims a truncation that
# landed on a hyphen).
MAX_PROJECT_ID_LEN = 40
HASH_SUFFIX_LEN = 8
# +1 for the "-" separator joining the readable part to the hash.
MAX_READABLE_LEN = MAX_PROJECT_ID_LEN - HASH_SUFFIX_LEN - 1


def branch_to_project_id(branch_name: str) -> str:
    """Convert a branch name to a valid Supabase project ID.

    Short branches keep their full readable name (e.g., "main" → "pinpoint-main").
    Long branches are truncated and suffixed with an 8-char sha256 hash of the
    original branch name, preserving uniqueness across worktrees on different
    long branches that share a common prefix.

    Cap is 40 chars; see MAX_PROJECT_ID_LEN comment above for why.
    """
    sanitized = re.sub(r"[^a-z0-9-]", "-", branch_name.lower())
    full = re.sub(r"-+", "-", f"pinpoint-{sanitized}").strip("-")
    if len(full) <= MAX_PROJECT_ID_LEN:
        return full
    digest = hashlib.sha256(branch_name.encode("utf-8")).hexdigest()[:HASH_SUFFIX_LEN]
    readable = full[:MAX_READABLE_LEN].rstrip("-")
    return f"{readable}-{digest}"


# A worktree's project id is pinned on first setup and reused from then on,
# rather than re-derived from the branch on every checkout. Supabase names its
# containers and labels its volumes after the project id, so re-deriving it
# after `git checkout -b` inside a live worktree renames the stack out from
# under itself: `supabase stop` targets an id that matches nothing, the old
# containers keep the slot's ports bound (so `supabase start` fails with
# "address already in use"), and every cleanup path that looks resources up by
# the new id leaves the old ones behind. (PP-4936.)
_PINNED_PROJECT_ID_RE = re.compile(r'^project_id\s*=\s*"([^"]+)"', re.MULTILINE)

# A pinned id is only honored when it has the shape branch_to_project_id emits.
# worktree_orphan_sweep.py identifies PinPoint-owned Supabase resources by the
# "pinpoint-" prefix, so honoring a hand-written id outside that shape would
# make the worktree's containers invisible to the sweep. This also rejects the
# template's bare `project_id = "pinpoint"`, so a config.toml copied straight
# from the template still gets a real per-worktree id. Matched with fullmatch:
# `$` would accept a trailing newline, which would corrupt the id we write back.
_PINNABLE_PROJECT_ID_RE = re.compile(r"pinpoint-[a-z0-9-]*")


def read_pinned_project_id(worktree_path: Path) -> str | None:
    """Return the project_id already recorded in this worktree's config.toml.

    The generated `supabase/config.toml` is the file the Supabase CLI itself
    reads, so it is the authoritative record of the id the worktree's stack was
    started under — the same assumption worktree_orphan_sweep.py makes.

    Returns None when the file is absent (fresh worktree — nothing to preserve),
    unreadable, has no project_id, or carries an id that doesn't match the shape
    this script generates. Never raises: this runs from the post-checkout hook,
    where an exception would skip the rest of the worktree's config generation.
    """
    try:
        content = (worktree_path / "supabase" / "config.toml").read_text()
    except (OSError, UnicodeDecodeError):
        return None

    match = _PINNED_PROJECT_ID_RE.search(content)
    if match is None:
        return None

    candidate = match.group(1)
    if len(candidate) > MAX_PROJECT_ID_LEN:
        return None
    if not _PINNABLE_PROJECT_ID_RE.fullmatch(candidate):
        return None
    return candidate


def resolve_project_id(worktree_path: Path, branch: str) -> str:
    """Pick the Supabase project id for a worktree — a pinned id always wins.

    Falls back to deriving one from the branch name for a fresh worktree (or a
    config.toml we can't read an id out of). Logs when the two disagree, since
    that means the branch was renamed after the worktree was set up.
    """
    derived = branch_to_project_id(branch)
    pinned = read_pinned_project_id(worktree_path)
    if pinned is None:
        return derived
    if pinned != derived:
        print(
            f"worktree_setup: keeping pinned Supabase project_id '{pinned}' "
            f"(branch '{branch}' would derive '{derived}') — renaming it would "
            "orphan this worktree's running stack",
            file=sys.stderr,
        )
    return pinned


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
        "# Unsubscribe-link HMAC signing secret (local-dev placeholder).",
        "# Production uses a real `openssl rand -hex 32` value set in Vercel env.",
        f"UNSUBSCRIBE_SIGNING_SECRET={managed_values['UNSUBSCRIBE_SIGNING_SECRET']}",
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


def _read_user_keys(env_file: Path) -> dict[str, str]:
    """Read non-managed (user-supplied) keys from a .env.local file.
    Returns {} when the file doesn't exist."""
    if not env_file.exists():
        return {}
    existing = parse_env_file(env_file)
    return {k: v for k, v in existing.items() if k not in MANAGED_ENV_KEYS}


# Local-dev placeholder for UNSUBSCRIBE_SIGNING_SECRET. Real production values
# come from Vercel env. We treat the secret as managed (so it lives in the
# managed slot of the file) but preserve any non-placeholder value the
# developer set, so chmod-+w / edit / regenerate doesn't stomp the real value.
UNSUBSCRIBE_SIGNING_SECRET_PLACEHOLDER = (
    "local-dev-only-not-a-real-secret-0000000000000000000000000000000000"
)


def _read_managed_value(env_file: Path, key: str) -> str | None:
    """Read a single MANAGED key's existing value from a .env.local file.

    Bypasses the MANAGED_ENV_KEYS filter so callers can preserve user-set
    values for keys that are conceptually managed (e.g., signing secrets).
    Returns None when the file or key is absent.
    """
    if not env_file.exists():
        return None
    existing = parse_env_file(env_file)
    return existing.get(key)


def _resolve_unsubscribe_secret(worktree_path: Path, main_path: Path | None) -> str:
    """Pick the best UNSUBSCRIBE_SIGNING_SECRET for this worktree.

    Precedence (target > main > placeholder), and any value that is not the
    placeholder wins over the placeholder. This means a developer's real
    secret in main's .env.local automatically propagates to fresh worktrees,
    and a per-worktree edit is preserved across regenerations.
    """
    candidates: list[str | None] = [
        _read_managed_value(worktree_path / ".env.local", "UNSUBSCRIBE_SIGNING_SECRET"),
    ]
    if main_path is not None and main_path != worktree_path:
        candidates.append(
            _read_managed_value(main_path / ".env.local", "UNSUBSCRIBE_SIGNING_SECRET")
        )

    for value in candidates:
        if value and value != UNSUBSCRIBE_SIGNING_SECRET_PLACEHOLDER:
            return value
    return UNSUBSCRIBE_SIGNING_SECRET_PLACEHOLDER


def merge_env_local(worktree_path: Path, port_config: PortConfig) -> str:
    """Generate .env.local content, preserving user-provided custom keys.

    On first creation a new worktree has no .env.local of its own, so we
    fall back to the main worktree's user keys (e.g., third-party API
    keys, OAuth secrets, Discord bot tokens). Per-worktree overrides
    always win — main's keys only fill gaps. This makes shared secrets
    propagate automatically without manual copying.
    """
    target_keys = _read_user_keys(worktree_path / ".env.local")

    main_path: Path | None = None
    main_keys: dict[str, str] = {}
    try:
        main_path = get_main_worktree()
        if main_path != worktree_path:
            main_keys = _read_user_keys(main_path / ".env.local")
    except Exception:
        # If git worktree introspection fails for any reason, just skip
        # the inheritance step rather than blocking the whole setup.
        pass

    # Target wins; main fills gaps.
    user_values = {**main_keys, **target_keys}

    unsubscribe_secret = _resolve_unsubscribe_secret(worktree_path, main_path)

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
        # Unsubscribe-link HMAC signing secret. Falls back to a placeholder
        # only when no real value is set; preserves any developer-set value
        # so chmod-+w / edit / regenerate doesn't overwrite it.
        "UNSUBSCRIBE_SIGNING_SECRET": unsubscribe_secret,
    }

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
    installed version directory of the superpowers plugin using dotted numeric
    comparison, with non-numeric segments sorting lower, or None if no install
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
            "runtimeExecutable": "mise",
            "runtimeArgs": ["exec", "--", "pnpm", "run", "dev"],
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
                        f'{shlex.quote(brainstorm_path)} --project-dir "$PWD" --foreground'
                    ),
                ],
                "port": port_config.brainstorm_port,
            }
        )

    # Bead Me Up Scotty — host-global beads viewer, attach-only (no command:
    # the server is started outside the worktree). Port is fixed, not slotted.
    configurations.append(
        {
            "name": "scotty",
            "url": "http://localhost:8765/p/pinpoint",
            "port": 8765,
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
# Diagnostics and Dependencies
# =============================================================================


@dataclass
class RuntimeInfo:
    """Executable path and version diagnostic for one runtime."""

    path: str | None
    version: str | None


@dataclass
class RuntimeDiagnostics:
    """Runtime diagnostics for critical development toolchains."""

    python: RuntimeInfo
    node: RuntimeInfo
    pnpm: RuntimeInfo
    git: RuntimeInfo

    def format_summary(self) -> str:
        parts: list[str] = []
        for name, info in [
            ("python", self.python),
            ("node", self.node),
            ("pnpm", self.pnpm),
            ("git", self.git),
        ]:
            if info.path:
                v_str = f" ({info.version})" if info.version else ""
                parts.append(f"{name}={info.path}{v_str}")
            else:
                parts.append(f"{name}=<not found>")
        return " ".join(parts)


@dataclass(frozen=True)
class BootstrapToolchain:
    """Exact preinstalled Node and pnpm executables for dependency bootstrap."""

    node_path: Path
    node_version: str
    pnpm_path: Path
    pnpm_version: str

    def environment(self) -> dict[str, str]:
        env = os.environ.copy()
        env["MISE_NOT_FOUND_AUTO_INSTALL"] = "false"
        env["MISE_NOT_FOUND_SYSTEM_FALLBACK"] = "false"
        env["PATH"] = f"{self.node_path.parent}{os.pathsep}{env.get('PATH', '')}"
        return env


def _probe_version(
    executable_path: str | Path,
    args: list[str],
    env: dict[str, str] | None = None,
) -> str | None:
    try:
        res = subprocess.run(
            [executable_path, *args],
            capture_output=True,
            text=True,
            timeout=5,
            env=env,
        )
        if res.returncode == 0:
            return res.stdout.strip()
    except Exception:
        pass
    return None


def collect_runtime_diagnostics(
    toolchain: BootstrapToolchain | None = None,
    *,
    probe_path_tools: bool = True,
) -> RuntimeDiagnostics:
    """Collect paths and versions for python, node, pnpm, and git."""
    py_info = RuntimeInfo(path=sys.executable, version=platform.python_version())

    if toolchain is not None:
        node_info = RuntimeInfo(
            path=str(toolchain.node_path), version=f"v{toolchain.node_version}"
        )
        pnpm_info = RuntimeInfo(
            path=str(toolchain.pnpm_path), version=toolchain.pnpm_version
        )
    elif probe_path_tools:
        node_path = shutil.which("node")
        node_ver = _probe_version(node_path, ["--version"]) if node_path else None
        node_info = RuntimeInfo(path=node_path, version=node_ver)

        pnpm_path = shutil.which("pnpm")
        pnpm_ver = _probe_version(pnpm_path, ["--version"]) if pnpm_path else None
        pnpm_info = RuntimeInfo(path=pnpm_path, version=pnpm_ver)
    else:
        node_info = RuntimeInfo(path=None, version=None)
        pnpm_info = RuntimeInfo(path=None, version=None)

    git_path = shutil.which("git")
    git_raw = _probe_version(git_path, ["--version"]) if git_path else None
    git_ver = git_raw.removeprefix("git version ") if git_raw else None
    git_info = RuntimeInfo(path=git_path, version=git_ver)

    return RuntimeDiagnostics(
        python=py_info, node=node_info, pnpm=pnpm_info, git=git_info
    )


_EXACT_VERSION_RE = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
_PNPM_PACKAGE_MANAGER_RE = re.compile(
    r"pnpm@(?P<version>[0-9]+\.[0-9]+\.[0-9]+)\+sha512\.(?P<integrity>[0-9a-f]{128})"
)


def read_bootstrap_tool_versions(worktree_path: Path) -> tuple[str, str]:
    """Read the exact Node and integrity-qualified pnpm project pins."""
    try:
        mise_config = tomllib.loads((worktree_path / "mise.toml").read_text())
        node_version = mise_config["tools"]["node"]
    except (OSError, tomllib.TOMLDecodeError, KeyError, TypeError) as exc:
        raise ValueError(f"cannot read mise.toml Node pin: {exc}") from exc
    if not isinstance(node_version, str) or not _EXACT_VERSION_RE.fullmatch(
        node_version
    ):
        raise ValueError("mise.toml [tools].node must be an exact X.Y.Z version")

    try:
        package_config = json.loads((worktree_path / "package.json").read_text())
        package_manager = package_config["packageManager"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ValueError(f"cannot read package.json packageManager pin: {exc}") from exc
    if not isinstance(package_manager, str):
        raise ValueError("package.json packageManager must be a string")
    pnpm_match = _PNPM_PACKAGE_MANAGER_RE.fullmatch(package_manager)
    if pnpm_match is None:
        raise ValueError(
            "package.json packageManager must be exact pnpm@X.Y.Z+sha512.<128 hex>"
        )

    return node_version, pnpm_match.group("version")


def _resolve_mise_install_root(
    mise_path: str, tool: str, version: str
) -> tuple[Path | None, str | None]:
    env = os.environ.copy()
    env["MISE_NOT_FOUND_AUTO_INSTALL"] = "false"
    env["MISE_NOT_FOUND_SYSTEM_FALLBACK"] = "false"
    try:
        result = subprocess.run(
            [mise_path, "--no-config", "where", f"{tool}@{version}"],
            capture_output=True,
            text=True,
            timeout=10,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return None, "mise where timed out after 10s"
    except OSError as exc:
        return None, f"failed to execute mise: {exc}"
    if result.returncode != 0:
        lines = (result.stderr or result.stdout).strip().splitlines()
        detail = lines[-1] if lines else f"mise where exited {result.returncode}"
        return None, detail

    install_root = Path(result.stdout.strip())
    if not install_root.is_dir():
        return None, f"mise reported missing install directory: {install_root}"
    return install_root, None


def resolve_preinstalled_toolchain(
    worktree_path: Path,
) -> tuple[BootstrapToolchain | None, str | None, str | None]:
    """Resolve exact project tools without loading or trusting project config."""
    try:
        node_version, pnpm_version = read_bootstrap_tool_versions(worktree_path)
    except ValueError as exc:
        return None, FAILURE_CLASS_TOOLCHAIN_CONFIG, str(exc)

    mise_path = shutil.which("mise")
    if mise_path is None:
        return None, FAILURE_CLASS_MISSING_TOOL, "mise executable not found in PATH"

    node_root, node_error = _resolve_mise_install_root(mise_path, "node", node_version)
    if node_root is None:
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"preinstalled node@{node_version} not found: {node_error}",
        )
    pnpm_root, pnpm_error = _resolve_mise_install_root(mise_path, "pnpm", pnpm_version)
    if pnpm_root is None:
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"preinstalled pnpm@{pnpm_version} not found: {pnpm_error}",
        )

    node_path = node_root / "bin" / "node"
    pnpm_candidates = [
        pnpm_root / "bin" / "pnpm",
        pnpm_root / "node_modules" / ".bin" / "pnpm",
    ]
    pnpm_path = next(
        (
            path
            for path in pnpm_candidates
            if path.is_file() and os.access(path, os.X_OK)
        ),
        None,
    )
    if not node_path.is_file() or not os.access(node_path, os.X_OK):
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"preinstalled node@{node_version} has no executable at {node_path}",
        )
    if pnpm_path is None:
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"preinstalled pnpm@{pnpm_version} has no pnpm executable",
        )

    toolchain = BootstrapToolchain(
        node_path=node_path,
        node_version=node_version,
        pnpm_path=pnpm_path,
        pnpm_version=pnpm_version,
    )
    actual_node = _probe_version(node_path, ["--version"], toolchain.environment())
    if actual_node != f"v{node_version}":
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"node pin mismatch: expected v{node_version}, got {actual_node or '<none>'}",
        )
    actual_pnpm = _probe_version(pnpm_path, ["--version"], toolchain.environment())
    if actual_pnpm != pnpm_version:
        return (
            None,
            FAILURE_CLASS_MISSING_TOOL,
            f"pnpm pin mismatch: expected {pnpm_version}, got {actual_pnpm or '<none>'}",
        )

    return toolchain, None, None


NETWORK_ERROR_PATTERNS = [
    re.compile(r"\bENOTFOUND\b", re.IGNORECASE),
    re.compile(r"\bETIMEDOUT\b", re.IGNORECASE),
    re.compile(r"\bECONNREFUSED\b", re.IGNORECASE),
    re.compile(r"\bECONNRESET\b", re.IGNORECASE),
    re.compile(r"\bEAI_AGAIN\b", re.IGNORECASE),
    re.compile(r"\bgetaddrinfo\b", re.IGNORECASE),
    re.compile(r"fetch failed", re.IGNORECASE),
    re.compile(r"ERR_PNPM_FETCH_", re.IGNORECASE),
    re.compile(r"network error", re.IGNORECASE),
    re.compile(r"request to .* failed", re.IGNORECASE),
    re.compile(r"CERT_HAS_EXPIRED", re.IGNORECASE),
]


def classify_install_failure(returncode: int, stdout: str, stderr: str) -> str:
    """Classify the failure reason of a dependency install invocation."""
    combined = f"{stdout}\n{stderr}"
    for pat in NETWORK_ERROR_PATTERNS:
        if pat.search(combined):
            return FAILURE_CLASS_NETWORK
    return FAILURE_CLASS_INSTALL


DEFAULT_INSTALL_TIMEOUT: int = 120
MAX_INSTALL_TIMEOUT: int = 150


def resolve_install_timeout() -> int:
    """Determine the install timeout budget in seconds (capped at MAX_INSTALL_TIMEOUT)."""
    env_val = os.environ.get("PINPOINT_WORKTREE_INSTALL_TIMEOUT") or os.environ.get(
        "WORKTREE_INSTALL_TIMEOUT"
    )
    if env_val:
        try:
            val = int(env_val)
            if val > 0:
                return min(val, MAX_INSTALL_TIMEOUT)
        except ValueError:
            pass
    return DEFAULT_INSTALL_TIMEOUT


def are_dependencies_ready(worktree_path: Path) -> bool:
    """Verify that dependencies are fully installed and linked.

    Checks for node_modules/.modules.yaml (pnpm's completion marker written
    only when linking finishes) rather than node_modules directory existence alone,
    preventing partial installs from falsely reporting ready.
    """
    modules_yaml = worktree_path / "node_modules" / ".modules.yaml"
    return modules_yaml.is_file()


def install_dependencies(
    worktree_path: Path,
    timeout: int | None = None,
    toolchain: BootstrapToolchain | None = None,
) -> tuple[bool, str | None, str | None]:
    """Ensure node_modules exists and is completely installed.

    Returns (is_ready, failure_class, detail).
    If node_modules is already present and complete, returns (True, None, None).
    """
    if are_dependencies_ready(worktree_path):
        return True, None, None

    if toolchain is None:
        toolchain, failure_class, detail = resolve_preinstalled_toolchain(worktree_path)
        if toolchain is None:
            return False, failure_class, detail

    if timeout is None:
        timeout = resolve_install_timeout()

    try:
        res = subprocess.run(
            [str(toolchain.pnpm_path), "install", "--frozen-lockfile"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=toolchain.environment(),
        )
        if res.returncode == 0:
            return True, None, None

        failure_class = classify_install_failure(res.returncode, res.stdout, res.stderr)
        lines = (res.stderr or res.stdout).strip().splitlines()
        last_line = lines[-1] if lines else f"exit code {res.returncode}"
        return (
            False,
            failure_class,
            f"pnpm install failed (exit {res.returncode}): {last_line}",
        )
    except subprocess.TimeoutExpired:
        return False, FAILURE_CLASS_TIMEOUT, f"pnpm install timed out after {timeout}s"
    except FileNotFoundError:
        return False, FAILURE_CLASS_MISSING_TOOL, "pnpm executable not found"
    except OSError as exc:
        return False, FAILURE_CLASS_INSTALL, f"failed to execute pnpm: {exc}"


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


def get_current_upstream(branch: str, worktree_path: Path) -> str | None:
    """Return current upstream ref (e.g. 'origin/main') or None if unset."""
    result = subprocess.run(
        [
            "git",
            "-C",
            str(worktree_path),
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            f"{branch}@{{u}}",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def configure_branch_tracking(branch: str, worktree_path: Path) -> None:
    """Set the worktree branch's upstream to origin/<branch> if it exists.

    Preserves custom upstreams; only fixes the stale origin/main default that
    `git worktree add -b` leaves behind. Prints a reminder if no remote ref
    yet. Failures are non-fatal.
    """
    if branch in ("main", "master", "HEAD"):
        return

    current = get_current_upstream(branch, worktree_path)
    if current and current not in ("origin/main", "origin/master", f"origin/{branch}"):
        return  # respect existing custom upstream

    has_remote = (
        subprocess.run(
            [
                "git",
                "-C",
                str(worktree_path),
                "rev-parse",
                "--verify",
                "--quiet",
                f"refs/remotes/origin/{branch}",
            ],
            capture_output=True,
        ).returncode
        == 0
    )

    if not has_remote:
        # Clear the stale origin/main upstream so `git pull` doesn't pull from main.
        if current in ("origin/main", "origin/master"):
            subprocess.run(
                ["git", "-C", str(worktree_path), "branch", "--unset-upstream", branch],
                capture_output=True,
            )
        print(
            f"worktree_setup: '{branch}' has no remote yet — "
            f"run `git push -u origin {shlex.quote(branch)}` on first push",
            file=sys.stderr,
        )
        return

    if current == f"origin/{branch}":
        return

    result = subprocess.run(
        [
            "git",
            "-C",
            str(worktree_path),
            "branch",
            f"--set-upstream-to=origin/{branch}",
            branch,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"worktree_setup: '{branch}' tracks origin/{branch}", file=sys.stderr)
    else:
        print(
            f"worktree_setup: warning: failed to set upstream for '{branch}' "
            f"(exit {result.returncode}): {result.stderr.strip()}",
            file=sys.stderr,
        )


def main() -> int:
    worktree_path = Path.cwd().resolve()

    # Skip if this is the main worktree (uses default ports)
    try:
        main_wt = get_main_worktree()
        if worktree_path == main_wt.resolve():
            return EXIT_READY
    except (subprocess.CalledProcessError, RuntimeError):
        return EXIT_READY

    dependencies_ready = are_dependencies_ready(worktree_path)
    toolchain: BootstrapToolchain | None = None
    toolchain_failure: tuple[str | None, str | None] = (None, None)
    if not dependencies_ready:
        toolchain, failure_class, detail = resolve_preinstalled_toolchain(worktree_path)
        toolchain_failure = (failure_class, detail)

    # Never probe Node or pnpm through PATH from this branch-controlled
    # worktree. A failed exact resolution can otherwise re-enter an untrusted
    # mise shim merely while formatting diagnostics.
    diagnostics = collect_runtime_diagnostics(toolchain, probe_path_tools=False)
    print(f"worktree_setup: runtimes: {diagnostics.format_summary()}", file=sys.stderr)

    branch = get_branch()
    configure_branch_tracking(branch, worktree_path)
    project_id = resolve_project_id(worktree_path, branch)
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

    # Set up beads redirect
    main_beads = main_wt / ".beads"
    wt_beads = worktree_path / ".beads"
    if main_beads.is_dir() and not (wt_beads / "dolt").exists():
        wt_beads.mkdir(exist_ok=True)
        redirect_file = wt_beads / "redirect"
        if not redirect_file.exists():
            rel_path = os.path.relpath(main_beads, worktree_path)
            redirect_file.write_text(rel_path + "\n")

    # Verify / install dependencies
    if dependencies_ready:
        is_ready, failure_class, detail = True, None, None
    elif toolchain is None:
        is_ready = False
        failure_class, detail = toolchain_failure
    else:
        is_ready, failure_class, detail = install_dependencies(
            worktree_path, toolchain=toolchain
        )

    if is_ready:
        print(
            f"worktree_setup: status=ready "
            f"slot={slot} "
            f"project_id={port_config.project_id} "
            f"nextjs={port_config.nextjs_port} "
            f"api={port_config.api_port} "
            f"db={port_config.db_port}",
            file=sys.stderr,
        )
        return EXIT_READY

    print(
        f"worktree_setup: status=incomplete "
        f"failure_class={failure_class} "
        f"detail={detail} "
        f"slot={slot} "
        f"project_id={port_config.project_id}",
        file=sys.stderr,
    )
    return EXIT_INCOMPLETE


if __name__ == "__main__":
    sys.exit(main())
