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
from pathlib import Path

FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
KEY_VAL_RE = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")


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

    keys = parse_top_level_keys(fm)
    if "name" not in keys or not keys["name"]:
        errors.append(f"{skill_file}: Missing or empty 'name' in frontmatter")
    else:
        skill_name = keys["name"].strip("\"'")
        expected_name = skill_file.parent.name
        if skill_name != expected_name:
            errors.append(
                f"{skill_file}: Frontmatter name '{skill_name}' does not match folder '{expected_name}'"
            )

    if "description" not in keys:
        errors.append(f"{skill_file}: Missing 'description' in frontmatter")

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
