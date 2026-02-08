"""
Shared library functions for pinpoint-wt.py.

This module contains the core logic that can be imported and tested
without triggering argparse/sys.exit() from the main CLI script.
"""

import re
from dataclasses import dataclass
from pathlib import Path

# =============================================================================
# Configuration Constants
# =============================================================================

# Base ports (Supabase defaults)
BASE_PORT_NEXTJS = 3000
BASE_PORT_API = 54321
BASE_PORT_DB = 54322
BASE_PORT_SHADOW = 54320
BASE_PORT_POOLER = 54329
BASE_PORT_INBUCKET = 54324
BASE_PORT_SMTP = 54325
BASE_PORT_POP3 = 54326

# Local Supabase uses static demo keys (same across all instances)
LOCAL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
LOCAL_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

# Keys that pinpoint-wt.py manages (port-dependent and local dev defaults)
MANAGED_ENV_KEYS = {
    # Port-dependent
    "NEXT_PUBLIC_SUPABASE_URL",
    "DATABASE_URL",
    "PORT",
    "NEXT_PUBLIC_SITE_URL",
    "EMAIL_TRANSPORT",
    "MAILPIT_PORT",
    "MAILPIT_SMTP_PORT",
    "INBUCKET_PORT",
    "INBUCKET_SMTP_PORT",
    # Local dev defaults
    "DEV_AUTOLOGIN_ENABLED",
    "DEV_AUTOLOGIN_EMAIL",
    "DEV_AUTOLOGIN_PASSWORD",
    # Static Supabase keys (same for all local instances)
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
}

# No more USER_PROVIDED_KEYS — Supabase keys are static for local dev
USER_PROVIDED_KEYS: set[str] = set()

ENV_HEADER = """\
# ⚠️ PORTS MANAGED BY pinpoint-wt.py - Other keys preserved ⚠️
# Port-related keys are auto-updated on sync. Other keys (like Supabase keys) are preserved.
# To add custom vars: chmod +w .env.local, edit, then run `./pinpoint-wt.py sync`
#
"""


@dataclass
class PortConfig:
    """Port configuration for a worktree."""

    name: str
    nextjs_offset: int
    supabase_offset: int
    project_id: str
    is_static: bool = False

    @property
    def nextjs_port(self) -> int:
        return BASE_PORT_NEXTJS + self.nextjs_offset

    @property
    def api_port(self) -> int:
        return BASE_PORT_API + self.supabase_offset

    @property
    def db_port(self) -> int:
        return BASE_PORT_DB + self.supabase_offset

    @property
    def shadow_port(self) -> int:
        return BASE_PORT_SHADOW + self.supabase_offset

    @property
    def pooler_port(self) -> int:
        return BASE_PORT_POOLER + self.supabase_offset

    @property
    def inbucket_port(self) -> int:
        return BASE_PORT_INBUCKET + self.supabase_offset

    @property
    def smtp_port(self) -> int:
        return BASE_PORT_SMTP + self.supabase_offset

    @property
    def pop3_port(self) -> int:
        return BASE_PORT_POP3 + self.supabase_offset

    @property
    def site_url(self) -> str:
        return f"http://localhost:{self.nextjs_port}"


# =============================================================================
# Env File Parsing and Merging
# =============================================================================


def parse_env_file(path: Path) -> dict[str, str]:
    """
    Parse .env file into dict, ignoring comments and blank lines.
    Preserves the order of keys as they appear in the file.
    """
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
    """
    Format environment variables into organized .env file content.
    Separates managed keys from user-provided/custom keys.
    """
    lines = [
        ENV_HEADER.rstrip(),
        f"# Local Supabase + Next.js configuration for {port_config.name}",
        f"# Ports: Next.js={port_config.nextjs_port}, Supabase API={port_config.api_port}, DB={port_config.db_port}",
        "",
        "# === Managed by pinpoint-wt.py (do not edit) ===",
        f"NEXT_PUBLIC_SUPABASE_URL={managed_values['NEXT_PUBLIC_SUPABASE_URL']}",
        f"DATABASE_URL={managed_values['DATABASE_URL']}",
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
    ]

    # Add any custom user keys that aren't in managed or user-provided sets
    custom_keys = {
        k: v
        for k, v in user_values.items()
        if k not in MANAGED_ENV_KEYS and k not in USER_PROVIDED_KEYS
    }
    if custom_keys:
        lines.append("")
        lines.append("# === Custom keys (preserved on sync) ===")
        for key, value in custom_keys.items():
            lines.append(f"{key}={value}")

    lines.append("")  # Trailing newline
    return "\n".join(lines)


def merge_env_local(worktree_path: Path, port_config: PortConfig) -> str:
    """
    Generate .env.local content, preserving user-provided keys.

    Managed keys (ports, dev defaults) are always updated.
    User-provided keys (Supabase keys, custom vars) are preserved.
    """
    env_file = worktree_path / ".env.local"

    # Build managed values from port config
    managed_values = {
        "NEXT_PUBLIC_SUPABASE_URL": f"http://localhost:{port_config.api_port}",
        "DATABASE_URL": f"postgresql://postgres:postgres@localhost:{port_config.db_port}/postgres",
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
    }

    # Parse existing file to preserve user values
    user_values: dict[str, str] = {}
    if env_file.exists():
        existing = parse_env_file(env_file)
        # Extract non-managed keys (user-provided + custom)
        user_values = {k: v for k, v in existing.items() if k not in MANAGED_ENV_KEYS}

    return format_env_file(managed_values, user_values, port_config)


# =============================================================================
# Branch/Project ID Utilities
# =============================================================================


def branch_to_project_id(branch_name: str) -> str:
    """
    Convert a branch name to a valid Supabase project ID.
    Must be lowercase alphanumeric with hyphens.
    """
    project_id = re.sub(r"[^a-z0-9-]", "-", branch_name.lower())
    project_id = re.sub(r"-+", "-", project_id)
    # Prepend prefix and collapse any double-hyphens that result
    # (e.g., "/my-feature" -> "-my-feature" -> "pinpoint--my-feature" without this fix)
    project_id = re.sub(r"-+", "-", f"pinpoint-{project_id}").strip("-")
    # Truncate if too long (Supabase limit)
    return project_id[:50]
