#!/usr/bin/env python3
"""
PinPoint Worktree Sync Script

Comprehensive worktree management that handles:
- Multi-worktree state management
- Config file validation and fixing
- Git operations (stash, merge, conflict detection)
- Supabase instance management
- Dependency syncing
- Recovery command generation

This is a Python rewrite of sync-worktrees.sh for better maintainability.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class StatusLevel(Enum):
    """Status level for tracking overall worktree state"""
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class MergeStatus(Enum):
    """Merge operation status"""
    MERGED = "merged"
    UP_TO_DATE = "up-to-date"
    CONFLICTS = "conflicts"
    SKIPPED = "skipped"
    PULLED = "pulled"
    DETACHED = "detached"
    DECLINED = "declined"


@dataclass
class PortConfig:
    """Port configuration for a worktree"""
    name: str
    nextjs_offset: int
    supabase_offset: int
    project_id: str

    # Base ports
    BASE_PORT_NEXTJS: int = 3000
    BASE_PORT_API: int = 54321
    BASE_PORT_DB: int = 54322
    BASE_PORT_SHADOW: int = 54320
    BASE_PORT_POOLER: int = 54329
    BASE_PORT_INBUCKET: int = 54324
    BASE_PORT_SMTP: int = 54325
    BASE_PORT_POP3: int = 54326

    @property
    def nextjs_port(self) -> int:
        return self.BASE_PORT_NEXTJS + self.nextjs_offset

    @property
    def api_port(self) -> int:
        return self.BASE_PORT_API + self.supabase_offset

    @property
    def db_port(self) -> int:
        return self.BASE_PORT_DB + self.supabase_offset

    @property
    def shadow_port(self) -> int:
        return self.BASE_PORT_SHADOW + self.supabase_offset

    @property
    def pooler_port(self) -> int:
        return self.BASE_PORT_POOLER + self.supabase_offset

    @property
    def inbucket_port(self) -> int:
        return self.BASE_PORT_INBUCKET + self.supabase_offset

    @property
    def smtp_port(self) -> int:
        return self.BASE_PORT_SMTP + self.supabase_offset

    @property
    def pop3_port(self) -> int:
        return self.BASE_PORT_POP3 + self.supabase_offset

    @property
    def site_url(self) -> str:
        return f"http://localhost:{self.nextjs_port}"


# Port allocation mappings (from AGENTS.md)
PORT_MAPPINGS = {
    "PinPoint": PortConfig("PinPoint", 0, 0, "pinpoint"),
    "PinPoint-Secondary": PortConfig("PinPoint-Secondary", 100, 1000, "pinpoint-secondary"),
    "PinPoint-review": PortConfig("PinPoint-review", 200, 2000, "pinpoint-review"),
    "PinPoint-AntiGravity": PortConfig("PinPoint-AntiGravity", 300, 3000, "pinpoint-antigravity"),
}


@dataclass
class WorktreeState:
    """State for a single worktree during sync"""
    path: Path
    name: str
    port_config: PortConfig

    # Configuration state
    config_fixed: bool = False
    config_messages: list[str] = field(default_factory=list)

    # Git state
    stash_ref: Optional[str] = None
    pre_merge_sha: Optional[str] = None
    merge_status: Optional[MergeStatus] = None
    merge_message: str = ""

    # Conflict state
    conflicts_present: bool = False
    recovery_commands: list[str] = field(default_factory=list)

    # Overall status
    overall_status: StatusLevel = StatusLevel.SUCCESS

    # Operational flags
    supabase_restarted: bool = False

    def update_status(self, level: StatusLevel) -> None:
        """Update overall status (error > warning > success)"""
        if level == StatusLevel.ERROR or self.overall_status == StatusLevel.ERROR:
            self.overall_status = StatusLevel.ERROR
        elif level == StatusLevel.WARNING or self.overall_status == StatusLevel.WARNING:
            self.overall_status = StatusLevel.WARNING
        else:
            self.overall_status = StatusLevel.SUCCESS

    def add_recovery_command(self, command: str) -> None:
        """Add a recovery command"""
        self.recovery_commands.append(command)

    def get_status_summary(self) -> str:
        """Get git status summary for reporting"""
        try:
            # Get branch info
            branch = subprocess.run(
                ["git", "-C", str(self.path), "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True, text=True, check=True
            ).stdout.strip()

            # Get upstream status
            if branch in ("HEAD", "UNKNOWN"):
                upstream_status = "detached"
            else:
                try:
                    subprocess.run(
                        ["git", "-C", str(self.path), "rev-parse", "--abbrev-ref", "@{u}"],
                        capture_output=True, text=True, check=True
                    )
                    # Get ahead/behind counts
                    result = subprocess.run(
                        ["git", "-C", str(self.path), "rev-list", "--left-right", "--count", "HEAD...@{u}"],
                        capture_output=True, text=True, check=True
                    )
                    ahead, behind = result.stdout.strip().split()
                    upstream_status = f"ahead {ahead}, behind {behind}"
                except subprocess.CalledProcessError:
                    upstream_status = "no upstream"

            # Get pending files count
            result = subprocess.run(
                ["git", "-C", str(self.path), "status", "--porcelain", "--ignore-submodules"],
                capture_output=True, text=True, check=True
            )
            pending_files = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0

            # Get diff stats
            result = subprocess.run(
                ["git", "-C", str(self.path), "diff", "--shortstat"],
                capture_output=True, text=True, check=True
            )
            shortstat = result.stdout.strip()

            insertions = 0
            deletions = 0
            if shortstat:
                # Parse insertions and deletions
                if "insertion" in shortstat:
                    match = re.search(r'(\d+) insertion', shortstat)
                    if match:
                        insertions = int(match.group(1))
                if "deletion" in shortstat:
                    match = re.search(r'(\d+) deletion', shortstat)
                    if match:
                        deletions = int(match.group(1))

            if pending_files == 0:
                return f"branch {branch} | {upstream_status} | clean"
            else:
                return f"branch {branch} | {upstream_status} | files {pending_files}, +{insertions}/-{deletions}"
        except Exception as e:
            return f"Unable to get status: {e}"


class Worktree:
    """Represents a single worktree with operations"""

    def __init__(self, path: Path, dry_run: bool = False):
        self.path = path.resolve()
        self.name = self.path.name
        self.dry_run = dry_run

        # Get port config
        if self.name not in PORT_MAPPINGS:
            raise ValueError(f"Unknown worktree: {self.name}. Expected one of: {list(PORT_MAPPINGS.keys())}")

        self.port_config = PORT_MAPPINGS[self.name]
        self.state = WorktreeState(self.path, self.name, self.port_config)

    def get_current_branch(self) -> str:
        """Get the current branch name"""
        result = subprocess.run(
            ["git", "-C", str(self.path), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()

    def has_uncommitted_changes(self) -> bool:
        """Check if there are uncommitted changes"""
        result = subprocess.run(
            ["git", "-C", str(self.path), "diff-index", "--quiet", "HEAD", "--"],
            capture_output=True
        )
        return result.returncode != 0

    def validate_config(self) -> bool:
        """Validate configuration files"""
        config_file = self.path / "supabase" / "config.toml"
        if not config_file.exists():
            self.state.config_messages.append("Missing supabase/config.toml")
            self.state.update_status(StatusLevel.ERROR)
            return False
        return True

    def fix_config(self, is_main_worktree: bool) -> None:
        """Fix configuration files (config.toml, .env.local, skip-worktree)"""
        # Fix config.toml
        self._fix_config_toml()

        # Fix .env.local
        self._fix_env_local()

        # Fix skip-worktree
        self._fix_skip_worktree(is_main_worktree)

    def _fix_config_toml(self) -> None:
        """Fix supabase/config.toml with correct ports and project_id"""
        config_file = self.path / "supabase" / "config.toml"

        if not config_file.exists():
            self.state.config_messages.append("Missing supabase/config.toml")
            self.state.update_status(StatusLevel.ERROR)
            return

        # Read current config
        content = config_file.read_text()

        # Expected values
        expected = {
            "project_id": self.port_config.project_id,
            "api_port": self.port_config.api_port,
            "db_port": self.port_config.db_port,
            "shadow_port": self.port_config.shadow_port,
            "pooler_port": self.port_config.pooler_port,
            "inbucket_port": self.port_config.inbucket_port,
            "smtp_port": self.port_config.smtp_port,
            "pop3_port": self.port_config.pop3_port,
        }

        # Parse current values
        current = {}
        current["project_id"] = self._extract_value(content, r'^project_id = "([^"]+)"')
        current["api_port"] = self._extract_port(content, r'^\[api\].*?^port = (\d+)', re.MULTILINE | re.DOTALL)
        current["db_port"] = self._extract_port(content, r'^\[db\].*?^port = (\d+)', re.MULTILINE | re.DOTALL)
        current["shadow_port"] = self._extract_port(content, r'^\[db\].*?^shadow_port = (\d+)', re.MULTILINE | re.DOTALL)
        current["pooler_port"] = self._extract_port(content, r'^\[db\.pooler\].*?^port = (\d+)', re.MULTILINE | re.DOTALL)
        current["inbucket_port"] = self._extract_port(content, r'^\[inbucket\].*?^port = (\d+)', re.MULTILINE | re.DOTALL)
        current["smtp_port"] = self._extract_port(content, r'^\[inbucket\].*?^smtp_port = (\d+)', re.MULTILINE | re.DOTALL)
        current["pop3_port"] = self._extract_port(content, r'^\[inbucket\].*?^pop3_port = (\d+)', re.MULTILINE | re.DOTALL)

        # Check what needs fixing
        changes = []
        needs_fix = False

        for key, expected_val in expected.items():
            current_val = current.get(key)
            if current_val != expected_val:
                if key == "project_id":
                    changes.append(f"project_id: {current_val} → {expected_val}")
                else:
                    port_name = key.replace("_", " ").title()
                    changes.append(f"{port_name}: {current_val} → {expected_val}")
                needs_fix = True

        if not needs_fix:
            self.state.config_messages.append("config.toml validated (no changes needed)")
            return

        # Create backup and apply fixes
        if self.dry_run:
            print(f"[DRY-RUN] Would fix config.toml in {self.name}:")
            for change in changes:
                print(f"[DRY-RUN]   {change}")
            backup_file = f"config.toml.bak.{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            print(f"[DRY-RUN] Would create backup: {backup_file}")
        else:
            # Create backup
            backup_file = config_file.parent / f"config.toml.bak.{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            shutil.copy2(config_file, backup_file)

            # Apply fixes with sed-like replacements
            content = self._replace_project_id(content, expected["project_id"])
            content = self._replace_port_in_section(content, "api", expected["api_port"])
            content = self._replace_port_in_section(content, "db", expected["db_port"], "port")
            content = self._replace_port_in_section(content, "db", expected["shadow_port"], "shadow_port")
            content = self._replace_port_in_section(content, "db.pooler", expected["pooler_port"])
            content = self._replace_port_in_section(content, "inbucket", expected["inbucket_port"])
            content = self._ensure_inbucket_port(content, "smtp_port", expected["smtp_port"])
            content = self._ensure_inbucket_port(content, "pop3_port", expected["pop3_port"])

            config_file.write_text(content)

        self.state.config_fixed = True
        self.state.config_messages.append(f"Fixed: {', '.join(changes)}")
        self.state.update_status(StatusLevel.WARNING)

    def _extract_value(self, content: str, pattern: str) -> Optional[str]:
        """Extract a string value from config"""
        match = re.search(pattern, content, re.MULTILINE)
        return match.group(1) if match else None

    def _extract_port(self, content: str, pattern: str, flags: int = 0) -> Optional[int]:
        """Extract a port number from config"""
        match = re.search(pattern, content, flags)
        return int(match.group(1)) if match else None

    def _replace_project_id(self, content: str, project_id: str) -> str:
        """Replace project_id in config"""
        return re.sub(
            r'^project_id = ".*"',
            f'project_id = "{project_id}"',
            content,
            flags=re.MULTILINE
        )

    def _replace_port_in_section(self, content: str, section: str, port: int, key: str = "port") -> str:
        """Replace a port value in a specific TOML section"""
        # Find the section and replace the port
        section_pattern = rf'^\[{re.escape(section)}\](.*?)(?=^\[|\Z)'

        def replacer(match):
            section_content = match.group(1)
            # Replace the specific key in this section
            section_content = re.sub(
                rf'^{key} = \d+',
                f'{key} = {port}',
                section_content,
                flags=re.MULTILINE
            )
            return f'[{section}]{section_content}'

        return re.sub(section_pattern, replacer, content, flags=re.MULTILINE | re.DOTALL)

    def _ensure_inbucket_port(self, content: str, key: str, port: int) -> str:
        """Ensure an inbucket port exists, adding it if missing"""
        # Check if it already exists
        if re.search(rf'^\[inbucket\].*?^{key} = ', content, re.MULTILINE | re.DOTALL):
            # Update existing
            section_pattern = r'^\[inbucket\](.*?)(?=^\[|\Z)'

            def replacer(match):
                section_content = match.group(1)
                section_content = re.sub(
                    rf'^{key} = \d+',
                    f'{key} = {port}',
                    section_content,
                    flags=re.MULTILINE
                )
                return f'[inbucket]{section_content}'

            return re.sub(section_pattern, replacer, content, flags=re.MULTILINE | re.DOTALL)
        else:
            # Add after port line in inbucket section
            def replacer(match):
                section_content = match.group(1)
                # Find the port line and add after it
                section_content = re.sub(
                    r'^(port = \d+)$',
                    rf'\1\n{key} = {port}',
                    section_content,
                    flags=re.MULTILINE
                )
                return f'[inbucket]{section_content}'

            section_pattern = r'^\[inbucket\](.*?)(?=^\[|\Z)'
            return re.sub(section_pattern, replacer, content, flags=re.MULTILINE | re.DOTALL)

    def _fix_env_local(self) -> None:
        """Fix .env.local with correct ports and URLs"""
        env_file = self.path / ".env.local"

        # Bootstrap if missing
        if not env_file.exists():
            if self.dry_run:
                print(f"[DRY-RUN] Would create .env.local for {self.name}")
            else:
                content = self._generate_env_local_template()
                env_file.write_text(content)
            self.state.config_messages.append(".env.local created")
            return

        content = env_file.read_text()

        # Expected values
        expected = {
            "NEXT_PUBLIC_SUPABASE_URL": f"http://127.0.0.1:{self.port_config.api_port}",
            "DATABASE_URL": f"postgresql://postgres:postgres@127.0.0.1:{self.port_config.db_port}/postgres",
            "PORT": str(self.port_config.nextjs_port),
            "NEXT_PUBLIC_SITE_URL": self.port_config.site_url,
            "EMAIL_TRANSPORT": "smtp",
            "MAILPIT_PORT": str(self.port_config.inbucket_port),
            "MAILPIT_SMTP_PORT": str(self.port_config.smtp_port),
            "INBUCKET_PORT": str(self.port_config.inbucket_port),
            "INBUCKET_SMTP_PORT": str(self.port_config.smtp_port),
        }

        changes = []
        needs_fix = False

        for key, expected_val in expected.items():
            current_val = self._extract_env_value(content, key)
            if current_val != expected_val:
                changes.append(f"{key}: {current_val or '<missing>'} → {expected_val}")
                needs_fix = True

        if not needs_fix:
            return

        if self.dry_run:
            print(f"[DRY-RUN] Would fix .env.local in {self.name}:")
            for change in changes:
                print(f"[DRY-RUN]   {change}")
        else:
            # Apply fixes
            for key, value in expected.items():
                content = self._set_env_value(content, key, value)

            # Ensure required keys exist (even if empty)
            for key in ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]:
                if not re.search(rf'^{key}=', content, re.MULTILINE):
                    content += f"\n{key}=\n"

            env_file.write_text(content)

        self.state.config_messages.append(".env.local fixed")

    def _generate_env_local_template(self) -> str:
        """Generate .env.local template"""
        return f"""# Generated by scripts/sync_worktrees.py
# Local Supabase + Next.js defaults for {self.name}
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:{self.port_config.api_port}
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:{self.port_config.db_port}/postgres
PORT={self.port_config.nextjs_port}
NEXT_PUBLIC_SITE_URL={self.port_config.site_url}

# Email Configuration
EMAIL_TRANSPORT=smtp
MAILPIT_PORT={self.port_config.inbucket_port}
MAILPIT_SMTP_PORT={self.port_config.smtp_port}
INBUCKET_PORT={self.port_config.inbucket_port}
INBUCKET_SMTP_PORT={self.port_config.smtp_port}

# Fill these from 'supabase start' output for this worktree
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
"""

    def _extract_env_value(self, content: str, key: str) -> Optional[str]:
        """Extract value from .env file"""
        match = re.search(rf'^{key}=(.*)$', content, re.MULTILINE)
        return match.group(1) if match else None

    def _set_env_value(self, content: str, key: str, value: str) -> str:
        """Set or add an environment variable in .env content"""
        if re.search(rf'^{key}=', content, re.MULTILINE):
            # Update existing
            return re.sub(
                rf'^{key}=.*$',
                f'{key}={value}',
                content,
                flags=re.MULTILINE
            )
        else:
            # Add new
            return content + f"\n{key}={value}\n"

    def _fix_skip_worktree(self, is_main_worktree: bool) -> None:
        """Fix skip-worktree flag on config.toml"""
        try:
            result = subprocess.run(
                ["git", "-C", str(self.path), "ls-files", "-v", "supabase/config.toml"],
                capture_output=True, text=True, check=True
            )
            skip_flag = result.stdout[0] if result.stdout else ""

            if is_main_worktree:
                # Main worktree should NOT have skip-worktree
                if skip_flag == "S":
                    if self.dry_run:
                        print(f"[DRY-RUN] Would remove skip-worktree from {self.name}")
                    else:
                        subprocess.run(
                            ["git", "-C", str(self.path), "update-index", "--no-skip-worktree", "supabase/config.toml"],
                            check=True
                        )
                    self.state.config_messages.append("skip-worktree removed")
            else:
                # Others MUST have skip-worktree
                if skip_flag != "S":
                    if self.dry_run:
                        print(f"[DRY-RUN] Would add skip-worktree to {self.name}")
                    else:
                        subprocess.run(
                            ["git", "-C", str(self.path), "update-index", "--skip-worktree", "supabase/config.toml"],
                            check=True
                        )
                    self.state.config_messages.append("skip-worktree added")
        except subprocess.CalledProcessError:
            pass  # File may not be tracked

    def stash_changes(self, branch: str) -> bool:
        """Stash uncommitted changes if present"""
        if not self.has_uncommitted_changes():
            return False

        stash_name = f"sync-worktrees-auto-{branch}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        if self.dry_run:
            print(f"[DRY-RUN] Would stash: {stash_name}")
        else:
            subprocess.run(
                ["git", "-C", str(self.path), "stash", "push", "-u", "-m", stash_name],
                capture_output=True, check=True
            )
            self.state.stash_ref = "stash@{0}"

        return True

    def merge_main(self, branch: str) -> MergeStatus:
        """Merge main branch into current branch"""
        has_changes = self.has_uncommitted_changes()

        # Handle detached HEAD
        if branch == "HEAD":
            if has_changes:
                self.state.merge_status = MergeStatus.SKIPPED
                self.state.merge_message = "Detached HEAD with outstanding changes - should be working on a branch"
                self.state.update_status(StatusLevel.WARNING)
                return MergeStatus.SKIPPED

            # Switch to origin/main detached
            if self.dry_run:
                print("[DRY-RUN] Would run: git fetch origin && git checkout --detach origin/main")
            else:
                subprocess.run(
                    ["git", "-C", str(self.path), "fetch", "origin"],
                    capture_output=True, check=True
                )
                subprocess.run(
                    ["git", "-C", str(self.path), "checkout", "--detach", "origin/main"],
                    capture_output=True, check=True
                )

            self.state.merge_status = MergeStatus.DETACHED
            self.state.merge_message = "Switched to origin/main detached"
            return MergeStatus.DETACHED

        # Handle main branch
        if branch == "main":
            if has_changes:
                self.state.merge_status = MergeStatus.SKIPPED
                self.state.merge_message = "On main with outstanding changes - should be working on a branch"
                self.state.update_status(StatusLevel.WARNING)
                return MergeStatus.SKIPPED

            # Pull latest main
            if self.dry_run:
                print("[DRY-RUN] Would run: git pull")
            else:
                result = subprocess.run(
                    ["git", "-C", str(self.path), "pull"],
                    capture_output=True, text=True, check=True
                )
                if "Already up to date" in result.stdout:
                    self.state.merge_status = MergeStatus.UP_TO_DATE
                    self.state.merge_message = "Main already up to date"
                else:
                    self.state.merge_status = MergeStatus.PULLED
                    self.state.merge_message = "Main pulled successfully"

            return self.state.merge_status or MergeStatus.PULLED

        # Check for merged PR
        pr_number = self._check_merged_pr(branch)
        if pr_number:
            # Would prompt user in interactive mode
            # For now, skip the detached HEAD option
            self.state.merge_status = MergeStatus.DECLINED
            self.state.merge_message = f"Merged PR #{pr_number} found (manual checkout recommended)"
            self.state.update_status(StatusLevel.WARNING)
            return MergeStatus.DECLINED

        # Save pre-merge SHA for recovery
        result = subprocess.run(
            ["git", "-C", str(self.path), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True
        )
        self.state.pre_merge_sha = result.stdout.strip()

        # Attempt merge
        if self.dry_run:
            print("[DRY-RUN] Would run: git merge main")
            self.state.merge_status = MergeStatus.MERGED
            self.state.merge_message = "Would merge main"
            return MergeStatus.MERGED

        result = subprocess.run(
            ["git", "-C", str(self.path), "merge", "main"],
            capture_output=True, text=True
        )

        if result.returncode == 0:
            if "Already up to date" in result.stdout:
                self.state.merge_status = MergeStatus.UP_TO_DATE
                self.state.merge_message = "Already up to date with main"
            else:
                self.state.merge_status = MergeStatus.MERGED
                self.state.merge_message = "Merged main successfully"
        else:
            self.state.merge_status = MergeStatus.CONFLICTS
            self.state.conflicts_present = True
            self.state.update_status(StatusLevel.ERROR)

            # Check which files have conflicts
            conflicted_files = self._get_conflicted_files()

            # Distinguish config.toml from other conflicts
            config_conflict = "supabase/config.toml" in conflicted_files
            other_conflicts = [f for f in conflicted_files if f != "supabase/config.toml"]

            if config_conflict and not other_conflicts:
                # Only config.toml has conflicts - can auto-resolve
                self.state.merge_message = "Merge conflicts in config.toml (auto-resolvable)"
                recovery = f"""cd {self.path}

# Config.toml conflict detected - recommend accepting main's version
# Your local port customizations are preserved via skip-worktree

# Auto-resolve (accept main's config structure, restore ports after):
git checkout --theirs supabase/config.toml
git add supabase/config.toml
git commit -m "Merge main (accept config.toml structure)"
python3 scripts/sync_worktrees.py  # Restore correct ports
"""
            elif config_conflict and other_conflicts:
                # Mixed conflicts - manual intervention needed
                self.state.merge_message = f"Merge conflicts in config.toml + {len(other_conflicts)} other file(s)"
                recovery = f"""cd {self.path}

# CONFLICTS IN MULTIPLE FILES - MANUAL RESOLUTION REQUIRED
# Files with conflicts: {', '.join(conflicted_files)}

# Step 1: Resolve config.toml (accept main's structure)
git checkout --theirs supabase/config.toml
git add supabase/config.toml

# Step 2: Resolve other conflicts manually
# Edit each file, then:
git add <resolved-files>

# Step 3: Complete merge
git commit

# Step 4: Restore correct ports
python3 scripts/sync_worktrees.py

# Alternative: Abort merge entirely
git merge --abort
git reset --hard {self.state.pre_merge_sha}
"""
            else:
                # Only non-config conflicts
                self.state.merge_message = f"Merge conflicts in {len(conflicted_files)} file(s)"
                recovery = f"""cd {self.path}

# MANUAL CONFLICT RESOLUTION REQUIRED
# Files with conflicts: {', '.join(conflicted_files)}

# Option 1: Resolve manually
git status
# Edit files to resolve conflicts, then:
git add <resolved-files>
git commit

# Option 2: Abort merge
git merge --abort
git reset --hard {self.state.pre_merge_sha}

# Option 3: Accept all main's changes
git checkout --theirs .
git add .
git commit -m "Merge main (accept all main changes)"
"""

            self.state.add_recovery_command(recovery)

        return self.state.merge_status or MergeStatus.MERGED

    def _check_merged_pr(self, branch: str) -> Optional[int]:
        """Check if branch has a merged PR using gh CLI"""
        if not shutil.which("gh"):
            return None

        try:
            result = subprocess.run(
                ["gh", "pr", "list", "--repo", "timothyfroehlich/PinPoint",
                 "--head", branch, "--state", "merged", "--json", "number,title,mergedAt", "--limit", "1"],
                capture_output=True, text=True, check=True
            )

            if result.stdout.strip() in ("[]", ""):
                return None

            data = json.loads(result.stdout)
            if data and len(data) > 0:
                return data[0].get("number")
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            pass

        return None

    def _get_conflicted_files(self) -> list[str]:
        """Get list of files with merge conflicts"""
        try:
            result = subprocess.run(
                ["git", "-C", str(self.path), "diff", "--name-only", "--diff-filter=U"],
                capture_output=True, text=True, check=True
            )
            return [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
        except subprocess.CalledProcessError:
            return []

    def pop_stash(self) -> bool:
        """Pop stashed changes back"""
        if not self.state.stash_ref:
            return True  # No stash to pop

        if self.dry_run:
            print("[DRY-RUN] Would run: git stash pop")
            return True

        result = subprocess.run(
            ["git", "-C", str(self.path), "stash", "pop"],
            capture_output=True, text=True
        )

        if result.returncode != 0:
            self.state.conflicts_present = True
            self.state.update_status(StatusLevel.ERROR)

            recovery = f"""cd {self.path}

# Stash pop conflicts detected

# Option 1: Resolve conflicts
git status
# Edit files, then:
git add <resolved-files>

# Option 2: Discard stash changes
git reset --hard HEAD"""

            self.state.add_recovery_command(recovery)
            return False

        return True

    def run_npm_install(self, non_interactive: bool = False) -> bool:
        """Run npm ci to sync dependencies"""
        if self.state.conflicts_present:
            return False

        if not non_interactive and not self.dry_run:
            # Would prompt in interactive mode
            pass

        if self.dry_run:
            print(f"[DRY-RUN] Would run: npm ci --silent in {self.name}")
        else:
            try:
                subprocess.run(
                    ["npm", "ci", "--silent"],
                    cwd=self.path,
                    capture_output=True,
                    check=True,
                    timeout=300  # 5 minute timeout
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                # Non-fatal, just report
                pass

        return True

    def stop_supabase(self) -> None:
        """Stop Supabase containers for this worktree"""
        config_file = self.path / "supabase" / "config.toml"
        if not config_file.exists():
            return

        if self.dry_run:
            print(f"[DRY-RUN] Would stop Supabase in {self.name}")
            return

        try:
            subprocess.run(
                ["supabase", "stop"],
                cwd=self.path,
                capture_output=True,
                timeout=60
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass

    def sync_python_env(self) -> None:
        """Ensure Python virtual environment exists and is up to date"""
        venv_path = self.path / ".venv"
        req_path = self.path / "scripts" / "requirements.txt"

        if self.dry_run:
            print(f"[DRY-RUN] Would check/create .venv in {self.name}")
            if req_path.exists():
                print(f"[DRY-RUN] Would install requirements from {req_path}")
            return

        # Create venv if missing
        if not venv_path.exists():
            print(f"  Creating .venv in {self.name}...")
            try:
                subprocess.run(
                    [sys.executable, "-m", "venv", str(venv_path)],
                    check=True, capture_output=True
                )
            except subprocess.CalledProcessError as e:
                print(f"  ⚠️  Failed to create venv: {e}")
                return

        # Install requirements if present
        if req_path.exists():
            pip_path = venv_path / "bin" / "pip"
            try:
                subprocess.run(
                    [str(pip_path), "install", "-r", str(req_path), "--quiet"],
                    check=True, capture_output=True
                )
            except subprocess.CalledProcessError as e:
                print(f"  ⚠️  Failed to install requirements: {e}")

    def restart_supabase(self, non_interactive: bool = False) -> bool:
        """Restart Supabase and reseed database"""
        if self.state.conflicts_present or not self.state.config_fixed:
            return False

        if not non_interactive and not self.dry_run:
            # Would prompt in interactive mode
            pass

        if self.dry_run:
            print(f"[DRY-RUN] Would restart Supabase in {self.name}")
        else:
            try:
                # Stop Supabase
                subprocess.run(
                    ["supabase", "stop"],
                    cwd=self.path,
                    capture_output=True
                )

                # Start Supabase
                subprocess.run(
                    ["supabase", "start"],
                    cwd=self.path,
                    capture_output=True,
                    check=True,
                    timeout=120
                )

                # Reset database
                subprocess.run(
                    ["npm", "run", "db:reset", "--silent"],
                    cwd=self.path,
                    capture_output=True,
                    timeout=60
                )

                self.state.supabase_restarted = True
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                # Non-fatal
                pass

        return True

    def regenerate_test_schema(self) -> bool:
        """Regenerate test schema"""
        if self.dry_run:
            print(f"[DRY-RUN] Would run: npm run test:generate-schema in {self.name}")
        else:
            try:
                subprocess.run(
                    ["npm", "run", "test:generate-schema", "--silent"],
                    cwd=self.path,
                    capture_output=True,
                    timeout=60
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                pass

        return True

    def run_validation(self) -> bool:
        """Run post-merge validation (db:reset + integration tests)"""
        if self.state.conflicts_present:
            return False

        print()
        print("Running post-merge validation...")

        if self.dry_run:
            print("[DRY-RUN] Would run: npm run db:reset && npm run test:integration")
            return True

        try:
            # Run consolidated check script
            print("  Running validation (npm run check)...")
            subprocess.run(
                ["npm", "run", "check"],
                cwd=self.path,
                capture_output=True,
                check=True,
                timeout=120
            )

            print("  ✅ Validation passed")
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print(f"  ❌ Validation failed: {e}")
            self.state.update_status(StatusLevel.WARNING)
            return False


class SyncManager:
    """Manages the sync process across multiple worktrees"""

    def __init__(self, dry_run: bool = False, non_interactive: bool = False, validate: bool = False):
        self.dry_run = dry_run
        self.non_interactive = non_interactive
        self.validate = validate
        self.worktrees: list[Worktree] = []
        self.main_worktree_path: Optional[Path] = None

    def pre_flight_checks(self) -> bool:
        """Run pre-flight checks before processing worktrees"""
        print_status("info", "Running pre-flight checks...")

        # 1. Check for legacy Docker volumes (warning only)
        self._check_legacy_volumes()

        # 3. Check if main worktree is up-to-date
        if not self._check_main_updated():
            return False

        print()
        return True


    def _check_legacy_volumes(self) -> None:
        """Check for legacy Docker volumes (warning only)"""
        try:
            result = subprocess.run(
                ["docker", "volume", "ls", "--filter", "label=com.supabase.cli.project=pinpoint-v2", "--format", "{{.Name}}"],
                capture_output=True, text=True, check=True
            )

            legacy_volumes = result.stdout.strip()
            if legacy_volumes:
                print_status("warning", "Found legacy pinpoint-v2 Docker volumes!")
                print()
                print("The following legacy volumes exist:")
                print(legacy_volumes)
                print()
                print("These should be removed to avoid conflicts with 'pinpoint' project.")
                print()
                print("To fix:")
                print(f"  docker volume rm {legacy_volumes}")
                print()
        except subprocess.CalledProcessError:
            pass

    def _check_main_updated(self) -> bool:
        """Check that main worktree is up-to-date"""
        print_status("info", "Checking main worktree status...")

        # Get main worktree path
        try:
            result = subprocess.run(
                ["git", "worktree", "list"],
                capture_output=True, text=True, check=True
            )

            for line in result.stdout.strip().split('\n'):
                if "[main]" in line:
                    self.main_worktree_path = Path(line.split()[0])
                    break
        except subprocess.CalledProcessError:
            return True

        if not self.main_worktree_path or not self.main_worktree_path.exists():
            return True

        if self.dry_run:
            print("[DRY-RUN] Would check if main is behind origin")
            return True

        try:
            # Fetch origin
            subprocess.run(
                ["git", "-C", str(self.main_worktree_path), "fetch", "origin"],
                capture_output=True, check=True
            )

            # Check behind count
            result = subprocess.run(
                ["git", "-C", str(self.main_worktree_path), "rev-list", "--count", "HEAD..origin/main"],
                capture_output=True, text=True, check=True
            )

            behind = int(result.stdout.strip() or "0")
            if behind > 0:
                print_status("error", f"Main worktree is {behind} commits behind origin/main!")
                print()
                print("Main must be up-to-date before syncing other worktrees.")
                print()
                print("To fix:")
                print(f"  cd {self.main_worktree_path}")
                print("  git pull origin main")
                print()
                print("Then re-run this script.")
                return False

            print_status("success", "Main worktree is up to date")
            return True
        except (subprocess.CalledProcessError, ValueError):
            # If we can't check, proceed anyway
            return True

    def process_worktrees(self, worktree_paths: list[Path]) -> None:
        """Process the given worktrees"""
        for path in worktree_paths:
            try:
                worktree = Worktree(path, self.dry_run)
                self.worktrees.append(worktree)
                self._process_worktree(worktree)
            except ValueError as e:
                print(f"Error: {e}")
                continue

    def _process_worktree(self, worktree: Worktree) -> None:
        """Process a single worktree"""
        print()
        print("=" * 68)
        print(f"Processing: {worktree.name}")
        print(f"Path: {worktree.path}")
        print("=" * 68)

        # Determine if this is the main worktree
        is_main = (self.main_worktree_path and
                   worktree.path.resolve() == self.main_worktree_path.resolve())

        # Phase 0: Ensure clean state
        worktree.stop_supabase()

        # Phase 1: Configuration
        print()
        print("Phase 1: Configuration Validation & Fixing")
        if worktree.validate_config():
            worktree.fix_config(is_main)
        print(f"  {' | '.join(worktree.state.config_messages)}")

        # Phase 2: Git State
        print()
        print("Phase 2: Git State Management")
        current_branch = worktree.get_current_branch()
        print(f"  Current branch: {current_branch}")

        if worktree.stash_changes(current_branch):
            print("  Stashed uncommitted changes")

        # Phase 3: Branch Operations
        print()
        print("Phase 3: Branch Operations")
        worktree.merge_main(current_branch)
        print(f"  {worktree.state.merge_message}")

        # Phase 4: Stash Reapplication
        if worktree.state.stash_ref and not worktree.state.conflicts_present:
            print()
            print("Phase 4: Stash Reapplication")
            if worktree.pop_stash():
                print("  Stash popped successfully")
            else:
                print("  Stash pop conflicts - left in conflicted state")

        # Phase 5: Dependency & Database Sync
        if not worktree.state.conflicts_present:
            print()
            print("Phase 5: Dependency & Database Sync")
            worktree.sync_python_env()
            worktree.run_npm_install(self.non_interactive)
            worktree.restart_supabase(self.non_interactive)
            worktree.regenerate_test_schema()
        else:
            print()
            print("Phase 5: Skipped (conflicts present)")

        # Phase 6: Post-merge validation (optional)
        if self.validate and not worktree.state.conflicts_present:
            print()
            print("Phase 6: Post-merge Validation")
            worktree.run_validation()

    def generate_report(self) -> None:
        """Generate comprehensive sync report"""
        print()
        print("=" * 68)
        print("🔄 PinPoint Worktree Sync Report")
        print("=" * 68)
        print()
        print(f"Execution: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        mode = "DRY-RUN" if self.dry_run else "NORMAL"
        interactive = "Non-interactive (-y)" if self.non_interactive else "Interactive"
        print(f"Mode: {mode} | {interactive}")
        print(f"Worktrees: {len(self.worktrees)} processed")

        # Overall summary
        print()
        print("-" * 68)
        print("📊 OVERALL SUMMARY")
        print("-" * 68)

        success_count = sum(1 for w in self.worktrees if w.state.overall_status == StatusLevel.SUCCESS)
        warning_count = sum(1 for w in self.worktrees if w.state.overall_status == StatusLevel.WARNING)
        error_count = sum(1 for w in self.worktrees if w.state.overall_status == StatusLevel.ERROR)

        print()
        print(f"✅ Success:  {success_count} worktree(s)")
        print(f"⚠️  Warnings: {warning_count} worktree(s)")
        print(f"❌ Errors:   {error_count} worktree(s)")

        # Worktree details
        print()
        print("-" * 68)
        print("📋 WORKTREE DETAILS")
        print("-" * 68)

        for worktree in self.worktrees:
            status_icon = {
                StatusLevel.SUCCESS: "✅",
                StatusLevel.WARNING: "⚠️ ",
                StatusLevel.ERROR: "❌"
            }[worktree.state.overall_status]

            print()
            print(f"{status_icon} {worktree.name} ({worktree.state.overall_status.value.upper()})")
            print(f"   Path: {worktree.path}")
            print(f"   Config: {' | '.join(worktree.state.config_messages) or 'Unknown'}")
            print(f"   Merge: {worktree.state.merge_message or 'Unknown'}")
            print(f"   Status: {worktree.state.get_status_summary()}")

            if worktree.state.conflicts_present:
                print("   ⚠️  CONFLICTS PRESENT - See recovery section below")

        # Recovery section
        has_recovery = any(w.state.recovery_commands for w in self.worktrees)

        if has_recovery:
            print()
            print("-" * 68)
            print("🔧 RECOVERY ACTIONS NEEDED")
            print("-" * 68)

            for worktree in self.worktrees:
                if worktree.state.recovery_commands:
                    print()
                    print(f"{worktree.name}:")
                    for cmd in worktree.state.recovery_commands:
                        print(cmd)

        # Supabase restart notices
        if any(w.state.supabase_restarted for w in self.worktrees):
            print()
            print("-" * 68)
            print("📝 NEXT STEPS")
            print("-" * 68)
            print()
            print("For worktrees with restarted Supabase:")
            print("  1. Copy new Supabase keys to .env.local (from 'supabase status')")
            print("  2. Test: npm run dev")
            print("  3. Verify correct ports in browser")

        print()
        print("=" * 68)


def print_status(level: str, message: str) -> None:
    """Print colored status message"""
    icons = {
        "success": "✅",
        "warning": "⚠️ ",
        "error": "❌",
        "info": "ℹ️ ",
    }
    icon = icons.get(level, "")
    print(f"{icon} {message}")


def get_worktree_paths(args: argparse.Namespace) -> list[Path]:
    """Determine which worktrees to process based on arguments"""
    if args.all:
        # Process all worktrees
        result = subprocess.run(
            ["git", "worktree", "list"],
            capture_output=True, text=True, check=True
        )
        paths = []
        for line in result.stdout.strip().split('\n'):
            path = Path(line.split()[0])
            if path.exists():
                paths.append(path)
        return paths
    elif args.path:
        # Process specific path
        path = Path(args.path).resolve()
        if not path.exists():
            print(f"Error: Worktree path not found: {path}")
            sys.exit(1)
        if not (path / ".git").exists():
            print(f"Error: Not a git worktree: {path}")
            sys.exit(1)
        return [path]
    else:
        # Process current worktree
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True
        )
        return [Path(result.stdout.strip())]


def main() -> None:
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="PinPoint Worktree Sync - Comprehensive worktree management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Notes:
  - Without --all, the script processes exactly one worktree (current by default).
  - When both positional path and --path are provided, only --path is used.
        """
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show actions without making changes"
    )
    parser.add_argument(
        "-y",
        dest="non_interactive",
        action="store_true",
        help="Non-interactive (auto-confirm prompts)"
    )
    parser.add_argument(
        "-a", "--all",
        action="store_true",
        help="Process all worktrees"
    )
    parser.add_argument(
        "-p", "--path",
        type=str,
        help="Process a specific worktree (single path)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run post-merge validation (db:reset + integration tests)"
    )
    parser.add_argument(
        "worktree_path",
        nargs="?",
        type=str,
        help="Worktree path (alternative to --path)"
    )

    args = parser.parse_args()

    # Handle path argument priority
    if args.path and args.worktree_path:
        print("Note: Both --path and positional path provided; using --path")
        args.worktree_path = None
    elif args.worktree_path:
        args.path = args.worktree_path

    # Ensure we're running in the virtual environment
    # Skip if dry-run to avoid infinite loops if venv creation fails in dry-run
    if not args.dry_run and not os.environ.get("VIRTUAL_ENV"):
        venv_path = Path.cwd() / ".venv"
        if venv_path.exists():
            python_bin = venv_path / "bin" / "python3"
            if python_bin.exists():
                print(f"🔄 Restarting in .venv: {python_bin}")
                try:
                    os.execv(str(python_bin), [str(python_bin)] + sys.argv)
                except OSError as e:
                    print(f"⚠️  Failed to restart in venv: {e}")

    print("🔄 PinPoint Worktree Sync")
    print()

    # Create sync manager
    manager = SyncManager(
        dry_run=args.dry_run,
        non_interactive=args.non_interactive,
        validate=args.validate
    )

    # Run pre-flight checks
    if not manager.pre_flight_checks():
        sys.exit(1)

    # Get worktrees to process
    try:
        worktree_paths = get_worktree_paths(args)
    except subprocess.CalledProcessError:
        print("Error: Not in a git repository")
        sys.exit(1)

    # Process worktrees
    manager.process_worktrees(worktree_paths)

    # Generate report
    manager.generate_report()


if __name__ == "__main__":
    main()
