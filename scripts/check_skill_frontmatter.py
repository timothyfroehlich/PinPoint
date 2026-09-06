#!/usr/bin/env python3
"""Validate YAML frontmatter in skill SKILL.md files.

Ensures that:
1. Every skill SKILL.md file begins with a valid YAML frontmatter block (delimited by '---').
2. The frontmatter passes `yamllint` without syntax errors.
3. The frontmatter contains required top-level keys: `name` and `description`.
4. The `name` matches the containing skill directory name.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
KEY_VAL_RE = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")
KEY_VAL_LINE_RE = re.compile(r"^\s*([A-Za-z0-9_-]+):\s*(.*)$")
BLOCK_SCALAR_RE = re.compile(r"^[>|][0-9]*[+-]?$")


@dataclass
class FrontmatterEntry:
    key: str
    first_line: str
    continuation_lines: list[str]
    line_number: int


def extract_frontmatter(content: str) -> str | None:
    """Extract frontmatter string from file content, or None if absent/malformed."""
    match = FRONTMATTER_RE.match(content)
    if not match:
        return None
    return match.group(1)


def parse_top_level_keys(frontmatter: str) -> dict[str, str]:
    """Extract top-level keys from frontmatter for basic presence checks."""
    keys: dict[str, str] = {}
    for line in frontmatter.splitlines():
        if line and not line[0].isspace():
            match = KEY_VAL_RE.match(line)
            if match:
                current_key = match.group(1)
                keys[current_key] = match.group(2).strip()
    return keys


def parse_frontmatter_entries(frontmatter: str) -> dict[str, FrontmatterEntry]:
    """Extract top-level keys with multiline continuation blocks."""
    entries: dict[str, FrontmatterEntry] = {}
    current_entry: FrontmatterEntry | None = None

    for idx, line in enumerate(frontmatter.splitlines(), start=1):
        if line.startswith("#"):
            continue
        if line and not line[0].isspace():
            match = KEY_VAL_RE.match(line)
            if match:
                key = match.group(1)
                first_line = match.group(2).strip()
                current_entry = FrontmatterEntry(
                    key=key,
                    first_line=first_line,
                    continuation_lines=[],
                    line_number=idx,
                )
                entries[key] = current_entry
                continue
        if current_entry is not None:
            current_entry.continuation_lines.append(line)

    return entries


def validate_string_entry(entry: FrontmatterEntry) -> tuple[bool, str]:
    """Validate that a frontmatter entry represents a non-empty string."""
    first = entry.first_line

    if BLOCK_SCALAR_RE.match(first):
        non_empty = [line.strip() for line in entry.continuation_lines if line.strip()]
        if not non_empty:
            return False, "is empty"
        return True, ""

    if first.startswith("["):
        return False, "must be a string, got list"

    if first.startswith("{"):
        return False, "must be a string, got mapping"

    if (first.startswith('"') and first.endswith('"') and len(first) >= 2) or (
        first.startswith("'") and first.endswith("'") and len(first) >= 2
    ):
        unquoted = first[1:-1].strip()
        if not unquoted and not any(line.strip() for line in entry.continuation_lines):
            return False, "is empty"
        return True, ""

    if not first:
        non_empty_lines = [line for line in entry.continuation_lines if line.strip()]
        if not non_empty_lines:
            return False, "is empty"
        first_content = non_empty_lines[0].strip()
        if first_content.startswith("- ") or first_content == "-":
            return False, "must be a string, got list"
        if KEY_VAL_LINE_RE.match(first_content):
            return False, "must be a string, got mapping"
        return True, ""

    lower_first = first.lower()
    if lower_first in ("true", "false", "yes", "no", "on", "off"):
        return False, f"must be a string, got boolean ({first})"
    if lower_first in ("null", "~"):
        return False, "is empty"

    try:
        int(first)
        return False, f"must be a string, got integer ({first})"
    except ValueError:
        pass
    try:
        float(first)
        return False, f"must be a string, got number ({first})"
    except ValueError:
        pass

    return True, ""


def lint_yaml(frontmatter: str, config_path: Path | None = None) -> tuple[bool, str]:
    """Run yamllint on the frontmatter content.

    Returns (is_clean, output).
    """
    if not frontmatter.endswith("\n"):
        frontmatter += "\n"

    cmd = ["yamllint"]
    if config_path and config_path.is_file():
        cmd.extend(["-c", str(config_path)])
    cmd.append("-")

    try:
        proc = subprocess.run(
            cmd,
            input=frontmatter,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return False, "yamllint executable not found in PATH"

    if proc.returncode != 0:
        return False, proc.stdout.strip() or proc.stderr.strip()

    return True, ""


def check_skill_file(skill_file: Path, config_path: Path | None = None) -> list[str]:
    """Validate a single skill SKILL.md file. Returns list of error messages."""
    errors: list[str] = []
    try:
        content = skill_file.read_text(encoding="utf-8")
    except Exception as err:
        return [f"Could not read {skill_file}: {err}"]

    fm = extract_frontmatter(content)
    if fm is None:
        return [
            f"{skill_file}: Missing or malformed YAML frontmatter (expected opening and closing '---')"
        ]

    is_clean, lint_output = lint_yaml(fm, config_path=config_path)
    if not is_clean:
        errors.append(f"{skill_file}: YAML frontmatter syntax error:\n{lint_output}")

    entries = parse_frontmatter_entries(fm)
    if "name" not in entries:
        errors.append(f"{skill_file}: Missing or empty 'name' in frontmatter")
    else:
        valid, reason = validate_string_entry(entries["name"])
        if not valid:
            if reason == "is empty":
                errors.append(f"{skill_file}: Missing or empty 'name' in frontmatter")
            else:
                errors.append(f"{skill_file}: 'name' in frontmatter {reason}")
        else:
            skill_name = entries["name"].first_line.strip("\"'")
            expected_name = skill_file.parent.name
            if skill_name != expected_name:
                errors.append(
                    f"{skill_file}: Frontmatter name '{skill_name}' does not match folder '{expected_name}'"
                )

    if "description" not in entries:
        errors.append(f"{skill_file}: Missing 'description' in frontmatter")
    else:
        valid, reason = validate_string_entry(entries["description"])
        if not valid:
            if reason == "is empty":
                errors.append(
                    f"{skill_file}: Missing or empty 'description' in frontmatter"
                )
            else:
                errors.append(f"{skill_file}: 'description' in frontmatter {reason}")

    return errors


def find_skill_files(target_paths: list[Path]) -> list[Path]:
    """Resolve list of SKILL.md files to check."""
    skill_files: list[Path] = []
    for path in target_paths:
        if path.is_file() and path.name == "SKILL.md":
            skill_files.append(path)
        elif path.is_dir():
            skill_files.extend(sorted(path.glob("*/SKILL.md")))
    return skill_files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check skill SKILL.md YAML frontmatter"
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Paths to check (defaults to .agents/skills/)",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(".yamllint.yml"),
        help="Path to .yamllint.yml configuration",
    )
    args = parser.parse_args()

    paths = args.paths or [Path(".agents/skills")]
    skill_files = find_skill_files(paths)

    if not skill_files:
        print("No SKILL.md files found to check.", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    config_path = args.config if args.config.is_file() else None

    for skill_file in skill_files:
        errs = check_skill_file(skill_file, config_path=config_path)
        all_errors.extend(errs)

    if all_errors:
        print("Skill frontmatter validation failed:", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(f"Checked {len(skill_files)} skill frontmatters: all valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
